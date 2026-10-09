import * as SQLite from 'wa-sqlite';
import { CatalogBootstrapError } from '../catalog/errors.ts';
import {
  CATALOG_COMPRESSED_LIMIT,
  CATALOG_RAW_LIMIT,
  parseCatalogManifest,
  type CatalogManifest,
} from '../catalog/manifest.ts';
import { CatalogDb } from './catalog-db.ts';
import {
  CATALOG_SLOT_FILENAMES,
  type CatalogSlot,
} from './catalog-config.ts';
import type { CatalogReceipt, CatalogReceiptStore } from './catalog-receipt.ts';
import type { CatalogInstallResult } from '../catalog/bootstrap-port.ts';

const MANUAL_FILE_ID = -1;
const IMPORT_CHUNK_BYTES = 64 * 1024;
const SQLITE_HEADER = new TextEncoder().encode('SQLite format 3\0');

export const KILTER_CATALOG_REQUIRED_COLUMNS = {
  climbs: ['uuid', 'layout_id', 'setter_username', 'name', 'description',
    'frames', 'frames_count', 'is_draft', 'is_listed'],
  climb_stats: ['climb_uuid', 'angle', 'display_difficulty',
    'difficulty_average', 'benchmark_difficulty', 'ascensionist_count',
    'quality_average'],
  difficulty_grades: ['difficulty', 'boulder_name', 'is_listed'],
} as const;

export interface CatalogInstallContext {
  vfs: SQLiteVFS;
  vfsName: string;
  receipts: CatalogReceiptStore;
  active: { receipt: CatalogReceipt; db: CatalogDb } | null;
  now(): string;
  onBoundary?(boundary: 'before-receipt' | 'after-receipt'): Promise<void>;
}

function fail(code: CatalogBootstrapError['code'], message: string, cause?: unknown): CatalogBootstrapError {
  return new CatalogBootstrapError(code, message, cause === undefined ? undefined : { cause });
}

function assertResult(result: number, action: string): void {
  if (result !== SQLite.SQLITE_OK) {
    throw fail('storage', `${action} failed with SQLite result ${result}`);
  }
}

function slotFilename(slot: CatalogSlot): string {
  return CATALOG_SLOT_FILENAMES[slot];
}

function otherSlot(slot: CatalogSlot): CatalogSlot {
  return slot === 'a' ? 'b' : 'a';
}

function readHeader(vfs: SQLiteVFS, filename: string): { size: number; header: Uint8Array } {
  const outFlags = new DataView(new ArrayBuffer(4));
  assertResult(vfs.xOpen(filename, MANUAL_FILE_ID, SQLite.SQLITE_OPEN_READONLY | SQLite.SQLITE_OPEN_MAIN_DB, outFlags),
    `Open catalog file ${filename}`);
  let result: { size: number; header: Uint8Array } | null = null;
  let readFailure: unknown;
  try {
    const sizeOut = new DataView(new ArrayBuffer(8));
    assertResult(vfs.xFileSize(MANUAL_FILE_ID, sizeOut), 'Read catalog file size');
    const size64 = sizeOut.getBigInt64(0, true);
    if (size64 < 100n || size64 > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw fail('schema', 'Catalog SQLite file has an invalid size');
    }
    const header = new Uint8Array(100);
    assertResult(vfs.xRead(MANUAL_FILE_ID, header, 0), 'Read catalog SQLite header');
    result = { size: Number(size64), header };
  } catch (cause) {
    readFailure = cause;
  }
  try {
    assertResult(vfs.xClose(MANUAL_FILE_ID), 'Close catalog header handle');
  } catch (cause) {
    throw fail('closed', 'Could not close catalog header handle; worker must be restarted', cause);
  }
  if (readFailure !== undefined) throw readFailure;
  return result!;
}

function validateHeader(header: Uint8Array): void {
  for (let i = 0; i < SQLITE_HEADER.length; i += 1) {
    if (header[i] !== SQLITE_HEADER[i]) throw fail('schema', 'Catalog is not a SQLite database');
  }
  if (header[18] !== 1 || header[19] !== 1) {
    throw fail('schema', 'Catalog must use SQLite rollback-journal mode');
  }
}

function checkExists(vfs: SQLiteVFS, filename: string): boolean {
  const exists = new DataView(new ArrayBuffer(4));
  assertResult(vfs.xAccess(filename, SQLite.SQLITE_ACCESS_EXISTS, exists), `Check catalog file ${filename}`);
  return exists.getInt32(0, true) !== 0;
}

export function inspectCatalogFile(
  vfs: SQLiteVFS,
  filename: string,
  expectedBytesRaw: number,
): void {
  if (!checkExists(vfs, filename)) throw fail('schema', `Catalog file ${filename} is missing`);
  const { size, header } = readHeader(vfs, filename);
  validateHeader(header);
  if (size !== expectedBytesRaw) throw fail('schema', 'Catalog file size does not match its manifest');
}

export function writeCatalogFile(vfs: SQLiteVFS, filename: string, bytes: Uint8Array): void {
  const flags = SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_READWRITE | SQLite.SQLITE_OPEN_MAIN_DB;
  const outFlags = new DataView(new ArrayBuffer(4));
  assertResult(vfs.xOpen(filename, MANUAL_FILE_ID, flags, outFlags), `Create catalog candidate ${filename}`);
  let writeFailure: unknown;
  try {
    assertResult(vfs.xTruncate(MANUAL_FILE_ID, 0), 'Reset catalog candidate');
    for (let offset = 0; offset < bytes.byteLength; offset += IMPORT_CHUNK_BYTES) {
      const end = Math.min(offset + IMPORT_CHUNK_BYTES, bytes.byteLength);
      assertResult(vfs.xWrite(MANUAL_FILE_ID, bytes.subarray(offset, end), offset), 'Write catalog candidate');
    }
    assertResult(vfs.xTruncate(MANUAL_FILE_ID, bytes.byteLength), 'Set exact catalog candidate size');
    assertResult(vfs.xSync(MANUAL_FILE_ID, SQLite.SQLITE_SYNC_FULL), 'Flush catalog candidate');
  } catch (cause) {
    writeFailure = cause;
  }
  try {
    assertResult(vfs.xClose(MANUAL_FILE_ID), 'Close catalog candidate');
  } catch (cause) {
    throw fail('closed', 'Could not close catalog candidate; worker must be restarted', cause);
  }
  if (writeFailure !== undefined) throw writeFailure;
}

async function decompressSnapshot(compressed: ArrayBuffer, manifest: CatalogManifest): Promise<Uint8Array> {
  if (compressed.byteLength !== manifest.bytesGzipped || compressed.byteLength > CATALOG_COMPRESSED_LIMIT) {
    throw fail('size', 'Compressed catalog size does not match its manifest');
  }
  const digest = await crypto.subtle.digest('SHA-256', compressed);
  const actual = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (actual !== manifest.sha256) throw fail('digest', 'Catalog snapshot digest does not match its manifest');

  let stream: ReadableStream<Uint8Array>;
  try {
    stream = new Blob([new Uint8Array(compressed)]).stream().pipeThrough(new DecompressionStream('gzip'));
  } catch (cause) {
    throw fail('decompression', 'Could not start catalog gzip decompression', cause);
  }
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > CATALOG_RAW_LIMIT || size > manifest.bytesRaw) {
        throw fail('size', 'Decompressed catalog exceeds its declared size limit');
      }
      chunks.push(value);
    }
  } catch (cause) {
    try { await reader.cancel(cause); } catch { /* Keep the read/decompression error. */ }
    if (cause instanceof CatalogBootstrapError) throw cause;
    throw fail('decompression', 'Catalog gzip stream is invalid', cause);
  } finally {
    reader.releaseLock();
  }
  if (size !== manifest.bytesRaw || size > CATALOG_RAW_LIMIT) {
    throw fail('size', 'Decompressed catalog size does not match its manifest');
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  validateHeader(bytes.subarray(0, 100));
  return bytes;
}

function soleOk(rows: Record<string, unknown>[], pragma: string): void {
  if (rows.length !== 1 || Object.values(rows[0] ?? {})[0] !== 'ok') {
    throw fail('schema', `Catalog ${pragma} validation failed`);
  }
}

async function applyReadOnlyPragmas(db: CatalogDb): Promise<void> {
  await db.query('PRAGMA trusted_schema=OFF');
  await db.query('PRAGMA temp_store=MEMORY');
  await db.query('PRAGMA query_only=ON');
}

export async function validateCatalog(
  db: CatalogDb,
  manifestValue: CatalogManifest,
  check: 'integrity' | 'quick',
): Promise<void> {
  const manifest = parseCatalogManifest(manifestValue);
  await applyReadOnlyPragmas(db);

  const pageCountRows = await db.query('PRAGMA page_count');
  const pageSizeRows = await db.query('PRAGMA page_size');
  const pageCount = Object.values(pageCountRows[0] ?? {})[0];
  const pageSize = Object.values(pageSizeRows[0] ?? {})[0];
  if (pageCountRows.length !== 1 || pageSizeRows.length !== 1
    || typeof pageCount !== 'number' || !Number.isSafeInteger(pageCount) || pageCount <= 0
    || typeof pageSize !== 'number' || !Number.isSafeInteger(pageSize) || pageSize <= 0
    || !Number.isSafeInteger(pageCount * pageSize) || pageCount * pageSize !== manifest.bytesRaw) {
    throw fail('schema', 'Catalog page count and size do not match the manifest');
  }

  const integrityRows = await db.query(`PRAGMA ${check}_check`);
  soleOk(integrityRows, `${check}_check`);

  const tableRows = await db.query(
    `SELECT name, type, sql FROM sqlite_master
     WHERE name IN ('climbs', 'climb_stats', 'difficulty_grades')`,
  );
  for (const tableName of Object.keys(KILTER_CATALOG_REQUIRED_COLUMNS)) {
    const table = tableRows.find((row) => row.name === tableName);
    if (table?.type !== 'table' || typeof table.sql !== 'string' || /^\s*CREATE\s+VIRTUAL\s+TABLE/i.test(table.sql)) {
      throw fail('schema', `Catalog is missing the ordinary ${tableName} table`);
    }
    const columns = await db.query(`PRAGMA table_info(${tableName})`);
    const names = new Set(columns.map((row) => row.name).filter((name): name is string => typeof name === 'string'));
    if (!KILTER_CATALOG_REQUIRED_COLUMNS[tableName as keyof typeof KILTER_CATALOG_REQUIRED_COLUMNS]
      .every((column) => names.has(column))) {
      throw fail('schema', `Catalog ${tableName} table is missing required columns`);
    }
  }

  const counts = await db.query(
    'SELECT COUNT(*) AS total, SUM(CASE WHEN layout_id = 8 THEN 0 ELSE 1 END) AS wrong_layout FROM climbs',
  );
  if (counts.length !== 1 || typeof counts[0].total !== 'number' || counts[0].total <= 0
    || counts[0].wrong_layout !== 0) {
    throw fail('schema', 'Catalog must contain nonempty Fullride layout-8 climbs only');
  }
  if (manifest.board !== 'kilter-fullride-7x10') {
    throw fail('schema', 'Catalog manifest board identity is not supported');
  }
}

function sameIdentity(left: CatalogManifest, right: CatalogManifest): boolean {
  return left.version === right.version && left.sha256 === right.sha256 && left.file === right.file;
}

async function cleanupCandidate(context: CatalogInstallContext, filename: string, candidateDb: CatalogDb | null): Promise<void> {
  if (candidateDb) {
    try {
      await candidateDb.close();
    } catch (cause) {
      throw fail('closed', 'Could not close invalid catalog candidate; worker must be restarted', cause);
    }
  }
  try {
    assertResult(context.vfs.xDelete(filename, 1), 'Delete invalid catalog candidate');
  } catch (cause) {
    throw fail('closed', 'Could not delete invalid catalog candidate; worker must be restarted', cause);
  }
}

function resultFailure(
  cause: unknown,
  retained: CatalogReceipt | null,
): CatalogInstallResult {
  if (cause instanceof CatalogBootstrapError) {
    return { ok: false, code: cause.code, message: cause.message, retained };
  }
  const message = cause instanceof Error ? cause.message : String(cause);
  return { ok: false, code: 'storage', message: `Catalog installation failed: ${message}`, retained };
}

export async function installCatalogCandidate(
  context: CatalogInstallContext,
  manifestValue: CatalogManifest,
  compressed: ArrayBuffer,
): Promise<CatalogInstallResult> {
  let previousReceipt: CatalogReceipt | null = null;
  let candidateDb: CatalogDb | null = null;
  let candidateFilename: string | null = null;
  let receiptWriteAttempted = false;
  let committedReceipt: CatalogReceipt | null = null;
  let knownReceipt: CatalogReceipt | null = null;

  try {
    const manifest = parseCatalogManifest(manifestValue);
    const bytes = await decompressSnapshot(compressed, manifest);

    previousReceipt = await context.receipts.read();
    knownReceipt = previousReceipt;
    if (previousReceipt && context.active?.db.isReady()
      && sameIdentity(previousReceipt.manifest, manifest)
      && sameIdentity(context.active.receipt.manifest, manifest)) {
      return { ok: true, receipt: previousReceipt, unchanged: true };
    }

    const slot: CatalogSlot = previousReceipt ? otherSlot(previousReceipt.slot) : 'a';
    candidateFilename = slotFilename(slot);
    assertResult(context.vfs.xDelete(candidateFilename, 1), 'Clear inactive catalog slot');
    writeCatalogFile(context.vfs, candidateFilename, bytes);
    inspectCatalogFile(context.vfs, candidateFilename, manifest.bytesRaw);
    candidateDb = await CatalogDb.open(candidateFilename, {
      vfs: context.vfs,
      name: context.vfsName,
    });
    await validateCatalog(candidateDb, manifest, 'integrity');

    const receipt: CatalogReceipt = Object.freeze({
      schemaVersion: 1,
      slot,
      manifest,
      installedAt: context.now(),
    });
    await context.onBoundary?.('before-receipt');
    knownReceipt = null;
    receiptWriteAttempted = true;
    try {
      await context.receipts.write(receipt);
      committedReceipt = receipt;
      knownReceipt = receipt;
    } catch (writeCause) {
      let observed: CatalogReceipt | null;
      try {
        observed = await context.receipts.read();
      } catch (readCause) {
        throw fail('closed', 'Catalog activation outcome is unknown; worker must be restarted', readCause);
      }
      knownReceipt = observed;
      if (observed?.slot === receipt.slot && sameIdentity(observed.manifest, receipt.manifest)) {
        // The durable write committed even though its caller observed an error.
        committedReceipt = observed;
      } else if ((previousReceipt === null && observed === null)
        || (previousReceipt !== null && observed?.slot === previousReceipt.slot
          && sameIdentity(observed.manifest, previousReceipt.manifest))) {
        try {
          await candidateDb.close();
          candidateDb = null;
        } catch (cause) {
          throw fail('closed', 'Could not close uncommitted candidate; worker must be restarted', cause);
        }
        return resultFailure(writeCause, previousReceipt);
      } else {
        throw fail('closed', 'Catalog activation outcome is ambiguous; worker must be restarted', writeCause);
      }
    }

    await context.onBoundary?.('after-receipt');
    const oldActive = context.active;
    context.active = { receipt: committedReceipt ?? receipt, db: candidateDb };
    candidateDb = null;
    if (oldActive) {
      try {
        await oldActive.db.close();
      } catch (cause) {
        throw fail('closed', 'Catalog activated but the previous connection could not close; worker must be restarted', cause);
      }
    }
    return { ok: true, receipt, unchanged: false };
  } catch (cause) {
    if (cause instanceof CatalogBootstrapError && cause.code === 'closed') {
      return resultFailure(cause, knownReceipt);
    }
    if (!receiptWriteAttempted && candidateFilename) {
      try {
        await cleanupCandidate(context, candidateFilename, candidateDb);
        candidateDb = null;
      } catch (cleanupCause) {
        return resultFailure(cleanupCause, previousReceipt);
      }
    } else if (candidateDb && context.active?.db !== candidateDb) {
      // Once receipt writing begins, the candidate is never deleted. Closing it
      // remains safe only when the receipt was definitely not switched.
      try { await candidateDb.close(); } catch { /* The worker will be retired on an unknown commit. */ }
    }
    return resultFailure(cause, committedReceipt ?? knownReceipt ?? previousReceipt ?? context.active?.receipt ?? null);
  }
}

// @vitest-environment node
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryVFS } from 'wa-sqlite/src/examples/MemoryVFS.js';
import * as SQLite from 'wa-sqlite';
import type { CatalogManifest } from '../catalog/manifest.ts';
import { CatalogDb, configureSqliteWasm, type VfsBinding } from './catalog-db.ts';
import { CATALOG_SLOT_FILENAMES } from './catalog-config.ts';
import { CATALOG_RAW_LIMIT } from '../catalog/manifest.ts';
import { installCatalogCandidate, writeCatalogFile, type CatalogInstallContext } from './catalog-install.ts';
import type { CatalogReceipt, CatalogReceiptStore } from './catalog-receipt.ts';

const fixtureUrl = new URL('./__fixtures__/catalog-bootstrap.sql', import.meta.url);
const vfs = new MemoryVFS();
const binding: VfsBinding = { vfs: vfs as unknown as SQLiteVFS, name: vfs.name };
let seedIndex = 0;

class MemoryReceipts implements CatalogReceiptStore {
  current: CatalogReceipt | null = null;
  writeMode: 'normal' | 'reject' | 'persist-then-reject' = 'normal';
  failReadAfterPersist = false;
  private failNextRead = false;
  reads = 0;
  writes = 0;

  async read(): Promise<CatalogReceipt | null> {
    this.reads += 1;
    if (this.failNextRead) {
      this.failNextRead = false;
      throw new Error('receipt read unavailable');
    }
    return this.current;
  }

  async write(receipt: CatalogReceipt): Promise<void> {
    this.writes += 1;
    if (this.writeMode === 'reject') throw new Error('transaction rejected before commit');
    this.current = receipt;
    if (this.writeMode === 'persist-then-reject') {
      if (this.failReadAfterPersist) this.failNextRead = true;
      throw new Error('response lost after commit');
    }
  }

  close(): void {}
}

interface Snapshot { manifest: CatalogManifest; compressed: ArrayBuffer; raw: Uint8Array }

interface SnapshotOptions {
  fixtureSql?: string;
  mutate?(db: CatalogDb): Promise<unknown>;
}

async function makeSnapshot(name: string, version: number, options: SnapshotOptions = {}): Promise<Snapshot> {
  const seedFilename = `catalog-seed-${seedIndex++}.sqlite3`;
  const db = await CatalogDb.open(
    seedFilename,
    binding,
    SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_READWRITE,
  );
  try {
    const fixture = options.fixtureSql ?? await readFile(fixtureUrl, 'utf8');
    await db.query(fixture);
    await db.query('UPDATE climbs SET name = ? WHERE uuid = ?', [name, 'synthetic-valid']);
    await options.mutate?.(db);
    await db.close();
  } catch (cause) {
    try { await db.close(); } catch { /* The failed synthetic seed is disposable. */ }
    try { vfs.xDelete(seedFilename, 1); } catch { /* Keep the fixture creation error. */ }
    throw cause;
  }

  const source = vfs.mapNameToFile.get(seedFilename)!;
  const raw = new Uint8Array(source.data, 0, source.size).slice();
  vfs.xDelete(source.name, 1);
  const zipped = gzipSync(raw);
  const digest = createHash('sha256').update(zipped).digest('hex');
  const manifest: CatalogManifest = {
    schemaVersion: 2,
    version,
    board: 'kilter-fullride-7x10',
    file: `kilter-7x10.v${version}.db.gz`,
    compression: 'gzip',
    sha256: digest,
    bytesGzipped: zipped.byteLength,
    bytesRaw: raw.byteLength,
    generatedOn: '2026-06-14',
    source: 'legacy-aurora-kilter',
    sourceDataThrough: null,
    generatedFrom: 'synthetic bootstrap SQL',
    filter: 'layout_id=8',
  };
  return { manifest, compressed: Uint8Array.from(zipped).buffer, raw };
}

function context(receipts = new MemoryReceipts()): CatalogInstallContext {
  return {
    vfs: vfs as unknown as SQLiteVFS,
    vfsName: vfs.name,
    receipts,
    active: null,
    now: () => '2026-06-14T12:00:00.000Z',
  };
}

async function queryActive(owner: CatalogInstallContext): Promise<string | null> {
  return owner.active
    ? (await owner.active.db.query('SELECT name FROM climbs WHERE uuid = ? ', ['synthetic-valid']))[0]?.name as string ?? null
    : null;
}

async function expectCandidateRejectionPreservesActive(
  candidate: Snapshot,
  beforeCandidate?: () => (() => void) | void,
): Promise<void> {
  const first = await makeSnapshot('Prior validated catalog', 1);
  const receipts = new MemoryReceipts();
  const owner = context(receipts);
  await expect(installCatalogCandidate(owner, first.manifest, first.compressed))
    .resolves.toMatchObject({ ok: true, receipt: { slot: 'a' } });
  const receiptBefore = receipts.current;
  const writesBefore = receipts.writes;

  const restore = beforeCandidate?.();
  try {
    await expect(installCatalogCandidate(owner, candidate.manifest, candidate.compressed))
      .resolves.toMatchObject({ ok: false, code: 'schema', retained: { slot: 'a' } });
  } finally {
    restore?.();
  }
  expect(receipts.current).toBe(receiptBefore);
  expect(receipts.writes).toBe(writesBefore);
  expect(await queryActive(owner)).toBe('Prior validated catalog');
  expect(vfs.mapNameToFile.has(CATALOG_SLOT_FILENAMES.a)).toBe(true);
  expect(vfs.mapNameToFile.has(CATALOG_SLOT_FILENAMES.b)).toBe(false);
  await owner.active?.db.close();
  owner.active = null;
}

async function clearSlots(): Promise<void> {
  if (vfs.mapIdToFile.has(-1)) vfs.xClose(-1);
  for (const filename of Object.values(CATALOG_SLOT_FILENAMES)) vfs.xDelete(filename, 1);
}

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  configureSqliteWasm(await readFile(require.resolve('wa-sqlite/dist/wa-sqlite.wasm')));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await clearSlots();
});

describe('catalog slot installation and receipt activation', () => {
  it('imports, checks and queries a synthetic SQLite snapshot before committing its receipt', async () => {
    const snapshot = await makeSnapshot('Synthetic first', 1);
    const receipts = new MemoryReceipts();
    const owner = context(receipts);
    const result = await installCatalogCandidate(owner, snapshot.manifest, snapshot.compressed);

    expect(result).toMatchObject({ ok: true, unchanged: false, receipt: { slot: 'a' } });
    expect(receipts.current).toMatchObject({ slot: 'a', manifest: snapshot.manifest });
    expect(await queryActive(owner)).toBe('Synthetic first');
    expect(vfs.mapNameToFile.get(CATALOG_SLOT_FILENAMES.a)?.size).toBe(snapshot.raw.byteLength);
  });

  it('uses the stored receipt slot as authority when no catalog connection opened', async () => {
    const first = await makeSnapshot('Installed on a', 1);
    const next = await makeSnapshot('Installed on b', 2);
    const receipts = new MemoryReceipts();
    const owner = context(receipts);
    await installCatalogCandidate(owner, first.manifest, first.compressed);
    await owner.active!.db.close();
    owner.active = null;
    expect(vfs.mapNameToFile.has(CATALOG_SLOT_FILENAMES.a)).toBe(true);

    const touched: { action: string; filename: string; flags?: number }[] = [];
    const openHandles = new Map<number, string>();
    const open = vi.spyOn(vfs, 'xOpen').mockImplementation((filename, fileId, flags, outFlags) => {
      if (filename !== null) openHandles.set(fileId, filename);
      touched.push({ action: 'open', filename: filename ?? 'unknown', flags });
      return MemoryVFS.prototype.xOpen.call(vfs, filename, fileId, flags, outFlags);
    });
    const truncate = vi.spyOn(vfs, 'xTruncate').mockImplementation((fileId, size) => {
      touched.push({ action: 'truncate', filename: openHandles.get(fileId) ?? 'unknown' });
      return MemoryVFS.prototype.xTruncate.call(vfs, fileId, size);
    });
    const write = vi.spyOn(vfs, 'xWrite').mockImplementation((fileId, data, offset) => {
      touched.push({ action: 'write', filename: openHandles.get(fileId) ?? 'unknown' });
      return MemoryVFS.prototype.xWrite.call(vfs, fileId, data, offset);
    });
    const close = vi.spyOn(vfs, 'xClose').mockImplementation((fileId) => {
      const filename = openHandles.get(fileId);
      const result = MemoryVFS.prototype.xClose.call(vfs, fileId);
      if (filename) openHandles.delete(fileId);
      return result;
    });
    const deleteFile = vi.spyOn(vfs, 'xDelete').mockImplementation((filename, syncDir) => {
      touched.push({ action: 'delete', filename });
      return MemoryVFS.prototype.xDelete.call(vfs, filename, syncDir);
    });
    const result = await installCatalogCandidate(owner, next.manifest, next.compressed);
    open.mockRestore();
    truncate.mockRestore();
    write.mockRestore();
    close.mockRestore();
    deleteFile.mockRestore();

    expect(result).toMatchObject({ ok: true, receipt: { slot: 'b' } });
    expect(touched.filter((entry) => entry.filename === CATALOG_SLOT_FILENAMES.a)).toEqual([]);
    expect(touched.filter((entry) => entry.action === 'delete')).toEqual([
      { action: 'delete', filename: CATALOG_SLOT_FILENAMES.b },
    ]);
    expect(vfs.mapNameToFile.has(CATALOG_SLOT_FILENAMES.a)).toBe(true);
  });

  it('keeps the last good active catalog readable after digest and schema rejection', async () => {
    const first = await makeSnapshot('Last good', 1);
    const invalid = await makeSnapshot('Bad candidate', 2);
    const owner = context();
    expect((await installCatalogCandidate(owner, first.manifest, first.compressed)).ok).toBe(true);

    const badDigest = { ...invalid.manifest, sha256: 'c'.repeat(64) };
    await expect(installCatalogCandidate(owner, badDigest, invalid.compressed))
      .resolves.toMatchObject({ ok: false, code: 'digest', retained: { slot: 'a' } });

    const notSqlite = new Uint8Array([1, 2, 3, 4]);
    const zipped = gzipSync(notSqlite);
    const invalidSqlite: CatalogManifest = {
      ...invalid.manifest,
      sha256: createHash('sha256').update(zipped).digest('hex'),
      bytesGzipped: zipped.byteLength,
      bytesRaw: notSqlite.byteLength,
    };
    await expect(installCatalogCandidate(owner, invalidSqlite, Uint8Array.from(zipped).buffer))
      .resolves.toMatchObject({ ok: false, code: 'schema', retained: { slot: 'a' } });

    expect(await queryActive(owner)).toBe('Last good');
    expect(vfs.mapNameToFile.has(CATALOG_SLOT_FILENAMES.b)).toBe(false);
  });

  it('retires after an inactive-slot delete error without retrying or mutating activation', async () => {
    const first = await makeSnapshot('Still active after delete error', 1);
    const stale = await makeSnapshot('Stale inactive slot', 2);
    const next = await makeSnapshot('Never written after delete error', 3);
    const receipts = new MemoryReceipts();
    const owner = context(receipts);
    await installCatalogCandidate(owner, first.manifest, first.compressed);
    writeCatalogFile(vfs as unknown as SQLiteVFS, CATALOG_SLOT_FILENAMES.b, stale.raw);
    const receiptBefore = receipts.current;
    const writesBefore = receipts.writes;
    const deletes: string[] = [];
    const writes: string[] = [];
    const openHandles = new Map<number, string>();
    const open = vi.spyOn(vfs, 'xOpen').mockImplementation((filename, fileId, flags, outFlags) => {
      if (filename !== null) openHandles.set(fileId, filename);
      return MemoryVFS.prototype.xOpen.call(vfs, filename, fileId, flags, outFlags);
    });
    const deleteFile = vi.spyOn(vfs, 'xDelete').mockImplementation((filename, syncDir) => {
      deletes.push(filename);
      const result = MemoryVFS.prototype.xDelete.call(vfs, filename, syncDir);
      return filename === CATALOG_SLOT_FILENAMES.b ? SQLite.SQLITE_IOERR : result;
    });
    const writeFile = vi.spyOn(vfs, 'xWrite').mockImplementation((fileId, data, offset) => {
      writes.push(openHandles.get(fileId) ?? 'unknown');
      return MemoryVFS.prototype.xWrite.call(vfs, fileId, data, offset);
    });

    const result = await installCatalogCandidate(owner, next.manifest, next.compressed);
    open.mockRestore();
    deleteFile.mockRestore();
    writeFile.mockRestore();

    expect(result).toMatchObject({ ok: false, code: 'closed', retained: { slot: 'a' } });
    expect(deletes).toEqual([CATALOG_SLOT_FILENAMES.b]);
    expect(writes).toEqual([]);
    expect(receipts.current).toBe(receiptBefore);
    expect(receipts.writes).toBe(writesBefore);
    expect(vfs.mapNameToFile.has(CATALOG_SLOT_FILENAMES.b)).toBe(false);
    expect(await queryActive(owner)).toBe('Still active after delete error');
  });

  it('rejects a candidate missing a consumer-required column while retaining the active receipt', async () => {
    const fixture = await readFile(fixtureUrl, 'utf8');
    const malformed = fixture.replace(
      '  is_listed INTEGER\n);\n\nCREATE TABLE climb_stats',
      '  legacy_is_listed INTEGER\n);\n\nCREATE TABLE climb_stats',
    );
    expect(malformed).not.toBe(fixture);
    await expectCandidateRejectionPreservesActive(
      await makeSnapshot('Missing required column', 2, { fixtureSql: malformed }),
    );
  });

  it('rejects a view substituted for a required ordinary table and retains the active receipt', async () => {
    const fixture = await readFile(fixtureUrl, 'utf8');
    const malformed = fixture
      .replace(/CREATE TABLE climb_stats \([\s\S]*?\);/, `CREATE VIEW climb_stats AS
        SELECT NULL AS climb_uuid, NULL AS angle, NULL AS display_difficulty,
          NULL AS difficulty_average, NULL AS benchmark_difficulty,
          NULL AS ascensionist_count, NULL AS quality_average WHERE 0;`)
      .replace(/INSERT INTO climb_stats VALUES[\s\S]*?;\n/, '');
    expect(malformed).not.toBe(fixture);
    await expectCandidateRejectionPreservesActive(
      await makeSnapshot('View substituted for table', 2, { fixtureSql: malformed }),
    );
  });

  it('rejects a virtual table substituted for a required ordinary table and retains the active receipt', async () => {
    const candidate = await makeSnapshot('Virtual table substituted for table', 2);
    await expectCandidateRejectionPreservesActive(
      candidate,
      () => {
        const originalQuery = CatalogDb.prototype.query;
        const query = vi.spyOn(CatalogDb.prototype, 'query').mockImplementation(
          async function (this: CatalogDb, sql: string, params?: readonly unknown[]) {
            const rows = await originalQuery.call(this, sql, params as never);
            if (sql.startsWith('SELECT name, type, sql FROM sqlite_master')) {
              return rows.map((row) => row.name === 'climb_stats'
                ? { ...row, type: 'table', sql: 'CREATE VIRTUAL TABLE climb_stats USING unavailable_module' }
                : row);
            }
            return rows;
          } as typeof originalQuery,
        );
        return () => query.mockRestore();
      },
    );
  });

  it('rejects non-layout-8 and empty climb candidates while retaining the active receipt', async () => {
    const wrongLayout = await makeSnapshot('Wrong layout candidate', 2, {
      mutate: (db) => db.query('UPDATE climbs SET layout_id = 1'),
    });
    await expectCandidateRejectionPreservesActive(wrongLayout);

    const empty = await makeSnapshot('Empty climbs candidate', 3, {
      mutate: (db) => db.query('DELETE FROM climbs'),
    });
    await expectCandidateRejectionPreservesActive(empty);
  });

  it('rejects a non-ok integrity_check result without changing the active receipt', async () => {
    const first = await makeSnapshot('Prior validated catalog', 1);
    const candidate = await makeSnapshot('Integrity check candidate', 2);
    const receipts = new MemoryReceipts();
    const owner = context(receipts);
    await installCatalogCandidate(owner, first.manifest, first.compressed);
    const receiptBefore = receipts.current;
    const writesBefore = receipts.writes;
    const originalQuery = CatalogDb.prototype.query;
    const query = vi.spyOn(CatalogDb.prototype, 'query').mockImplementation(
      async function (this: CatalogDb, sql: string, params?: readonly unknown[]) {
        if (sql === 'PRAGMA integrity_check') return [{ integrity_check: 'database is corrupt' }];
        return originalQuery.call(this, sql, params as never);
      } as typeof originalQuery,
    );

    const result = await installCatalogCandidate(owner, candidate.manifest, candidate.compressed);
    query.mockRestore();

    expect(result).toMatchObject({ ok: false, code: 'schema', retained: { slot: 'a' } });
    expect(receipts.current).toBe(receiptBefore);
    expect(receipts.writes).toBe(writesBefore);
    expect(await queryActive(owner)).toBe('Prior validated catalog');
    expect(vfs.mapNameToFile.has(CATALOG_SLOT_FILENAMES.b)).toBe(false);
  });

  it('rejects corrupt gzip and rollback-journal headers before writing an inactive slot', async () => {
    const first = await makeSnapshot('Keep active after malformed source', 1);
    const next = await makeSnapshot('Invalid header source', 2);
    const owner = context();
    await installCatalogCandidate(owner, first.manifest, first.compressed);

    const malformedGzip = new Uint8Array(next.compressed).slice();
    malformedGzip[0] = 0;
    const malformedGzipDigest = createHash('sha256').update(malformedGzip).digest('hex');
    const invalidGzip = {
      ...next.manifest,
      sha256: malformedGzipDigest,
      bytesGzipped: malformedGzip.byteLength,
    };
    await expect(installCatalogCandidate(owner, invalidGzip, malformedGzip.buffer))
      .resolves.toMatchObject({ ok: false, code: 'decompression', retained: { slot: 'a' } });

    const walHeader = next.raw.slice();
    walHeader[19] = 2;
    const badHeaderGzip = gzipSync(walHeader);
    const badHeaderManifest: CatalogManifest = {
      ...next.manifest,
      sha256: createHash('sha256').update(badHeaderGzip).digest('hex'),
      bytesGzipped: badHeaderGzip.byteLength,
      bytesRaw: walHeader.byteLength,
    };
    await expect(installCatalogCandidate(owner, badHeaderManifest, Uint8Array.from(badHeaderGzip).buffer))
      .resolves.toMatchObject({ ok: false, code: 'schema', retained: { slot: 'a' } });

    expect(vfs.mapNameToFile.has(CATALOG_SLOT_FILENAMES.b)).toBe(false);
    expect(await queryActive(owner)).toBe('Keep active after malformed source');
  });

  it('rejects a database whose exact file size is not a whole page count', async () => {
    const first = await makeSnapshot('Last good whole-page catalog', 1);
    const next = await makeSnapshot('Trailing-byte catalog', 2);
    const owner = context();
    await installCatalogCandidate(owner, first.manifest, first.compressed);

    const withTrailingByte = new Uint8Array(next.raw.byteLength + 1);
    withTrailingByte.set(next.raw);
    const zipped = gzipSync(withTrailingByte);
    const manifest: CatalogManifest = {
      ...next.manifest,
      sha256: createHash('sha256').update(zipped).digest('hex'),
      bytesGzipped: zipped.byteLength,
      bytesRaw: withTrailingByte.byteLength,
    };
    await expect(installCatalogCandidate(owner, manifest, Uint8Array.from(zipped).buffer))
      .resolves.toMatchObject({ ok: false, code: 'schema', retained: { slot: 'a' } });

    expect(vfs.mapNameToFile.has(CATALOG_SLOT_FILENAMES.b)).toBe(false);
    expect(await queryActive(owner)).toBe('Last good whole-page catalog');
  });

  it('stops gzip output when it exceeds the declared raw limit', async () => {
    const first = await makeSnapshot('Keep active after oversized gzip', 1);
    const owner = context();
    await installCatalogCandidate(owner, first.manifest, first.compressed);

    const oversized = gzipSync(new Uint8Array(CATALOG_RAW_LIMIT + 1));
    const manifest: CatalogManifest = {
      ...first.manifest,
      version: 2,
      file: 'kilter-7x10.v2.db.gz',
      sha256: createHash('sha256').update(oversized).digest('hex'),
      bytesGzipped: oversized.byteLength,
      bytesRaw: CATALOG_RAW_LIMIT,
    };
    await expect(installCatalogCandidate(owner, manifest, Uint8Array.from(oversized).buffer))
      .resolves.toMatchObject({ ok: false, code: 'size', retained: { slot: 'a' } });
    expect(vfs.mapNameToFile.has(CATALOG_SLOT_FILENAMES.b)).toBe(false);
    expect(await queryActive(owner)).toBe('Keep active after oversized gzip');
  });

  it('treats a persist-then-reject receipt write as committed when reread selects the candidate', async () => {
    const first = await makeSnapshot('First', 1);
    const next = await makeSnapshot('Committed second', 2);
    const receipts = new MemoryReceipts();
    const owner = context(receipts);
    await installCatalogCandidate(owner, first.manifest, first.compressed);
    receipts.writeMode = 'persist-then-reject';

    const result = await installCatalogCandidate(owner, next.manifest, next.compressed);
    expect(result).toMatchObject({ ok: true, receipt: { slot: 'b' } });
    expect(await queryActive(owner)).toBe('Committed second');
  });

  it('does not delete a candidate after receipt writing was attempted and the old receipt remains', async () => {
    const first = await makeSnapshot('Still active', 1);
    const next = await makeSnapshot('Uncommitted candidate', 2);
    const receipts = new MemoryReceipts();
    const owner = context(receipts);
    await installCatalogCandidate(owner, first.manifest, first.compressed);
    receipts.writeMode = 'reject';
    const deletions: string[] = [];
    const deleteFile = vi.spyOn(vfs, 'xDelete').mockImplementation((filename, syncDir) => {
      deletions.push(filename);
      return MemoryVFS.prototype.xDelete.call(vfs, filename, syncDir);
    });

    const result = await installCatalogCandidate(owner, next.manifest, next.compressed);
    deleteFile.mockRestore();

    expect(result).toMatchObject({ ok: false, retained: { slot: 'a' } });
    expect(deletions).toEqual([CATALOG_SLOT_FILENAMES.b]);
    expect(vfs.mapNameToFile.has(CATALOG_SLOT_FILENAMES.b)).toBe(true);
    expect(await queryActive(owner)).toBe('Still active');
  });

  it('poisons an unknown receipt outcome without claiming the old slot is active', async () => {
    const first = await makeSnapshot('Old active', 1);
    const next = await makeSnapshot('Unknown outcome', 2);
    const receipts = new MemoryReceipts();
    const owner = context(receipts);
    await installCatalogCandidate(owner, first.manifest, first.compressed);
    receipts.writeMode = 'persist-then-reject';
    receipts.failReadAfterPersist = true;

    await expect(installCatalogCandidate(owner, next.manifest, next.compressed))
      .resolves.toMatchObject({ ok: false, code: 'closed', retained: null });
    expect(vfs.mapNameToFile.has(CATALOG_SLOT_FILENAMES.b)).toBe(true);
  });

  it('uses the active catalog without reimporting the same validated manifest', async () => {
    const snapshot = await makeSnapshot('Same identity', 1);
    const receipts = new MemoryReceipts();
    const owner = context(receipts);
    await installCatalogCandidate(owner, snapshot.manifest, snapshot.compressed);
    const deleteFile = vi.spyOn(vfs, 'xDelete');

    await expect(installCatalogCandidate(owner, snapshot.manifest, snapshot.compressed))
      .resolves.toMatchObject({ ok: true, unchanged: true });
    expect(deleteFile).not.toHaveBeenCalled();
    deleteFile.mockRestore();
  });

  it('bounds failed candidate storage to the two fixed slots across retries', async () => {
    const first = await makeSnapshot('Active', 1);
    const next = await makeSnapshot('Retry', 2);
    const receipts = new MemoryReceipts();
    const owner = context(receipts);
    await installCatalogCandidate(owner, first.manifest, first.compressed);
    receipts.writeMode = 'reject';
    await installCatalogCandidate(owner, next.manifest, next.compressed);
    await installCatalogCandidate(owner, next.manifest, next.compressed);
    expect(vfs.mapNameToFile.size).toBeLessThanOrEqual(2);
    expect(await queryActive(owner)).toBe('Active');
  });

  it('turns raw VFS write failure into a recoverable storage result after closing the handle', async () => {
    const first = await makeSnapshot('Active before I/O failure', 1);
    const next = await makeSnapshot('Failed write', 2);
    const owner = context();
    await installCatalogCandidate(owner, first.manifest, first.compressed);
    const write = vi.spyOn(vfs, 'xWrite').mockImplementation((fileId, data, offset) =>
      fileId === -1 ? SQLite.SQLITE_IOERR : MemoryVFS.prototype.xWrite.call(vfs, fileId, data, offset));

    const result = await installCatalogCandidate(owner, next.manifest, next.compressed);
    write.mockRestore();
    expect(result).toMatchObject({ ok: false, code: 'storage', retained: { slot: 'a' } });
    expect(await queryActive(owner)).toBe('Active before I/O failure');
    expect(vfs.mapNameToFile.has(CATALOG_SLOT_FILENAMES.b)).toBe(false);
  });

  it('does not delete a candidate after its raw handle fails to close', async () => {
    const snapshot = await makeSnapshot('Candidate', 1);
    const owner = context();
    const deletes: string[] = [];
    const deleteFile = vi.spyOn(vfs, 'xDelete').mockImplementation((filename, syncDir) => {
      deletes.push(filename);
      return MemoryVFS.prototype.xDelete.call(vfs, filename, syncDir);
    });
    const close = vi.spyOn(vfs, 'xClose').mockImplementation((fileId) =>
      fileId === -1 ? SQLite.SQLITE_IOERR : MemoryVFS.prototype.xClose.call(vfs, fileId));

    const result = await installCatalogCandidate(owner, snapshot.manifest, snapshot.compressed);
    close.mockRestore();
    deleteFile.mockRestore();
    expect(result).toMatchObject({ ok: false, code: 'closed' });
    expect(deletes).toEqual([CATALOG_SLOT_FILENAMES.a]);
    expect(vfs.mapNameToFile.has(CATALOG_SLOT_FILENAMES.a)).toBe(true);
  });
});

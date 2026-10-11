import type { AppLibrary } from "../../../web/src/app/library.ts";
import {
  decodeStoredDraft,
  encodeStoredDraft,
  draftRevision,
  localDraftId,
} from "../../../web/src/drafts/codec.ts";
import {
  DraftConflictError,
  DraftCorruptRecordError,
  DraftNotFoundError,
  DraftRepositoryError,
  translateDraftStorageError,
} from "../../../web/src/drafts/errors.ts";
import {
  draftFrom,
  draftContentOf,
  draftInCollection,
} from "../../../web/src/drafts/record.ts";
import type {
  DraftRepositoryOptions,
  LocalDraftRepository,
} from "../../../web/src/drafts/repository.ts";
import type {
  LocalClimbDraft,
  LocalDraftId,
  DraftRevision,
} from "../../../web/src/drafts/types.ts";
import {
  decodeStoredPlaylist,
  encodeStoredPlaylist,
  playlistId,
  playlistRevision,
} from "../../../web/src/playlists/codec.ts";
import {
  PlaylistConflictError,
  PlaylistCorruptRecordError,
  PlaylistNotFoundError,
  translatePlaylistStorageError,
} from "../../../web/src/playlists/errors.ts";
import { playlistFrom } from "../../../web/src/playlists/record.ts";
import type {
  PlaylistRepositoryOptions,
  LocalPlaylistRepository,
} from "../../../web/src/playlists/repository.ts";
import type {
  LocalPlaylist,
  PlaylistId,
  PlaylistRevision,
} from "../../../web/src/playlists/types.ts";
import {
  canonicalDraft,
  canonicalPlaylist,
  canonicalSnapshot,
} from "../../../web/src/library-backup/codec.ts";
import {
  BackupConflictError,
  LibraryBackupStorageError,
  LibraryRestoreVerificationError,
  type BackupConflict,
  type LibraryBackupStore,
  type LibrarySnapshot,
  type RestoreBatchResult,
} from "../../../web/src/library-backup/types.ts";
import type {
  LibraryPreservation,
  PreservationRecord,
} from "../../../web/src/automatic-backup/types.ts";
import {
  decodeBackupControl,
  decodePreservationRecord,
  emptyBackupControl,
} from "../../../web/src/automatic-backup/state.ts";

export interface NativeLibraryDatabase {
  execute(sql: string): Promise<void>;
  run(sql: string, values: readonly unknown[]): Promise<void>;
  query(
    sql: string,
    values?: readonly unknown[],
  ): Promise<readonly Record<string, unknown>[]>;
  close(): Promise<void>;
}

type Table = "climbs" | "playlists";
type SavedRecord = LocalClimbDraft | LocalPlaylist;
const PAGE_SIZE = 32;
const SMALL_PAYLOAD_BYTES = 8 * 1024;
const BLOB_RANGE_BYTES = 32 * 1024;
const WRITE_CHUNK_CODE_UNITS = 16 * 1024;
const PRESERVATION_TABLE = "library_preservation";
const EMPTY_METADATA = Object.freeze({
  singleton: 1,
  revision: 0,
  version: 0,
  control: JSON.stringify(emptyBackupControl()),
  recovery_revision: null,
  recovery_sha256: null,
});

interface TransactionResult<T> {
  readonly value: T;
  readonly contentChanged?: boolean;
  readonly revisionAdvanced?: boolean;
}

function safeCounter(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new LibraryBackupStorageError(`Invalid native preservation ${label}`);
  }
  return value as number;
}

function nextCounter(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value === Number.MAX_SAFE_INTEGER) {
    throw new LibraryBackupStorageError(`Native preservation ${label} is exhausted`);
  }
  return value + 1;
}

function metadataRecord(row: Record<string, unknown>): PreservationRecord {
  if (row.singleton !== 1 || typeof row.control !== "string") {
    throw new LibraryBackupStorageError("Invalid native preservation metadata");
  }
  let control: unknown;
  try {
    control = JSON.parse(row.control) as unknown;
  } catch (cause) {
    throw new LibraryBackupStorageError("Native preservation control is corrupt", { cause });
  }
  const recovery = row.recovery_revision === null && row.recovery_sha256 === null
    ? null
    : { revision: row.recovery_revision, sha256: row.recovery_sha256 };
  return decodePreservationRecord({
    revision: row.revision,
    version: row.version,
    control,
    recovery,
  });
}

function splitPayload(payload: string): readonly string[] {
  if (typeof payload !== "string") throw new Error("Native library payload is not text");
  const chunks: string[] = [];
  for (let offset = 0; offset < payload.length;) {
    let end = Math.min(offset + WRITE_CHUNK_CODE_UNITS, payload.length);
    const last = payload.charCodeAt(end - 1);
    const next = payload.charCodeAt(end);
    if (end < payload.length && last >= 0xd800 && last <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
      end -= 1;
    }
    chunks.push(payload.slice(offset, end));
    offset = end;
  }
  return chunks;
}

function bytesFromHex(value: unknown, expectedBytes: number): Uint8Array {
  if (typeof value !== "string" || value.length !== expectedBytes * 2 || !/^(?:[0-9a-f]{2})*$/i.test(value)) {
    throw new LibraryBackupStorageError("Native library returned a truncated payload range");
  }
  const bytes = new Uint8Array(expectedBytes);
  for (let index = 0; index < expectedBytes; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function draftRow(row: Record<string, unknown>): LocalClimbDraft {
  let value: unknown;
  try {
    if (typeof row.payload !== "string") throw new Error("expected JSON text");
    value = JSON.parse(row.payload) as unknown;
  } catch (cause) {
    throw new DraftCorruptRecordError("payload", "invalid JSON", { cause });
  }
  const record = decodeStoredDraft(value);
  if (row.id !== record.id)
    throw new DraftCorruptRecordError("id", "key does not match payload ID");
  return record;
}

function playlistRow(row: Record<string, unknown>): LocalPlaylist {
  let value: unknown;
  try {
    if (typeof row.payload !== "string") throw new Error("expected JSON text");
    value = JSON.parse(row.payload) as unknown;
  } catch (cause) {
    throw new PlaylistCorruptRecordError("payload", "invalid JSON", { cause });
  }
  const record = decodeStoredPlaylist(value);
  if (row.id !== record.id)
    throw new PlaylistCorruptRecordError("id", "key does not match payload ID");
  return record;
}

function newestFirst<T extends SavedRecord>(records: T[]): readonly T[] {
  return Object.freeze(
    records.sort((a, b) =>
      a.updatedAt < b.updatedAt
        ? 1
        : a.updatedAt > b.updatedAt
          ? -1
          : a.id < b.id
            ? 1
            : a.id > b.id
              ? -1
              : 0,
    ),
  );
}

export async function createNativeLibrary(
  database: NativeLibraryDatabase,
  options: DraftRepositoryOptions & PlaylistRepositoryOptions = {},
): Promise<AppLibrary> {
  const preservationSql = `CREATE TABLE ${PRESERVATION_TABLE} (
    singleton INTEGER PRIMARY KEY NOT NULL CHECK (singleton = 1),
    revision INTEGER NOT NULL CHECK (revision >= 0),
    version INTEGER NOT NULL CHECK (version >= 0),
    control TEXT NOT NULL,
    recovery_revision INTEGER,
    recovery_sha256 TEXT,
    CHECK ((recovery_revision IS NULL AND recovery_sha256 IS NULL)
      OR (recovery_revision >= 0 AND length(recovery_sha256) = 64))
  )`;
  async function checkColumns(table: string, expected: readonly Readonly<{
    name: string;
    type: string;
    pk: number;
    notnull: number;
  }>[]) {
    const columns = await database.query(`PRAGMA table_info(${table})`);
    if (columns.length !== expected.length || columns.some((column, index) => {
      const shape = expected[index]!;
      return column.name !== shape.name || column.type !== shape.type
        || column.pk !== shape.pk || column.notnull !== shape.notnull;
    })) throw new Error(`Unsupported native library ${table} schema`);
  }
  const recordColumns = [
    { name: "id", type: "TEXT", pk: 1, notnull: 1 },
    { name: "payload", type: "TEXT", pk: 0, notnull: 1 },
  ] as const;
  const preservationColumns = [
    { name: "singleton", type: "INTEGER", pk: 1, notnull: 1 },
    { name: "revision", type: "INTEGER", pk: 0, notnull: 1 },
    { name: "version", type: "INTEGER", pk: 0, notnull: 1 },
    { name: "control", type: "TEXT", pk: 0, notnull: 1 },
    { name: "recovery_revision", type: "INTEGER", pk: 0, notnull: 0 },
    { name: "recovery_sha256", type: "TEXT", pk: 0, notnull: 0 },
  ] as const;
  async function checkV1(tables: readonly Record<string, unknown>[]) {
    if (tables.length !== 2 || tables[0]?.name !== "climbs" || tables[0]?.type !== "table"
      || tables[1]?.name !== "playlists" || tables[1]?.type !== "table") {
      throw new Error("Unsupported or incomplete native library schema");
    }
    await checkColumns("climbs", recordColumns);
    await checkColumns("playlists", recordColumns);
  }
  async function checkV2() {
    const tables = await database.query(
      "SELECT name, type FROM sqlite_master WHERE name NOT GLOB 'sqlite_*' ORDER BY name",
    );
    if (tables.length !== 3 || tables[0]?.name !== "climbs" || tables[0]?.type !== "table"
      || tables[1]?.name !== PRESERVATION_TABLE || tables[1]?.type !== "table"
      || tables[2]?.name !== "playlists" || tables[2]?.type !== "table") {
      throw new Error("Unsupported or incomplete native library schema");
    }
    await checkColumns("climbs", recordColumns);
    await checkColumns("playlists", recordColumns);
    await checkColumns(PRESERVATION_TABLE, preservationColumns);
    const schema = await database.query(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
      [PRESERVATION_TABLE],
    );
    const normalized = String(schema[0]?.sql ?? "").toLowerCase().replace(/\s+/g, " ");
    if (!["check (singleton = 1)", "check (revision >= 0)", "check (version >= 0)",
      "length(recovery_sha256) = 64"].every((check) => normalized.includes(check))) {
      throw new Error("Unsupported native preservation constraints");
    }
    const rows = await database.query(`SELECT * FROM ${PRESERVATION_TABLE}`);
    if (rows.length !== 1) throw new Error("Invalid native preservation singleton");
    metadataRecord(rows[0]!);
  }

  // Only a recognized empty, v1, or v2 database is admitted. The v1 migration
  // adds metadata without rewriting either authored table.
  try {
    const version = (await database.query("PRAGMA user_version"))[0]
      ?.user_version;
    const tables = await database.query(
      "SELECT name, type FROM sqlite_master WHERE name NOT GLOB 'sqlite_*' ORDER BY name",
    );
    if (version === 0 && tables.length === 0) {
      await database.execute("BEGIN IMMEDIATE");
      try {
        await database.execute(
          "CREATE TABLE climbs (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL)",
        );
        await database.execute(
          "CREATE TABLE playlists (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL)",
        );
        await database.execute(preservationSql);
        await database.run(
          `INSERT INTO ${PRESERVATION_TABLE} (singleton, revision, version, control, recovery_revision, recovery_sha256) VALUES (?, ?, ?, ?, ?, ?)`,
          [EMPTY_METADATA.singleton, EMPTY_METADATA.revision, EMPTY_METADATA.version,
            EMPTY_METADATA.control, EMPTY_METADATA.recovery_revision, EMPTY_METADATA.recovery_sha256],
        );
        await database.execute("PRAGMA user_version = 2");
        await database.execute("COMMIT");
      } catch (cause) {
        await database.execute("ROLLBACK").catch(() => undefined);
        throw cause;
      }
    } else if (version === 1) {
      await checkV1(tables);
      await database.execute("BEGIN IMMEDIATE");
      try {
        await database.execute(preservationSql);
        await database.run(
          `INSERT INTO ${PRESERVATION_TABLE} (singleton, revision, version, control, recovery_revision, recovery_sha256) VALUES (?, ?, ?, ?, ?, ?)`,
          [EMPTY_METADATA.singleton, EMPTY_METADATA.revision, EMPTY_METADATA.version,
            EMPTY_METADATA.control, EMPTY_METADATA.recovery_revision, EMPTY_METADATA.recovery_sha256],
        );
        await database.execute("PRAGMA user_version = 2");
        await database.execute("COMMIT");
      } catch (cause) {
        await database.execute("ROLLBACK").catch(() => undefined);
        throw cause;
      }
    } else if (version !== 2) {
      throw new Error(`Unsupported native library schema ${String(version)}`);
    }
    const finalVersion = (await database.query("PRAGMA user_version"))[0]?.user_version;
    if (finalVersion !== 2) throw new Error("Native library migration did not reach schema v2");
    await checkV2();
  } catch (cause) {
    await database.close().catch(() => undefined);
    throw new LibraryBackupStorageError("Could not open native library", {
      cause,
    });
  }

  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? (() => crypto.randomUUID());
  let tail: Promise<unknown> = Promise.resolve();
  let closed = false;
  let poisoned = false;
  const listeners = new Set<(event: "committed" | "write-failed") => void>();
  function emit(event: "committed" | "write-failed"): void {
    for (const listener of listeners) {
      try { listener(event); } catch { /* Observers cannot change storage outcomes. */ }
    }
  }
  function queue<T>(operation: () => Promise<T>): Promise<T> {
    if (closed)
      return Promise.reject(
        new LibraryBackupStorageError("Native library is closed"),
      );
    const result = tail.then(async () => {
      if (poisoned)
        throw new LibraryBackupStorageError(
          "Native library connection failed; reopen before continuing",
        );
      return operation();
    });
    tail = result.catch(() => undefined);
    return result;
  }
  async function readPreservation(): Promise<PreservationRecord> {
    const rows = await database.query(`SELECT * FROM ${PRESERVATION_TABLE}`);
    if (rows.length !== 1) throw new LibraryBackupStorageError("Native preservation metadata is missing");
    return metadataRecord(rows[0]!);
  }
  async function advanceRevision(): Promise<void> {
    const record = await readPreservation();
    const revision = nextCounter(record.revision, "revision");
    await database.run(`UPDATE ${PRESERVATION_TABLE} SET revision = ? WHERE singleton = 1`, [revision]);
  }
  async function transaction<T>(operation: () => Promise<TransactionResult<T>>): Promise<T> {
    try {
      await database.execute("BEGIN IMMEDIATE");
    } catch (cause) {
      poisoned = true;
      throw cause;
    }
    let committing = false;
    try {
      const result = await operation();
      if (result.contentChanged && !result.revisionAdvanced) await advanceRevision();
      committing = true;
      await database.execute("COMMIT");
      if (result.contentChanged) emit("committed");
      return result.value;
    } catch (cause) {
      // A lost commit response cannot establish whether disk changed. Even if
      // rollback succeeds, this connection must not acknowledge another save.
      if (committing) poisoned = true;
      try {
        await database.execute("ROLLBACK");
      } catch {
        poisoned = true;
      }
      throw cause;
    }
  }
  function payloadQuery(table: Table, where: string): string {
    return `SELECT id, length(CAST(payload AS BLOB)) AS payloadBytes,
      CASE WHEN length(CAST(payload AS BLOB)) <= ? THEN payload ELSE NULL END AS payload
      FROM ${table} ${where}`;
  }
  async function completePayload(row: Record<string, unknown>, table: Table): Promise<string> {
    const bytes = row.payloadBytes;
    if (!Number.isSafeInteger(bytes) || (bytes as number) < 0) {
      throw new LibraryBackupStorageError("Native library returned an invalid payload length");
    }
    const payloadBytes = bytes as number;
    if (payloadBytes <= SMALL_PAYLOAD_BYTES) {
      if (typeof row.payload !== "string" || new TextEncoder().encode(row.payload).byteLength !== payloadBytes) {
        throw new LibraryBackupStorageError("Native library returned an incomplete small payload");
      }
      return row.payload;
    }
    if (row.payload !== null) throw new LibraryBackupStorageError("Native library exceeded its bounded page read");
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let payload = "";
    for (let offset = 0; offset < payloadBytes; offset += BLOB_RANGE_BYTES) {
      const length = Math.min(BLOB_RANGE_BYTES, payloadBytes - offset);
      const rows = await database.query(
        `SELECT hex(substr(CAST(payload AS BLOB), ?, ?)) AS chunk FROM ${table} WHERE id = ?`,
        [offset + 1, length, row.id],
      );
      if (rows.length !== 1) throw new LibraryBackupStorageError("Native library payload disappeared during a read");
      const range = bytesFromHex(rows[0]?.chunk, length);
      payload += decoder.decode(range, { stream: offset + length < payloadBytes });
    }
    payload += decoder.decode();
    if (new TextEncoder().encode(payload).byteLength !== payloadBytes) {
      throw new LibraryBackupStorageError("Native library payload length changed during a read");
    }
    return payload;
  }
  async function readRecordPayload(table: Table, id: string): Promise<string | null> {
    const rows = await database.query(payloadQuery(table, "WHERE id = ?"), [SMALL_PAYLOAD_BYTES, id]);
    if (rows.length === 0) return null;
    if (rows.length !== 1 || rows[0]?.id !== id) throw new LibraryBackupStorageError("Native library returned an invalid record");
    return completePayload(rows[0]!, table);
  }
  async function readPayloadTable<T>(
    table: Table,
    decode: (row: Record<string, unknown>) => T,
    onDecodeError?: (id: string, cause: unknown) => boolean,
  ): Promise<readonly T[]> {
    const result: T[] = [];
    let lastId: string | null = null;
    for (;;) {
      const rows = await database.query(
        `${payloadQuery(table, "WHERE (? IS NULL OR id > ?) ORDER BY id LIMIT ?")}`,
        [SMALL_PAYLOAD_BYTES, lastId, lastId, PAGE_SIZE],
      );
      if (rows.length > PAGE_SIZE) throw new LibraryBackupStorageError("Native library exceeded the bounded page size");
      if (rows.length === 0) break;
      for (const source of rows) {
        if (typeof source.id !== "string" || (lastId !== null && source.id <= lastId)) {
          throw new LibraryBackupStorageError("Native library page order is invalid");
        }
        lastId = source.id;
        const payload = await completePayload(source, table);
        try {
          result.push(decode({ id: source.id, payload }));
        } catch (cause) {
          if (!onDecodeError?.(source.id, cause)) throw cause;
        }
      }
    }
    return Object.freeze(result);
  }
  async function get<T>(
    table: Table,
    id: string,
    decode: (row: Record<string, unknown>) => T,
  ): Promise<T | null> {
    const payload = await readRecordPayload(table, id);
    return payload === null ? null : decode({ id, payload });
  }
  async function insert(
    table: Table,
    id: string,
    payload: unknown,
  ): Promise<void> {
    const serialized = JSON.stringify(payload);
    if (serialized === undefined) throw new Error("Native library record is not serializable");
    const chunks = splitPayload(serialized);
    await database.run(`INSERT INTO ${table} (id, payload) VALUES (?, ?)`, [id, chunks[0]!]);
    for (const chunk of chunks.slice(1)) {
      await database.run(`UPDATE ${table} SET payload = payload || ? WHERE id = ?`, [chunk, id]);
    }
  }
  async function put(
    table: Table,
    id: string,
    payload: unknown,
  ): Promise<void> {
    const serialized = JSON.stringify(payload);
    if (serialized === undefined) throw new Error("Native library record is not serializable");
    const chunks = splitPayload(serialized);
    await database.run(`UPDATE ${table} SET payload = ? WHERE id = ?`, [chunks[0]!, id]);
    for (const chunk of chunks.slice(1)) {
      await database.run(`UPDATE ${table} SET payload = payload || ? WHERE id = ?`, [chunk, id]);
    }
  }
  async function readDrafts(): Promise<readonly LocalClimbDraft[]> {
    return newestFirst([...(await readPayloadTable("climbs", draftRow))]);
  }
  async function readPlaylists(): Promise<readonly LocalPlaylist[]> {
    return newestFirst([...(await readPayloadTable("playlists", playlistRow))]);
  }
  async function assertWritable(): Promise<void> {
    if ((await readPreservation()).recovery !== null) {
      throw new LibraryBackupStorageError("Library recovery verification is pending");
    }
  }
  function draftOperation<T>(operation: () => Promise<T>, mutation = false): Promise<T> {
    return queue(operation).catch((cause: unknown) => {
      if (mutation) emit("write-failed");
      throw translateDraftStorageError(cause, "Could not access native climbs");
    });
  }
  function playlistOperation<T>(operation: () => Promise<T>, mutation = false): Promise<T> {
    return queue(operation).catch((cause: unknown) => {
      if (mutation) emit("write-failed");
      throw translatePlaylistStorageError(
        cause,
        "Could not access native playlists",
      );
    });
  }
  function mutateDraft(
    id: LocalDraftId,
    expected: DraftRevision,
    change: (
      current: LocalClimbDraft,
      updatedAt: string,
    ) => LocalClimbDraft | null,
  ): Promise<LocalClimbDraft | null> {
    return draftOperation(
      () => transaction(async () => {
        await assertWritable();
        const current = await get("climbs", id, draftRow);
        if (!current) throw new DraftNotFoundError(id);
        if (current.revision !== expected)
          throw new DraftConflictError(id, expected, current.revision);
        const result = change(current, now().toISOString());
        if (result) await put("climbs", id, encodeStoredDraft(result));
        else await database.run("DELETE FROM climbs WHERE id = ?", [id]);
        return { value: result, contentChanged: true };
      }),
      true,
    );
  }
  const drafts: LocalDraftRepository = {
    create: (content) =>
      draftOperation(() =>
        transaction(async () => {
          await assertWritable();
          const attempts = options.createId ? 1 : 2;
          for (let attempt = 0; attempt < attempts; attempt += 1) {
            const timestamp = now().toISOString();
            const id = localDraftId(createId());
            const draft = draftFrom(content, {
              id,
              revision: draftRevision(1),
              createdAt: timestamp,
              updatedAt: timestamp,
            });
            if (
              (await database.query("SELECT id FROM climbs WHERE id = ?", [id]))
                .length > 0
            ) {
              if (attempt === attempts - 1)
                throw new DraftConflictError(
                  id,
                  draft.revision,
                  draft.revision,
                );
              continue;
            }
            await insert("climbs", id, encodeStoredDraft(draft));
            return { value: draft, contentChanged: true };
          }
          throw new DraftRepositoryError(
            "unavailable",
            "Could not allocate local climb ID",
          );
        }), true,
      ),
    get: (id) => draftOperation(() => get("climbs", id, draftRow)),
    list: (listOptions = {}) =>
      draftOperation(async () => {
        const records = await readPayloadTable("climbs", draftRow, (id, cause) => {
          if (!listOptions.onUnreadableRecord || !(cause instanceof DraftRepositoryError)
            || (cause.code !== "corrupt-record" && cause.code !== "schema-unsupported")) return false;
          listOptions.onUnreadableRecord({ key: id, message: cause.message });
          return true;
        });
        const result: LocalClimbDraft[] = [];
        for (const draft of records) {
          if (
            (listOptions.installationId === undefined ||
              draft.installationId === listOptions.installationId) &&
            draftInCollection(draft, listOptions.collection ?? "active")
          )
            result.push(draft);
        }
        return newestFirst(result);
      }),
    update: async (id, revision, content) =>
      (await mutateDraft(id, revision, (current, updatedAt) => {
        if (current.trashedAt !== undefined)
          throw new DraftRepositoryError(
            "conflict",
            `Local climb ${id} is in Trash and cannot be updated`,
          );
        return draftFrom(content, {
          id,
          revision: draftRevision(current.revision + 1),
          createdAt: current.createdAt,
          updatedAt,
        });
      }))!,
    trash: async (id, revision) =>
      (await mutateDraft(id, revision, (current, updatedAt) => {
        if (current.trashedAt !== undefined)
          throw new DraftRepositoryError(
            "conflict",
            `Local climb ${id} is already in Trash`,
          );
        return draftFrom(draftContentOf(current), {
          id,
          revision: draftRevision(current.revision + 1),
          createdAt: current.createdAt,
          updatedAt,
          trashedAt: updatedAt,
        });
      }))!,
    restore: async (id, revision) =>
      (await mutateDraft(id, revision, (current, updatedAt) => {
        if (current.trashedAt === undefined)
          throw new DraftRepositoryError(
            "conflict",
            `Local climb ${id} is not in Trash`,
          );
        return draftFrom(draftContentOf(current), {
          id,
          revision: draftRevision(current.revision + 1),
          createdAt: current.createdAt,
          updatedAt,
        });
      }))!,
    deletePermanently: async (id, revision) => {
      await mutateDraft(id, revision, () => null);
    },
  };
  function mutatePlaylist(
    id: PlaylistId,
    expected: PlaylistRevision,
    change: (current: LocalPlaylist) => LocalPlaylist | null,
  ): Promise<LocalPlaylist | null> {
    return playlistOperation(
      () => transaction(async () => {
        await assertWritable();
        const current = await get("playlists", id, playlistRow);
        if (!current) throw new PlaylistNotFoundError(id);
        if (current.revision !== expected)
          throw new PlaylistConflictError(id, expected, current.revision);
        const result = change(current);
        if (result) await put("playlists", id, encodeStoredPlaylist(result));
        else await database.run("DELETE FROM playlists WHERE id = ?", [id]);
        return { value: result, contentChanged: true };
      }),
      true,
    );
  }
  const playlists: LocalPlaylistRepository = {
    create: (content) =>
      playlistOperation(() =>
        transaction(async () => {
          await assertWritable();
          for (
            let attempt = 0;
            attempt < (options.createId ? 1 : 2);
            attempt += 1
          ) {
            const timestamp = now().toISOString();
            const id = playlistId(createId());
            const playlist = playlistFrom(content, {
              id,
              revision: playlistRevision(1),
              createdAt: timestamp,
              updatedAt: timestamp,
            });
            if (
              (
                await database.query("SELECT id FROM playlists WHERE id = ?", [
                  id,
                ])
              ).length > 0
            ) {
              if (options.createId || attempt === 1)
                throw new PlaylistConflictError(
                  id,
                  playlist.revision,
                  playlist.revision,
                );
              continue;
            }
            await insert("playlists", id, encodeStoredPlaylist(playlist));
            return { value: playlist, contentChanged: true };
          }
          throw new Error("Could not allocate playlist ID");
        }), true,
      ),
    get: (id) => playlistOperation(() => get("playlists", id, playlistRow)),
    list: () => playlistOperation(readPlaylists),
    update: async (id, revision, content) =>
      (await mutatePlaylist(id, revision, (current) =>
        playlistFrom(content, {
          id,
          revision: playlistRevision(current.revision + 1),
          createdAt: current.createdAt,
          updatedAt: now().toISOString(),
        }),
      ))!,
    delete: async (id, revision) => {
      await mutatePlaylist(id, revision, () => null);
    },
  };
  async function verifyRecoveryInQueue(): Promise<void> {
    await transaction(async () => {
      const record = await readPreservation();
      if (!record.recovery) return { value: undefined };
      const snapshot: LibrarySnapshot = Object.freeze({
        drafts: await readDrafts(),
        playlists: await readPlaylists(),
      });
      const actual = await sha256(canonicalSnapshot(snapshot));
      if (record.recovery.revision !== record.revision || actual !== record.recovery.sha256) {
        throw new LibraryBackupStorageError("Library recovery verification did not match the committed records");
      }
      await database.run(
        `UPDATE ${PRESERVATION_TABLE} SET recovery_revision = NULL, recovery_sha256 = NULL WHERE singleton = 1 AND revision = ? AND recovery_revision = ? AND recovery_sha256 = ?`,
        [record.revision, record.recovery.revision, record.recovery.sha256],
      );
      return { value: undefined };
    });
  }

  async function restoreSnapshotInQueue(source: LibrarySnapshot): Promise<Readonly<{
    drafts: RestoreBatchResult;
    playlists: RestoreBatchResult;
  }>> {
    try {
      const result = await transaction(async () => {
        await assertWritable();
        if (!Array.isArray(source.drafts) || !Array.isArray(source.playlists)) {
          throw new Error("Invalid library recovery snapshot");
        }
        const drafts = source.drafts.map((input) => draftRow({
          id: input.id,
          payload: JSON.stringify(encodeStoredDraft(input)),
        }));
        const playlists = source.playlists.map((input) => playlistRow({
          id: input.id,
          payload: JSON.stringify(encodeStoredPlaylist(input)),
        }));
        const unique = <T extends SavedRecord>(records: readonly T[], table: Table) => {
          const ids = new Set<string>();
          for (const record of records) {
            if (ids.has(record.id)) throw new Error(`Duplicate ${table} ID ${record.id}`);
            ids.add(record.id);
          }
        };
        unique(drafts, "climbs");
        unique(playlists, "playlists");

        const currentDrafts = await readDrafts();
        const currentPlaylists = await readPlaylists();
        const currentDraftById = new Map(currentDrafts.map((record) => [record.id, record]));
        const currentPlaylistById = new Map(currentPlaylists.map((record) => [record.id, record]));
        const missingDrafts: LocalClimbDraft[] = [];
        const missingPlaylists: LocalPlaylist[] = [];
        let unchangedDrafts = 0;
        let unchangedPlaylists = 0;
        const conflicts: BackupConflict[] = [];

        for (const record of drafts) {
          const current = currentDraftById.get(record.id);
          if (!current) missingDrafts.push(record);
          else if (canonicalDraft(current) === canonicalDraft(record)) unchangedDrafts += 1;
          else conflicts.push({ kind: "climb", id: record.id, name: record.name });
        }
        for (const record of playlists) {
          const current = currentPlaylistById.get(record.id);
          if (!current) missingPlaylists.push(record);
          else if (canonicalPlaylist(current) === canonicalPlaylist(record)) unchangedPlaylists += 1;
          else conflicts.push({ kind: "playlist", id: record.id, name: record.name });
        }
        if (conflicts.length) throw new BackupConflictError(conflicts);

        const counts = Object.freeze({
          drafts: Object.freeze({ added: missingDrafts.length, unchanged: unchangedDrafts }),
          playlists: Object.freeze({ added: missingPlaylists.length, unchanged: unchangedPlaylists }),
        });
        const changed = missingDrafts.length + missingPlaylists.length > 0;
        if (changed) {
          const record = await readPreservation();
          const recoveryRevision = nextCounter(record.revision, "revision");
          const merged: LibrarySnapshot = Object.freeze({
            drafts: Object.freeze([...currentDrafts, ...missingDrafts]),
            playlists: Object.freeze([...currentPlaylists, ...missingPlaylists]),
          });
          const expectedHash = await sha256(canonicalSnapshot(merged));
          for (const draft of missingDrafts) await insert("climbs", draft.id, encodeStoredDraft(draft));
          for (const playlist of missingPlaylists) await insert("playlists", playlist.id, encodeStoredPlaylist(playlist));
          await database.run(
            `UPDATE ${PRESERVATION_TABLE} SET revision = ?, recovery_revision = ?, recovery_sha256 = ? WHERE singleton = 1 AND revision = ?`,
            [recoveryRevision, recoveryRevision, expectedHash, record.revision],
          );
        }
        return { value: Object.freeze({ counts, verify: changed }), contentChanged: changed, revisionAdvanced: changed };
      });
      if (result.verify) {
        try {
          await verifyRecoveryInQueue();
        } catch (cause) {
          throw new LibraryRestoreVerificationError(result.counts.drafts, result.counts.playlists, { cause });
        }
      }
      return result.counts;
    } catch (cause) {
      if (!(cause instanceof LibraryRestoreVerificationError)) emit("write-failed");
      throw cause;
    }
  }

  function restoreSnapshot(source: LibrarySnapshot): Promise<Readonly<{
    drafts: RestoreBatchResult;
    playlists: RestoreBatchResult;
  }>> {
    return queue(() => restoreSnapshotInQueue(source));
  }

  const preservation = Object.freeze({
    read: () => queue(readPreservation),
    capture: () => queue(() => transaction(async () => {
      const record = await readPreservation();
      if (record.recovery) {
        throw new LibraryBackupStorageError("Library recovery verification is pending");
      }
      return {
        value: Object.freeze({
          revision: record.revision,
          snapshot: Object.freeze({ drafts: await readDrafts(), playlists: await readPlaylists() }),
        }),
      };
    })),
    compareAndSet: (version, rawControl) => {
      const control = decodeBackupControl(rawControl);
      safeCounter(version, "control version");
      return queue(() => transaction(async () => {
        await assertWritable();
        const current = await readPreservation();
        if (current.version !== version) return { value: false };
        const nextVersion = nextCounter(current.version, "control version");
        decodePreservationRecord({ revision: current.revision, version: nextVersion, control, recovery: current.recovery });
        await database.run(
          `UPDATE ${PRESERVATION_TABLE} SET version = ?, control = ? WHERE singleton = 1 AND version = ?`,
          [nextVersion, JSON.stringify(control), version],
        );
        return { value: true };
      }));
    },
    verifyRecovery: () => queue(verifyRecoveryInQueue),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } satisfies LibraryPreservation);

  const backupStore: LibraryBackupStore = {
    readSnapshot: () => queue(() => transaction(async () => ({
      value: Object.freeze({ drafts: await readDrafts(), playlists: await readPlaylists() }),
    }))),
    readDrafts: () => queue(readDrafts),
    readPlaylists: () => queue(readPlaylists),
    restoreMissingDrafts: async (records) =>
      (await restoreSnapshot({ drafts: records, playlists: [] })).drafts,
    restoreMissingPlaylists: async (records) =>
      (await restoreSnapshot({ drafts: [], playlists: records })).playlists,
    restoreMissingSnapshot: restoreSnapshot,
  };
  return Object.freeze({
    drafts,
    playlists,
    backupStore,
    preservation,
    close: () => {
      if (closed) return;
      closed = true;
      // Admit no new work, but let every already admitted transaction settle first.
      tail = tail.then(() => database.close());
      void tail.catch(() => undefined);
    },
  });
}

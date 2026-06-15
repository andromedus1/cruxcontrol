/**
 * Worker-agnostic SQLite engine for the local Kilter catalog.
 *
 * Knows nothing about Workers, OPFS, or Comlink — that is the host's job
 * ({@link ./catalog.worker.ts}). It takes an already-constructed wa-sqlite VFS
 * binding, opens a connection over it, and runs read queries, mapping result
 * columns to {@link Row} objects keyed by column name.
 *
 * The VFS is the single swappable seam: the browser host injects an OPFS
 * sync-access-handle VFS; the Node test injects an in-memory VFS. The SQL path
 * exercised in both is identical, which is what keeps the CI test honest.
 */

import * as SQLite from 'wa-sqlite';
import type { Row, SqlValue } from '../port.ts';
import { CatalogQueryError } from './errors.ts';

/**
 * A wa-sqlite VFS instance paired with the name to open it under.
 *
 * `name` must equal the VFS's own registered name (`vfs.name`); it is the
 * `zVfs` argument passed to `open_v2`.
 */
export interface VfsBinding {
  /** A constructed wa-sqlite VFS (e.g. an OPFS or in-memory VFS). */
  vfs: SQLiteVFS;
  /** The VFS name to open the database under — must equal `vfs.name`. */
  name: string;
}

/** Default open flags: read-only, matching the catalog's runtime contract. */
const DEFAULT_OPEN_FLAGS = SQLite.SQLITE_OPEN_READONLY;

/**
 * Opens a wa-sqlite connection over an injected VFS and runs read queries.
 *
 * Construct with {@link CatalogDb.open}; never `new CatalogDb(...)` directly.
 */
export class CatalogDb {
  private readonly sqlite3: SQLiteAPI;
  private db: number | null;

  private constructor(sqlite3: SQLiteAPI, db: number) {
    this.sqlite3 = sqlite3;
    this.db = db;
  }

  /**
   * Open a catalog connection over `binding`'s VFS.
   *
   * Registers the VFS (idempotent if already registered under the same name),
   * then opens `dbFilename`. Defaults to `SQLITE_OPEN_READONLY`; the Node test
   * passes read-write flags to seed the fixture before querying.
   *
   * @param dbFilename Database filename within the VFS.
   * @param binding    The VFS instance + its registered name.
   * @param flags      `open_v2` flags. Defaults to `SQLITE_OPEN_READONLY`.
   */
  static async open(
    dbFilename: string,
    binding: VfsBinding,
    flags: number = DEFAULT_OPEN_FLAGS,
  ): Promise<CatalogDb> {
    const sqlite3 = await createSqliteApi();
    registerVfsOnce(sqlite3, binding);
    const db = await sqlite3.open_v2(dbFilename, flags, binding.name);
    return new CatalogDb(sqlite3, db);
  }

  /** True while the connection is open. Flips to false after {@link close}. */
  isReady(): boolean {
    return this.db !== null;
  }

  /**
   * Execute a read-only statement and return its rows.
   *
   * Binds `params` positionally to the `?` placeholders, steps the result set,
   * and maps each row to a {@link Row} keyed by column name with SQLite types
   * mapped to {@link SqlValue} (TEXT→string, INTEGER/REAL→number, NULL→null,
   * BLOB→Uint8Array).
   *
   * @throws CatalogQueryError carrying the failing `sql` on any SQLite error,
   *         or if the connection is closed.
   */
  async query<T extends Row = Row>(sql: string, params?: readonly SqlValue[]): Promise<T[]> {
    const db = this.db;
    if (db === null) {
      throw new CatalogQueryError('query on a closed CatalogDb', sql);
    }

    const sqlite3 = this.sqlite3;
    const rows: T[] = [];
    let stmt: number | null = null;
    try {
      for await (const prepared of sqlite3.statements(db, sql)) {
        stmt = prepared;
        if (params && params.length > 0) {
          sqlite3.bind_collection(prepared, params as SQLiteCompatibleType[]);
        }
        const columns = sqlite3.column_names(prepared);
        while ((await sqlite3.step(prepared)) === SQLite.SQLITE_ROW) {
          rows.push(this.readRow<T>(prepared, columns));
        }
      }
      return rows;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new CatalogQueryError(`catalog query failed: ${message}`, sql, {
        cause,
      });
    } finally {
      // `statements()` finalizes each statement at the end of its iteration,
      // but if we break out early via a throw mid-loop the current statement
      // may still be live — finalize it defensively. finalize() never throws.
      if (stmt !== null) {
        sqlite3.finalize(stmt);
      }
    }
  }

  /** Close the connection and release its resources. Idempotent. */
  async close(): Promise<void> {
    const db = this.db;
    if (db === null) {
      return;
    }
    this.db = null;
    await this.sqlite3.close(db);
  }

  /** Read the current row of `stmt` into a {@link Row}, keyed by column name. */
  private readRow<T extends Row>(stmt: number, columns: string[]): T {
    const sqlite3 = this.sqlite3;
    const row: Row = {};
    for (let i = 0; i < columns.length; i++) {
      row[columns[i]] = mapColumnValue(sqlite3, stmt, i);
    }
    return row as T;
  }
}

/**
 * Map a single column of the current row to a {@link SqlValue}.
 *
 * `column()` already returns a typed JS value, but we switch on
 * `column_type` to map NULL → `null` explicitly and to copy BLOB bytes out of
 * volatile WASM memory. Integers outside the safe-integer range come back as
 * BigInt; we narrow those to `number` since the catalog's integer columns
 * (angles, counts, ids) are well within range.
 */
function mapColumnValue(sqlite3: SQLiteAPI, stmt: number, i: number): SqlValue {
  switch (sqlite3.column_type(stmt, i)) {
    case SQLite.SQLITE_NULL:
      return null;
    case SQLite.SQLITE_INTEGER:
    case SQLite.SQLITE_FLOAT: {
      const value = sqlite3.column(stmt, i);
      return typeof value === 'bigint' ? Number(value) : (value as number);
    }
    case SQLite.SQLITE_TEXT:
      return sqlite3.column(stmt, i) as string;
    case SQLite.SQLITE_BLOB: {
      // column_blob references volatile WASM memory — copy it out.
      const blob = sqlite3.column(stmt, i) as Uint8Array;
      return new Uint8Array(blob);
    }
    default:
      return null;
  }
}

/**
 * Register a VFS under its name, once per API instance.
 *
 * wa-sqlite throws if a VFS name is already registered, but registration is
 * idempotent within one sqlite3 module — so we track which names this API has
 * seen and skip duplicates. (The browser host opens once; this guard mainly
 * keeps multiple opens against a shared API instance — e.g. across tests —
 * safe.)
 */
function registerVfsOnce(sqlite3: SQLiteAPI, binding: VfsBinding): void {
  let names = registeredVfsNames.get(sqlite3);
  if (!names) {
    names = new Set();
    registeredVfsNames.set(sqlite3, names);
  }
  if (names.has(binding.name)) {
    return;
  }
  sqlite3.vfs_register(binding.vfs, false);
  names.add(binding.name);
}

/** Per-API set of VFS names already registered, to avoid duplicate registers. */
const registeredVfsNames = new WeakMap<SQLiteAPI, Set<string>>();

/** Lazily-instantiated wa-sqlite API, shared across all CatalogDb instances. */
let sqliteApiPromise: Promise<SQLiteAPI> | null = null;

/**
 * Build (once) the wa-sqlite API from the synchronous WASM build.
 *
 * The synchronous build pairs with synchronous VFSes — the OPFS
 * sync-access-handle VFS in the browser and the in-memory VFS in Node. In Node
 * the Emscripten loader cannot `fetch()` the `.wasm` over a `file://` URL, so
 * the host supplies the wasm bytes via {@link configureSqliteWasm} before the
 * first open. In the browser, Vite serves the `.wasm` and the default loader
 * resolves it relative to the module URL.
 */
async function createSqliteApi(): Promise<SQLiteAPI> {
  if (!sqliteApiPromise) {
    sqliteApiPromise = (async () => {
      const { default: SQLiteESMFactory } = await import('wa-sqlite/dist/wa-sqlite.mjs');
      const config = wasmBinary ? { wasmBinary } : undefined;
      const module = await SQLiteESMFactory(config);
      return SQLite.Factory(module);
    })();
  }
  return sqliteApiPromise;
}

/** WASM bytes injected by a host that cannot fetch the `.wasm` (i.e. Node). */
let wasmBinary: Uint8Array | ArrayBuffer | undefined;

/**
 * Supply the wa-sqlite WASM bytes directly, for environments where the
 * Emscripten loader cannot fetch the asset (Node/Vitest). Must be called before
 * the first {@link CatalogDb.open}. No-op in the browser, where Vite serves it.
 */
export function configureSqliteWasm(bytes: Uint8Array | ArrayBuffer): void {
  wasmBinary = bytes;
}

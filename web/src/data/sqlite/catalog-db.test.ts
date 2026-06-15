// @vitest-environment node
//
// KEYSTONE TEST: real wa-sqlite running in Node over an in-memory VFS, seeded
// from the committed SQL fixture. This is the only place the real SQL engine +
// the adapter's row-mapping + error paths run in CI (decision 2 in the feature
// body). The OPFS persistence layer and the Worker/Comlink wiring cannot run in
// Node/jsdom and are verified manually / by a later e2e pass — see
// sqlite-catalog-port.test.ts for the boundary-level coverage that IS possible.
//
// Runs under the `node` environment (not the project default jsdom) so the
// Emscripten WASM module loads cleanly; the wasm bytes are read from disk and
// injected via configureSqliteWasm because Node's fetch() can't read file://.

import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { MemoryVFS } from 'wa-sqlite/src/examples/MemoryVFS.js';
import * as SQLite from 'wa-sqlite';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Row } from '../port.ts';
import { CatalogDb, configureSqliteWasm, type VfsBinding } from './catalog-db.ts';
import { CatalogQueryError } from './errors.ts';

const FIXTURE_URL = new URL('./__fixtures__/catalog-fixture.sql', import.meta.url);

/** Read the committed seed SQL. */
async function loadFixtureSql(): Promise<string> {
  return readFile(FIXTURE_URL, 'utf8');
}

// One in-memory VFS shared by the suite (a VFS name registers once per API
// instance). Per-test isolation comes from a unique DB filename each call —
// MemoryVFS keys files by name, so distinct filenames are independent databases.
const sharedVfs = new MemoryVFS();
// The example VFS impls intentionally diverge from the strict SQLiteVFS
// interface signatures (e.g. xRead's pData shape); cast at the seam.
const binding: VfsBinding = {
  vfs: sharedVfs as unknown as SQLiteVFS,
  name: sharedVfs.name,
};
let dbCounter = 0;

/**
 * Open a CatalogDb read-write over a fresh in-memory database file, seed the
 * fixture, and return it.
 */
async function openSeededDb(): Promise<CatalogDb> {
  const db = await CatalogDb.open(
    `catalog-test-${dbCounter++}.sqlite3`,
    binding,
    SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_READWRITE,
  );
  // Seed via query(): the fixture is DDL+DML producing no rows.
  await db.query(await loadFixtureSql());
  return db;
}

beforeAll(async () => {
  // import.meta.resolve is unavailable under Vite's SSR transform; resolve the
  // wasm asset via Node's require resolution instead.
  const require = createRequire(import.meta.url);
  const wasmPath = require.resolve('wa-sqlite/dist/wa-sqlite.wasm');
  configureSqliteWasm(await readFile(wasmPath));
});

describe('CatalogDb', () => {
  it('opens a ready instance over an in-memory VFS', async () => {
    const db = await openSeededDb();
    expect(db.isReady()).toBe(true);
    await db.close();
  });

  it('runs a parameterized SELECT and returns typed rows', async () => {
    const db = await openSeededDb();
    const rows = await db.query<Row>(
      'SELECT climb_uuid, angle, ascensionist_count, quality_average, benchmark_difficulty FROM climb_stats WHERE angle = ? ORDER BY climb_uuid',
      [40],
    );
    await db.close();

    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      climb_uuid: 'climb-a',
      angle: 40,
      ascensionist_count: 1240,
      quality_average: 2.9,
      benchmark_difficulty: 18.0,
    });
    // Value typing: TEXT→string, INTEGER→number, REAL→number.
    expect(typeof rows[0].climb_uuid).toBe('string');
    expect(typeof rows[0].angle).toBe('number');
    expect(typeof rows[0].quality_average).toBe('number');
  });

  it('maps a SQL NULL to JS null', async () => {
    const db = await openSeededDb();
    const rows = await db.query<Row>(
      'SELECT benchmark_difficulty FROM climb_stats WHERE climb_uuid = ? AND angle = ?',
      ['climb-b', 40],
    );
    await db.close();
    expect(rows).toEqual([{ benchmark_difficulty: null }]);
  });

  it('joins climbs to climb_stats (the catalog read shape)', async () => {
    const db = await openSeededDb();
    const rows = await db.query<Row>(
      `SELECT c.name, s.display_difficulty
       FROM climbs c
       JOIN climb_stats s ON s.climb_uuid = c.uuid
       WHERE s.angle = ? AND c.is_listed = 1
       ORDER BY s.display_difficulty`,
      [40],
    );
    await db.close();
    expect(rows.map((r) => r.name)).toEqual(['Footwork Drill', 'Crimp Ladder', 'Sloper Slap']);
  });

  it('throws CatalogQueryError carrying the offending SQL on a bad query', async () => {
    const db = await openSeededDb();
    const sql = 'SELECT * FROM nonexistent_table';
    await expect(db.query(sql)).rejects.toMatchObject({
      name: 'CatalogQueryError',
      sql,
    });
    await expect(db.query(sql)).rejects.toBeInstanceOf(CatalogQueryError);
    await db.close();
  });

  it('close() flips isReady() to false and rejects further queries', async () => {
    const db = await openSeededDb();
    await db.close();
    expect(db.isReady()).toBe(false);
    await expect(db.query('SELECT 1')).rejects.toBeInstanceOf(CatalogQueryError);
  });

  it('close() is idempotent', async () => {
    const db = await openSeededDb();
    await db.close();
    await expect(db.close()).resolves.toBeUndefined();
  });
});

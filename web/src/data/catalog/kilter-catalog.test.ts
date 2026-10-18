// @vitest-environment node
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { MemoryVFS } from 'wa-sqlite/src/examples/MemoryVFS.js';
import * as SQLite from 'wa-sqlite';
import type { CatalogPort, Row, SqlValue } from '../port.ts';
import { CatalogDb, configureSqliteWasm, type VfsBinding } from '../sqlite/catalog-db.ts';
import { kilterFullride7x10Definition as definition } from '../../domain/boards/definitions/kilter-fullride-7x10.ts';
import { providerId, providerSourceId } from '../../domain/boards/identity.ts';
import type { CatalogClimbQuery, CatalogCursor } from '../../catalog/types.ts';
import { CatalogReadError } from '../../catalog/types.ts';
import { createKilterCatalog } from './kilter-catalog.ts';

const fixtureUrl = new URL('./__fixtures__/fullride-catalog.sql', import.meta.url);
const wasmVfs = new MemoryVFS();
const vfsBinding: VfsBinding = { vfs: wasmVfs as unknown as SQLiteVFS, name: wasmVfs.name };
let dbIndex = 0;

async function openDb(): Promise<CatalogDb> {
  const db = await CatalogDb.open(
    `fullride-catalog-test-${dbIndex++}.sqlite3`,
    vfsBinding,
    SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_READWRITE,
  );
  await db.query(await readFile(fixtureUrl, 'utf8'));
  return db;
}

function portFor(db: CatalogDb): CatalogPort {
  return {
    query: db.query.bind(db),
    isReady: async () => db.isReady(),
    close: () => db.close(),
  };
}

const provenance = Object.freeze({
  source: 'synthetic fixture', snapshotId: 'fullride-fixture-v1', retrievedAt: null, coverage: null,
});

function validQueryRow(uuid: string): Row {
  return {
    source_uuid: uuid,
    source_name: 'Synthetic row',
    source_frames: 'p4117r42',
    source_setter: 'fixture',
    source_description: '',
    source_layout_id: 8,
    source_frames_count: 1,
    source_is_draft: 0,
    source_is_listed: 1,
    stat_angle: 40,
    stat_display_difficulty: 12,
    stat_difficulty_average: 12,
    stat_benchmark_difficulty: null,
    stat_ascensionist_count: 1,
    stat_quality_average: 2,
    grade_label: 'V1',
  };
}

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  configureSqliteWasm(await readFile(require.resolve('wa-sqlite/dist/wa-sqlite.wasm')));
});

describe('Kilter catalog queries', () => {
  it('returns null only for the requested angle when an existing climb has statistics at 45° alone', async () => {
    const db = await openDb();
    try {
      await db.query(`
        INSERT INTO climbs VALUES ('only-at-45', 8, 'fixture', 'Other angle route', '', 'p4117r42', 1, 0, 1);
        INSERT INTO climb_stats VALUES ('only-at-45', 45, 12, 12, NULL, 1, 2)`);
      const adapter = createKilterCatalog(portFor(db), definition, provenance);
      const id = { provider: providerId('kilter'), sourceId: providerSourceId('only-at-45'), layoutRevision: definition.layoutRevision };
      expect(await adapter.get(id, 45)).toMatchObject({ status: 'ready', value: { name: 'Other angle route', angle: 45 } });
      expect(await adapter.get(id, 40)).toEqual({ status: 'ready', value: null });
      expect(await db.query('SELECT angle FROM climb_stats WHERE climb_uuid = ?', [id.sourceId])).toEqual([{ angle: 45 }]);
    } finally {
      await db.close();
    }
  });

  it('filters through real SQLite and preserves grades, metadata, and source rows', async () => {
    const db = await openDb();
    const port = portFor(db);
    const before = await port.query('SELECT * FROM climbs ORDER BY uuid');
    const adapter = createKilterCatalog(port, definition, provenance);
    const result = await adapter.query({ angle: 40, minGrade: 18, maxGrade: 18 });
    const filtered = result.status === 'ready' ? result.value.climbs : [];
    expect(filtered.map(({ providerClimbId }) => providerClimbId.sourceId)).toEqual(['a-good']);
    expect(filtered[0]).toMatchObject({
      name: 'Amber move', grade: 'V4', gradeValue: 18, angle: 40,
      nativeGrades: { display: 18.4, community: 17.7, benchmark: 0 },
      statistics: { ascentCount: 123, quality: 3.25 },
      setter: 'fixture setter', description: 'Synthetic route',
    });
    const sameRecord = await adapter.get({
      provider: providerId('kilter'), sourceId: providerSourceId('a-good'),
      layoutRevision: definition.layoutRevision,
    }, 40);
    expect(sameRecord).toEqual({ status: 'ready', value: filtered[0] });
    expect(await adapter.get({
      provider: providerId('kilter'), sourceId: providerSourceId('a-good'),
      layoutRevision: definition.layoutRevision,
    }, 65)).toEqual({ status: 'ready', value: null });
    const noLabel = await adapter.get({
      provider: providerId('kilter'), sourceId: providerSourceId('b-no-label'),
      layoutRevision: definition.layoutRevision,
    }, 40);
    expect(noLabel).toMatchObject({ status: 'ready', value: { gradeValue: 11, nativeGrades: { benchmark: null } } });
    expect(noLabel.status === 'ready' && noLabel.value).not.toHaveProperty('grade');
    expect(await port.query('SELECT * FROM climbs ORDER BY uuid')).toEqual(before);
    await db.close();
  });

  it('treats wildcard and SQL-looking search text literally', async () => {
    const db = await openDb();
    const adapter = createKilterCatalog(portFor(db), definition, provenance);
    const literal = await adapter.query({ angle: 40, name: "% _" });
    expect(literal.status === 'ready' ? literal.value.climbs.map(({ name }) => name) : []).toEqual([
      "Quotes ' % _ literal",
    ]);
    const injection = await adapter.query({ angle: 40, name: "%' OR 1=1 --" });
    expect(injection.status === 'ready' ? injection.value.climbs : []).toEqual([]);
    await db.close();
  });

  it('paginates after excluded rows and keeps keyset continuation through empty pages', async () => {
    const db = await openDb();
    for (let i = 0; i < 260; i += 1) {
      await db.query(
        `INSERT INTO climbs VALUES (?, 8, 'fixture', 'Rejected', '', 'p999999r42', 1, 0, 1);
         INSERT INTO climb_stats VALUES (?, 40, 12, 12, NULL, 1, 2)`,
        [`m-invalid-${String(i).padStart(3, '0')}`, `m-invalid-${String(i).padStart(3, '0')}`],
      );
    }
    await db.query(
      `INSERT INTO climbs VALUES ('z-valid', 8, 'fixture', 'Rejected valid route', '', 'p4117r42', 1, 0, 1);
       INSERT INTO climb_stats VALUES ('z-valid', 40, 12, 12, NULL, 1, 2)`,
    );
    const adapter = createKilterCatalog(portFor(db), definition, provenance);
    const first = await adapter.query({ angle: 40, name: 'Rejected', limit: 1 });
    expect(first).toMatchObject({ status: 'ready', value: { climbs: [], excludedCount: 250 } });
    if (first.status !== 'ready') throw new Error('expected ready result');
    expect(first.value.nextCursor).toBeTruthy();
    const changedFilter = adapter.query({ angle: 40, name: 'changed', limit: 1, cursor: first.value.nextCursor! });
    await expect(changedFilter).rejects.toBeInstanceOf(TypeError);
    const replacement = createKilterCatalog(portFor(db), definition, { ...provenance, snapshotId: 'fixture-v2' });
    await expect(replacement.query({ angle: 40, name: 'Rejected', limit: 1, cursor: first.value.nextCursor! }))
      .rejects.toBeInstanceOf(TypeError);
    const second = await adapter.query({ angle: 40, name: 'Rejected', limit: 1, cursor: first.value.nextCursor! });
    expect(second).toMatchObject({
      status: 'ready',
      value: { climbs: [{ name: 'Rejected valid route' }], excludedCount: 10, nextCursor: null },
    });
    if (second.status !== 'ready') throw new Error('expected ready result');
    await db.close();
  });

  it('bounds candidate reads and enumerates each compatible climb once across pages', async () => {
    const db = await openDb();
    for (let i = 0; i < 260; i += 1) {
      const id = `z-good-${String(i).padStart(3, '0')}`;
      await db.query(
        `INSERT INTO climbs VALUES (?, 8, 'fixture', 'Many', '', 'p4117r42', 1, 0, 1);
         INSERT INTO climb_stats VALUES (?, 40, 12, 12, NULL, 1, 2)`, [id, id],
      );
    }
    const adapter = createKilterCatalog(portFor(db), definition, provenance);
    const found: string[] = [];
    let cursor: CatalogClimbQuery['cursor'];
    let passes = 0;
    do {
      const page = await adapter.query({ angle: 40, name: 'Many', limit: 100, cursor });
      if (page.status !== 'ready') throw new Error('expected ready result');
      found.push(...page.value.climbs.map(({ providerClimbId }) => providerClimbId.sourceId));
      cursor = page.value.nextCursor ?? undefined;
      passes += 1;
    } while (cursor);
    expect(passes).toBe(3);
    expect(found).toHaveLength(260);
    expect(new Set(found).size).toBe(260);
    await db.close();
  });

  it('rejects invalid filters and stale cursors before querying', async () => {
    let calls = 0;
    const queries: { sql: string; params: readonly SqlValue[] }[] = [];
    const recording: CatalogPort = {
      async query<T extends Row = Row>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
        calls += 1;
        queries.push({ sql, params });
        return [validQueryRow('synthetic-a'), validQueryRow('synthetic-b')] as unknown as T[];
      },
      async isReady() { return true; },
      async close() {},
    };
    const adapter = createKilterCatalog(recording, definition, provenance);
    await expect(adapter.query({ angle: 41 })).rejects.toBeInstanceOf(RangeError);
    await expect(adapter.query({ angle: 40, name: 'x'.repeat(201) })).rejects.toBeInstanceOf(RangeError);
    await expect(adapter.query({ angle: 40, minGrade: 8.5 })).rejects.toBeInstanceOf(RangeError);
    await expect(adapter.query({ angle: 40, minGrade: 10, maxGrade: 9 })).rejects.toBeInstanceOf(RangeError);
    const page = await adapter.query({ angle: 40, limit: 1 });
    if (page.status !== 'ready') throw new Error('expected ready result');
    const cursor = page.value.nextCursor;
    expect(cursor).toBeTruthy();
    const validCursor = cursor!;
    await expect(adapter.query({ angle: 40, name: 'changed', cursor: validCursor })).rejects.toBeInstanceOf(TypeError);
    const cursorData = JSON.parse(validCursor) as Record<string, unknown>;
    const malformedCursors = [
      'not-json',
      'x'.repeat(4097),
      JSON.stringify({ ...cursorData, version: 2 }),
      JSON.stringify({ ...cursorData, lastId: ' ' }),
    ];
    for (const malformed of malformedCursors) {
      await expect(adapter.query({ angle: 40, cursor: malformed as CatalogCursor })).rejects.toBeInstanceOf(TypeError);
    }
    const replacement = createKilterCatalog(recording, definition, { ...provenance, snapshotId: 'fixture-v2' });
    await expect(replacement.query({ angle: 40, cursor: validCursor })).rejects.toBeInstanceOf(TypeError);
    expect(calls).toBe(1);
    expect(queries[0]!.sql).toContain('LIMIT ?');
    expect(queries[0]!.params.at(-1)).toBe(251);
  });

  it('isolates provider and revision identities and distinguishes unavailable from failures', async () => {
    let calls = 0;
    const empty: CatalogPort = {
      async query<T extends Row = Row>(): Promise<T[]> { calls += 1; return []; },
      async isReady() { return false; },
      async close() {},
    };
    const adapter = createKilterCatalog(empty, definition, provenance);
    expect(await adapter.query({ angle: 40 })).toEqual({ status: 'unavailable' });
    expect(await adapter.get({ provider: providerId('other'), sourceId: providerSourceId('x'), layoutRevision: definition.layoutRevision }, 40))
      .toEqual({ status: 'unavailable' });
    expect(calls).toBe(0);

    const readyEmpty: CatalogPort = { ...empty, async isReady() { return true; } };
    const readyAdapter = createKilterCatalog(readyEmpty, definition, provenance);
    const wrongId = await readyAdapter.get({ provider: providerId('other'), sourceId: providerSourceId('x'), layoutRevision: definition.layoutRevision }, 40);
    expect(wrongId).toEqual({ status: 'ready', value: null });
    const wrongRevision = await readyAdapter.get({
      provider: providerId('kilter'), sourceId: providerSourceId('x'),
      layoutRevision: 'old-layout' as never,
    }, 40);
    expect(wrongRevision).toEqual({ status: 'ready', value: null });
    expect(calls).toBe(0);

    const broken: CatalogPort = {
      async query() { throw new Error('schema missing'); },
      async isReady() { return true; },
      async close() {},
    };
    await expect(createKilterCatalog(broken, definition, provenance).query({ angle: 40 }))
      .rejects.toBeInstanceOf(CatalogReadError);
    await expect(createKilterCatalog(broken, definition, provenance).query({ angle: 40 }))
      .rejects.toMatchObject({ cause: expect.any(Error) });
  });

  it('returns listed grade choices and rejects unsupported definitions/provenance', async () => {
    const db = await openDb();
    const adapter = createKilterCatalog(portFor(db), definition, provenance);
    expect(await adapter.grades()).toEqual({ status: 'ready', value: [
      { value: 10, label: 'V0' }, { value: 12, label: 'V1' }, { value: 18, label: 'V4' },
      { value: 20, label: 'V5' }, { value: 22, label: 'V6' }, { value: 24, label: 'V7' },
    ] });
    await expect(Promise.resolve().then(() => createKilterCatalog(portFor(db), { ...definition, layoutRevision: 'other' as never }, provenance)))
      .rejects.toBeInstanceOf(TypeError);
    expect(() => createKilterCatalog(portFor(db), definition, { ...provenance, snapshotId: ' ' }))
      .toThrow(TypeError);
    await db.close();
  });
});

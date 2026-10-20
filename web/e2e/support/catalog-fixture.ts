import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

export interface SyntheticCatalogSnapshot {
  manifest: {
    schemaVersion: 2;
    version: number;
    board: 'kilter-fullride-7x10';
    file: string;
    compression: 'gzip';
    sha256: string;
    bytesGzipped: number;
    bytesRaw: number;
    generatedOn: string;
    source: 'legacy-aurora-kilter';
    sourceDataThrough: null;
    generatedFrom: string;
    filter: 'layout_id=8';
  };
  compressed: Buffer;
}

/**
 * `extraRoutes` adds compatible "Synthetic extra NN" routes at 40° whose ratings sort
 * them after the base route in order, for multi-page browsing checks.
 */
export function createSyntheticCatalogSnapshots(
  { extraRoutes = 0 }: { extraRoutes?: number } = {},
): { snapshots: SyntheticCatalogSnapshot[]; dispose(): void } {
  const directory = mkdtempSync(join(tmpdir(), 'crux-catalog-bootstrap-'));
  const sqlPath = join(process.cwd(), 'src/data/sqlite/__fixtures__/catalog-bootstrap.sql');
  const sql = readFileSync(sqlPath, 'utf8');
  const python = [
    'import sqlite3, sys',
    'db = sqlite3.connect(sys.argv[1])',
    'db.executescript(sys.stdin.read())',
    "db.execute('UPDATE climbs SET name=? WHERE uuid=?', (sys.argv[2], 'synthetic-valid'))",
    'for i in range(1, int(sys.argv[3]) + 1):',
    "    uuid = 'synthetic-extra-%02d' % i",
    "    db.execute('INSERT INTO climbs VALUES (?, 8, ?, ?, ?, ?, 1, 0, 1)', (uuid, 'fixture setter', 'Synthetic extra %02d' % i, 'Fixture description', 'p4117r42'))",
    "    db.execute('INSERT INTO climb_stats VALUES (?, 40, 12, 11.5, NULL, 5, ?)', (uuid, round(2.5 - i * 0.01, 2)))",
    'db.commit()',
    "db.execute('PRAGMA journal_mode=DELETE')",
    'db.close()',
  ].join('\n');
  const snapshots = [1, 2].map((version) => {
    const databasePath = join(directory, `catalog-${version}.sqlite3`);
    execFileSync('python3', ['-c', python, databasePath, `Synthetic route v${version}`, String(extraRoutes)], {
      input: sql,
      stdio: ['pipe', 'ignore', 'inherit'],
    });
    const raw = readFileSync(databasePath);
    const compressed = gzipSync(raw, { level: 9, mtime: 0 });
    const digest = createHash('sha256').update(compressed).digest('hex');
    return {
      manifest: {
        schemaVersion: 2 as const,
        version,
        board: 'kilter-fullride-7x10' as const,
        file: `kilter-7x10.v${version}.db.gz`,
        compression: 'gzip' as const,
        sha256: digest,
        bytesGzipped: compressed.byteLength,
        bytesRaw: raw.byteLength,
        generatedOn: '2026-10-09',
        source: 'legacy-aurora-kilter' as const,
        sourceDataThrough: null,
        generatedFrom: 'synthetic playwright SQLite fixture',
        filter: 'layout_id=8' as const,
      },
      compressed,
    };
  });
  return {
    snapshots,
    dispose() { rmSync(directory, { recursive: true, force: true }); },
  };
}

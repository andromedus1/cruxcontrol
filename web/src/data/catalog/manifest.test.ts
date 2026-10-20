// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CatalogBootstrapError } from './errors.ts';
import { parseCatalogManifest, type CatalogManifest } from './manifest.ts';

const valid: CatalogManifest = {
  schemaVersion: 2,
  version: 1,
  board: 'kilter-fullride-7x10',
  file: 'kilter-7x10.v1.db.gz',
  compression: 'gzip',
  sha256: 'a'.repeat(64),
  bytesGzipped: 512,
  bytesRaw: 4096,
  generatedOn: '2026-06-14',
  source: 'legacy-aurora-kilter',
  sourceDataThrough: null,
  generatedFrom: 'synthetic source',
  filter: 'layout_id=8',
};

const v3Example = JSON.parse(
  readFileSync(new URL('./__fixtures__/manifest-v3.example.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

function expectRejected(input: unknown, code: string = 'manifest'): void {
  try {
    parseCatalogManifest(input);
    throw new Error('expected the invalid manifest to be rejected');
  } catch (cause) {
    expect(cause).toBeInstanceOf(CatalogBootstrapError);
    expect(cause).toMatchObject({ code });
  }
}

describe('parseCatalogManifest', () => {
  it('keeps build date separate from unknown source freshness', () => {
    expect(parseCatalogManifest(valid)).toMatchObject({
      generatedOn: '2026-06-14',
      sourceDataThrough: null,
      source: 'legacy-aurora-kilter',
    });
  });

  it.each([
    { input: { ...valid, schemaVersion: 1 }, label: 'manifest schema' },
    { input: { ...valid, source: 'current-kilter' }, label: 'source' },
    { input: { ...valid, source: 'boardsesh-kilter' }, label: 'Boardsesh source on schema 2' },
    { input: { ...valid, generatedOn: '2026-02-30' }, label: 'build date' },
    { input: { ...valid, sourceDataThrough: 'unknown' }, label: 'freshness date' },
    { input: { ...valid, file: '../kilter-7x10.v1.db.gz' }, label: 'path traversal' },
    { input: { ...valid, file: 'kilter-7x10.v0.db.gz' }, label: 'zero version in file name' },
    { input: { ...valid, sha256: 'A'.repeat(64) }, label: 'digest format' },
    { input: { ...valid, bytesGzipped: 8 * 1024 * 1024 + 1 }, label: 'compressed limit', code: 'size' },
    { input: { ...valid, bytesRaw: 32 * 1024 * 1024 + 1 }, label: 'raw limit', code: 'size' },
    { input: { ...valid, generatedFrom: 'x'.repeat(513) }, label: 'provenance bound' },
  ])('rejects invalid $label', ({ input, code }) => {
    expectRejected(input, code);
  });
});

describe('parseCatalogManifest schema 3', () => {
  it('parses the committed Boardsesh example, including its reconciliation fields', () => {
    const manifest = parseCatalogManifest(v3Example);
    expect(manifest).toEqual(v3Example);
    expect(manifest.schemaVersion).toBe(3);
    if (manifest.schemaVersion !== 3) throw new Error('expected schema 3');
    expect(manifest.qualityScale).toEqual({ min: 0, max: 5 });
    expect(Object.isFrozen(manifest)).toBe(true);
    expect(Object.isFrozen(manifest.qualityScale)).toBe(true);
    expect(Object.isFrozen(manifest.sourceWatermarks)).toBe(true);
  });

  it('reports reconciliation fields as unknown when a schema-3 manifest predates them', () => {
    const { removedUpstreamCount: _count, changes: _changes, ...older } = v3Example as Record<string, unknown>;
    const manifest = parseCatalogManifest(older);
    expect(manifest).toMatchObject({ removedUpstreamCount: null, changes: null });
  });

  it('parses reported removed-upstream counts and change summaries and round-trips its own output', () => {
    const input = {
      ...v3Example,
      removedUpstreamCount: 33,
      changes: { added: 12, removed: 3, restored: 1 },
    };
    const manifest = parseCatalogManifest(input);
    expect(manifest).toMatchObject({
      removedUpstreamCount: 33,
      changes: { added: 12, removed: 3, restored: 1 },
    });
    expect(parseCatalogManifest(JSON.parse(JSON.stringify(manifest)))).toEqual(manifest);
    expect(parseCatalogManifest({ ...v3Example, removedUpstreamCount: null, changes: null }))
      .toMatchObject({ removedUpstreamCount: null, changes: null });
    expect(parseCatalogManifest({ ...v3Example, removedUpstreamCount: 0, changes: { added: 0, removed: 0, restored: 0 } }))
      .toMatchObject({ removedUpstreamCount: 0, changes: { added: 0, removed: 0, restored: 0 } });
  });

  it('drops unknown keys instead of carrying them into the receipt', () => {
    expect(parseCatalogManifest({ ...v3Example, extra: 'ignored' })).not.toHaveProperty('extra');
  });

  it.each([
    { change: { source: 'legacy-aurora-kilter' }, label: 'legacy source on schema 3' },
    { change: { source: 'boardsesh' }, label: 'unknown source' },
    { change: { sourceBuiltAt: '2026-10-19' }, label: 'build instant without time' },
    { change: { sourceBuiltAt: '2026-02-30T18:38:11.515Z' }, label: 'impossible build date' },
    { change: { sourceBuiltAt: '2026-10-19T18:38:11+02:00' }, label: 'non-UTC build instant' },
    { change: { sourceBuiltAt: undefined }, label: 'missing build instant' },
    { change: { sourceWatermarks: [] }, label: 'array watermarks' },
    { change: { sourceWatermarks: { board_climbs: 'yesterday' } }, label: 'watermark value' },
    { change: { sourceWatermarks: { 'Bad Key': '2026-10-19T18:31:55.490105Z' } }, label: 'watermark key' },
    {
      change: { sourceWatermarks: Object.fromEntries(Array.from({ length: 33 }, (_, index) => [`t${index}`, '2026-10-19T18:31:55Z'])) },
      label: 'watermark count',
    },
    { change: { layoutRevision: 'kilter:7:8:17' }, label: 'layout revision' },
    { change: { layoutRevision: undefined }, label: 'missing layout revision' },
    { change: { qualityScale: { min: 0 } }, label: 'quality scale without maximum' },
    { change: { qualityScale: { min: 5, max: 5 } }, label: 'empty quality scale' },
    { change: { qualityScale: { min: -1, max: 5 } }, label: 'negative quality minimum' },
    { change: { qualityScale: { min: 0, max: 11 } }, label: 'quality maximum above bound' },
    { change: { qualityScale: { min: 0, max: '5' } }, label: 'textual quality maximum' },
    { change: { climbCount: 0 }, label: 'empty climb count' },
    { change: { climbCount: 1.5 }, label: 'fractional climb count' },
    { change: { removedUpstreamCount: -1 }, label: 'negative removed-upstream count' },
    { change: { removedUpstreamCount: '3' }, label: 'textual removed-upstream count' },
    { change: { changes: [1, 2, 3] }, label: 'array change summary' },
    { change: { changes: { added: 1, removed: 2 } }, label: 'incomplete change summary' },
    { change: { changes: { added: 1, removed: -2, restored: 0 } }, label: 'negative change count' },
    { change: { schemaVersion: 4 }, label: 'future schema' },
    { change: { file: 'kilter-7x10.v2.db' }, label: 'file name' },
  ])('rejects invalid $label', ({ change }) => {
    expectRejected({ ...v3Example, ...change });
  });

  it('keeps the existing artifact size limits for schema 3', () => {
    expectRejected({ ...v3Example, bytesGzipped: 8 * 1024 * 1024 + 1 }, 'size');
    expectRejected({ ...v3Example, bytesRaw: 32 * 1024 * 1024 + 1 }, 'size');
  });
});

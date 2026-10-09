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
    { input: { ...valid, generatedOn: '2026-02-30' }, label: 'build date' },
    { input: { ...valid, sourceDataThrough: 'unknown' }, label: 'freshness date' },
    { input: { ...valid, file: '../kilter-7x10.v1.db.gz' }, label: 'path traversal' },
    { input: { ...valid, file: 'kilter-7x10.v0.db.gz' }, label: 'zero version in file name' },
    { input: { ...valid, sha256: 'A'.repeat(64) }, label: 'digest format' },
    { input: { ...valid, bytesGzipped: 8 * 1024 * 1024 + 1 }, label: 'compressed limit', code: 'size' },
    { input: { ...valid, bytesRaw: 32 * 1024 * 1024 + 1 }, label: 'raw limit', code: 'size' },
    { input: { ...valid, generatedFrom: 'x'.repeat(513) }, label: 'provenance bound' },
  ])('rejects invalid $label', ({ input, code }) => {
    try {
      parseCatalogManifest(input);
      throw new Error('expected the invalid manifest to be rejected');
    } catch (cause) {
      expect(cause).toBeInstanceOf(CatalogBootstrapError);
      expect(cause).toMatchObject({ code: code ?? 'manifest' });
    }
  });
});

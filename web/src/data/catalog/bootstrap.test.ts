// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { CatalogBootstrapError } from './errors.ts';
import { fetchCatalogManifest, fetchCatalogSnapshot } from './bootstrap.ts';
import type { CatalogManifest } from './manifest.ts';

const compressed = new Uint8Array([31, 139, 8, 0, 1, 2]);
const manifest: CatalogManifest = {
  schemaVersion: 2,
  version: 1,
  board: 'kilter-fullride-7x10',
  file: 'kilter-7x10.v1.db.gz',
  compression: 'gzip',
  sha256: 'a'.repeat(64),
  bytesGzipped: compressed.byteLength,
  bytesRaw: 4096,
  generatedOn: '2026-06-14',
  source: 'legacy-aurora-kilter',
  sourceDataThrough: null,
  generatedFrom: 'synthetic source',
  filter: 'layout_id=8',
};

function bodyResponse(body: BodyInit, init?: ResponseInit): Response {
  return new Response(body, init);
}

function fetcherFor(response: Response): typeof fetch {
  return vi.fn(async () => response) as unknown as typeof fetch;
}

describe('catalog snapshot acquisition', () => {
  it('bounds manifest bodies without trusting Content-Length', async () => {
    const tooLarge = bodyResponse(new Uint8Array(16 * 1024 + 1));
    await expect(fetchCatalogManifest(fetcherFor(tooLarge))).rejects.toMatchObject({ code: 'size' });
  });

  it('reads snapshot bytes from the stream and accepts absent or misleading Content-Length', async () => {
    const response = bodyResponse(compressed, { headers: { 'content-length': '1' } });
    const fetcher = fetcherFor(response);
    const progress: { receivedBytes: number; totalBytes: number }[] = [];
    const result = await fetchCatalogSnapshot(manifest, fetcher, (entry) => progress.push(entry));
    expect(new Uint8Array(result)).toEqual(compressed);
    expect(progress.at(-1)).toEqual({ receivedBytes: compressed.byteLength, totalBytes: compressed.byteLength });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringMatching(/^http:\/\/localhost\/catalog\/kilter-7x10\.v1\.db\.gz$/),
      { signal: undefined, redirect: 'manual' },
    );
  });

  it('rejects a streamed length mismatch even when headers claim the expected size', async () => {
    const tooShort = bodyResponse(new Uint8Array(compressed.byteLength - 1), {
      headers: { 'content-length': String(compressed.byteLength) },
    });
    await expect(fetchCatalogSnapshot(manifest, fetcherFor(tooShort), () => {}))
      .rejects.toMatchObject({ code: 'size' });
  });

  it('rejects a response redirected to another origin', async () => {
    const response = {
      ...bodyResponse(compressed),
      redirected: true,
    } as Response;
    await expect(fetchCatalogSnapshot(manifest, fetcherFor(response), () => {}))
      .rejects.toMatchObject({ code: 'manifest' });
  });

  it('classifies a non-followed redirect as a manifest policy error', async () => {
    const response = bodyResponse('', { status: 302, headers: { location: 'https://elsewhere.invalid/catalog.gz' } });
    await expect(fetchCatalogSnapshot(manifest, fetcherFor(response), () => {}))
      .rejects.toMatchObject({ code: 'manifest' });
  });

  it('keeps cancellation and network failures typed', async () => {
    const aborted = vi.fn(async () => { throw new DOMException('aborted', 'AbortError'); }) as unknown as typeof fetch;
    await expect(fetchCatalogSnapshot(manifest, aborted, () => {})).rejects.toMatchObject({ code: 'aborted' });

    const httpError = bodyResponse('offline', { status: 503 });
    await expect(fetchCatalogSnapshot(manifest, fetcherFor(httpError), () => {}))
      .rejects.toMatchObject({ code: 'network' });
  });

  it('parses only a bounded manifest from the fixed same-origin endpoint', async () => {
    const response = bodyResponse(JSON.stringify(manifest));
    const fetcher = fetcherFor(response);
    await expect(fetchCatalogManifest(fetcher)).resolves.toMatchObject({
      file: manifest.file,
      sourceDataThrough: null,
    });
    expect(fetcher).toHaveBeenCalledWith('http://localhost/catalog/manifest.json', {
      signal: undefined,
      redirect: 'manual',
    });
  });

  it('rejects malformed JSON and fetch rejection with distinct codes', async () => {
    await expect(fetchCatalogManifest(fetcherFor(bodyResponse('{')))).rejects
      .toMatchObject({ code: 'manifest' });
    const failure = vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    await expect(fetchCatalogManifest(failure)).rejects.toBeInstanceOf(CatalogBootstrapError);
    await expect(fetchCatalogManifest(failure)).rejects.toMatchObject({ code: 'network' });
  });
});

import { CatalogBootstrapError } from './errors.ts';
import {
  CATALOG_COMPRESSED_LIMIT,
  CATALOG_MANIFEST_LIMIT,
  parseCatalogManifest,
  type CatalogDownloadProgress,
  type CatalogManifest,
} from './manifest.ts';

function isAbort(cause: unknown, signal?: AbortSignal): boolean {
  return signal?.aborted === true || (cause instanceof Error && cause.name === 'AbortError');
}

async function readResponse(
  response: Response,
  limit: number,
  expectedBytes: number | null,
  onProgress?: (progress: CatalogDownloadProgress) => void,
): Promise<Uint8Array> {
  if (!response.ok) throw new CatalogBootstrapError('network', `Catalog request failed with HTTP ${response.status}`);
  if (!response.body) throw new CatalogBootstrapError('network', 'Catalog response has no readable body');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > limit || (expectedBytes !== null && receivedBytes > expectedBytes)) {
        throw new CatalogBootstrapError('size', 'Catalog response exceeded its declared size limit');
      }
      chunks.push(value);
      onProgress?.({ receivedBytes, totalBytes: expectedBytes ?? receivedBytes });
    }
  } catch (cause) {
    try { await reader.cancel(cause); } catch { /* The original stream error is authoritative. */ }
    throw cause;
  } finally {
    reader.releaseLock();
  }
  if (expectedBytes !== null && receivedBytes !== expectedBytes) {
    throw new CatalogBootstrapError('size', 'Catalog response length does not match the manifest');
  }
  const bytes = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function requestUrl(path: string): string {
  const origin = typeof location === 'undefined' ? 'http://localhost' : location.origin;
  return new URL(path, origin).toString();
}

function rejectRedirect(response: Response, expected: string): void {
  if (response.redirected || response.type === 'opaqueredirect'
    || (response.status >= 300 && response.status < 400)) {
    throw new CatalogBootstrapError('manifest', 'Catalog redirects are not allowed');
  }
  if (response.url) {
    const actual = new URL(response.url);
    const target = new URL(expected);
    if (actual.origin !== target.origin || actual.pathname !== target.pathname) {
      throw new CatalogBootstrapError('manifest', 'Catalog response came from an unexpected origin or path');
    }
  }
}

export async function fetchCatalogManifest(
  fetcher: typeof fetch,
  signal?: AbortSignal,
): Promise<CatalogManifest> {
  const url = requestUrl('/catalog/manifest.json');
  let response: Response;
  try {
    response = await fetcher(url, { signal, redirect: 'manual' });
  } catch (cause) {
    if (isAbort(cause, signal)) throw new CatalogBootstrapError('aborted', 'Catalog request was cancelled', { cause });
    throw new CatalogBootstrapError('network', 'Catalog manifest request failed', { cause });
  }
  rejectRedirect(response, url);
  try {
    const bytes = await readResponse(response, CATALOG_MANIFEST_LIMIT, null);
    let value: unknown;
    try {
      value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch (cause) {
      throw new CatalogBootstrapError('manifest', 'Catalog manifest is not valid UTF-8 JSON', { cause });
    }
    return parseCatalogManifest(value);
  } catch (cause) {
    if (isAbort(cause, signal)) throw new CatalogBootstrapError('aborted', 'Catalog request was cancelled', { cause });
    if (cause instanceof CatalogBootstrapError) throw cause;
    throw new CatalogBootstrapError('network', 'Catalog manifest could not be read', { cause });
  }
}

export async function fetchCatalogSnapshot(
  manifestValue: CatalogManifest,
  fetcher: typeof fetch,
  onProgress: (progress: CatalogDownloadProgress) => void,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const manifest = parseCatalogManifest(manifestValue);
  if (manifest.bytesGzipped > CATALOG_COMPRESSED_LIMIT) {
    throw new CatalogBootstrapError('size', 'Catalog snapshot exceeds the compressed size limit');
  }
  const url = requestUrl(`/catalog/${manifest.file}`);
  let response: Response;
  try {
    response = await fetcher(url, { signal, redirect: 'manual' });
  } catch (cause) {
    if (isAbort(cause, signal)) throw new CatalogBootstrapError('aborted', 'Catalog download was cancelled', { cause });
    throw new CatalogBootstrapError('network', 'Catalog snapshot request failed', { cause });
  }
  rejectRedirect(response, url);
  try {
    const bytes = await readResponse(response, CATALOG_COMPRESSED_LIMIT, manifest.bytesGzipped, onProgress);
    const exactBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(exactBuffer).set(bytes);
    return exactBuffer;
  } catch (cause) {
    if (isAbort(cause, signal)) throw new CatalogBootstrapError('aborted', 'Catalog download was cancelled', { cause });
    if (cause instanceof CatalogBootstrapError) throw cause;
    throw new CatalogBootstrapError('network', 'Catalog snapshot could not be read', { cause });
  }
}

// Node 22 --experimental-strip-types; the production parser owns the schema.
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { CATALOG_MANIFEST_LIMIT, CATALOG_COMPRESSED_LIMIT, parseCatalogManifest } from '../../../web/src/data/catalog/manifest.ts';

// AGP's asset merger expands all .gz files before AAPT runs. Keep an inert suffix
// and serve the original canonical URL through CatalogAssetWebViewClient.
export const CATALOG_ASSET_SUFFIX = '.bin';

export async function boundedFile(file, limit) {
  const handle = await open(file, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit) throw new Error(`Catalog input must be a regular file of at most ${limit} bytes: ${file}`);
    const buffer = Buffer.alloc(stat.size + 1);
    let size = 0;
    while (size < buffer.length) {
      const read = await handle.read(buffer, size, buffer.length - size, null);
      if (read.bytesRead === 0) break;
      size += read.bytesRead;
    }
    if (size !== stat.size) throw new Error(`Catalog input changed while reading: ${file}`);
    return buffer.subarray(0, size);
  } finally { await handle.close(); }
}

export async function readCatalogManifest(file) {
  return parseCatalogManifest(JSON.parse((await boundedFile(file, CATALOG_MANIFEST_LIMIT)).toString('utf8')));
}

export function validateCatalogBytes(bytes, manifest) {
  if (bytes.length !== manifest.bytesGzipped) throw new Error('Catalog compressed size does not match the expected manifest');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== manifest.sha256) throw new Error('Catalog SHA-256 does not match the expected manifest');
  let raw;
  try { raw = gunzipSync(bytes, { maxOutputLength: manifest.bytesRaw }); }
  catch (cause) { throw new Error('Catalog gzip is invalid or exceeds its declared raw size', { cause }); }
  if (raw.length !== manifest.bytesRaw) throw new Error('Catalog raw size does not match the expected manifest');
  if (!raw.subarray(0, 16).equals(Buffer.from('SQLite format 3\0'))) throw new Error('Catalog is missing the SQLite database header');
  return { sha256, bytesGzipped: bytes.length, bytesRaw: raw.length };
}

export async function prepareAndroidCatalog({ sourceFile, manifestFile, destinationDirectory }) {
  if (!sourceFile) throw new Error('Supply an explicit private catalog input: --catalog /absolute/path/kilter-7x10.v1.db.gz');
  if (!manifestFile || !destinationDirectory) throw new Error('Catalog preparation requires manifestFile and destinationDirectory');
  const manifest = await readCatalogManifest(manifestFile);
  const bytes = await boundedFile(sourceFile, CATALOG_COMPRESSED_LIMIT);
  const result = validateCatalogBytes(bytes, manifest);
  await mkdir(destinationDirectory, { recursive: true });
  const staged = join(destinationDirectory, `.catalog-${randomUUID()}.tmp`);
  try {
    const handle = await open(staged, 'wx', 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    await rename(staged, join(destinationDirectory, manifest.file + CATALOG_ASSET_SUFFIX));
  } finally { await rm(staged, { force: true }); }
  // Only build output, never the supplied source or an authored database.
  const original = join(destinationDirectory, manifest.file);
  if (resolve(original) !== resolve(sourceFile)) await rm(original, { force: true });
  return result;
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) {
  const [sourceFile, manifestFile, destinationDirectory] = process.argv.slice(2);
  try { console.log(JSON.stringify(await prepareAndroidCatalog({ sourceFile, manifestFile, destinationDirectory }))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

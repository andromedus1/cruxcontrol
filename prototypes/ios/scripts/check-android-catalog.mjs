import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CATALOG_COMPRESSED_LIMIT } from '../../../web/src/data/catalog/manifest.ts';
import { boundedFile, CATALOG_ASSET_SUFFIX, readCatalogManifest, validateCatalogBytes } from './prepare-android-catalog.mjs';

// Follow reachable emitted modules, rather than accepting orphan Worker/WASM files.
async function checkCatalogCode(directory) {
  const root = resolve(directory);
  const local = (importer, reference) => {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference)) throw new Error('Catalog code must use bundled local assets');
    const file = resolve(root, reference.startsWith('/') ? '.' + reference : join(dirname(importer), reference));
    if (relative(root, file).startsWith('..')) throw new Error('Catalog code reference escapes the asset directory');
    return file;
  };
  const html = await readFile(join(root, 'index.html'), 'utf8');
  const pending = [...html.matchAll(/<script\b(?=[^>]*\btype=["']module["'])[^>]*\bsrc=["']([^"']+)["']/g)]
    .map(match => local(join(root, 'index.html'), match[1]));
  if (!pending.length) throw new Error('Bundled app has no module entry');
  const seen = new Set();
  const workers = new Set();
  const wasm = new Set();
  while (pending.length) {
    const file = pending.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/\b(?:import\s*\(\s*|import\s*|(?:import|export)\s*[^;'"`]*?\bfrom\s*)['"]([^'"\r\n]+)['"]/g)) {
      const target = local(file, match[1]);
      if (/\.m?js$/.test(target)) pending.push(target);
    }
    for (const match of source.matchAll(/\bnew\s+Worker\s*\(\s*new\s+URL\s*\(\s*['"]([^'"]+catalog\.worker-[^'"]+\.js)['"]\s*,\s*import\.meta\.url\s*\)\s*,\s*\{\s*type\s*:\s*['"]module['"]/g)) {
      const target = local(file, match[1]); workers.add(target); pending.push(target);
    }
    if (workers.size) {
      for (const match of source.matchAll(/\bnew\s+URL\s*\(\s*['"]([^'"]+wa-sqlite-[^'"]+\.wasm)['"]\s*,\s*import\.meta\.url/g)) wasm.add(local(file, match[1]));
    }
  }
  if (workers.size !== 1 || wasm.size !== 1) throw new Error('Expected one reachable catalog module Worker and SQLite WASM');
  const wasmFile = [...wasm][0];
  const bytes = await readFile(wasmFile);
  if (!bytes.subarray(0, 4).equals(Buffer.from([0, 97, 115, 109]))) throw new Error('Catalog WASM header is invalid');
  return { worker: relative(root, [...workers][0]), wasm: relative(root, wasmFile) };
}

export async function checkAndroidCatalog(assetDirectory, expectedManifestFile) {
  const manifest = await readCatalogManifest(join(assetDirectory, 'catalog/manifest.json'));
  if (expectedManifestFile) {
    const expected = await readCatalogManifest(expectedManifestFile);
    if (JSON.stringify(manifest) !== JSON.stringify(expected)) throw new Error('Packaged catalog manifest differs from the expected source manifest');
  }
  const bytes = await boundedFile(join(assetDirectory, 'catalog', manifest.file + CATALOG_ASSET_SUFFIX), CATALOG_COMPRESSED_LIMIT);
  return { ...validateCatalogBytes(bytes, manifest), ...await checkCatalogCode(assetDirectory) };
}

export async function checkAndroidCatalogApk(apkFile, expectedManifestFile) {
  if (!expectedManifestFile) throw new Error('Final APK validation requires the expected source manifest');
  const temporary = await mkdtemp(join(tmpdir(), 'cruxcontrol-catalog-apk-'));
  try {
    const entries = execFileSync('unzip', ['-Z1', resolve(apkFile)], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }).trim().split('\n');
    const assets = entries.filter(entry => entry.startsWith('assets/public/'));
    if (new Set(assets).size !== assets.length || assets.some(entry => entry.includes('..') || entry.includes('\\'))) throw new Error('APK contains ambiguous or unsafe asset entries');
    execFileSync('unzip', ['-q', resolve(apkFile), 'assets/public/*', '-d', temporary]);
    return await checkAndroidCatalog(join(temporary, 'assets/public'), expectedManifestFile);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) {
  const [kind, file, expectedManifestFile] = process.argv.slice(2);
  try {
    if (!file || !['assets', 'apk'].includes(kind)) throw new Error('Usage: check-android-catalog.mjs assets|apk PATH EXPECTED_MANIFEST');
    const result = kind === 'apk' ? await checkAndroidCatalogApk(file, expectedManifestFile) : await checkAndroidCatalog(file, expectedManifestFile);
    console.log(`Android catalog ${kind} verified: ${JSON.stringify(result)}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

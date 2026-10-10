import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { CATALOG_COMPRESSED_LIMIT, CATALOG_RAW_LIMIT } from '../../../web/src/data/catalog/manifest.ts';
import { prepareAndroidCatalog } from './prepare-android-catalog.mjs';
import { checkAndroidCatalog, checkAndroidCatalogApk } from './check-android-catalog.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'android-catalog-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const raw = Buffer.alloc(512); Buffer.from('SQLite format 3\0').copy(raw);
  const gzip = gzipSync(raw);
  const manifest = {
    schemaVersion: 2, version: 1, board: 'kilter-fullride-7x10', file: 'kilter-7x10.v1.db.gz', compression: 'gzip',
    sha256: createHash('sha256').update(gzip).digest('hex'), bytesGzipped: gzip.length, bytesRaw: raw.length,
    generatedOn: '2026-06-14', source: 'legacy-aurora-kilter', sourceDataThrough: null, generatedFrom: 'Synthetic fixture', filter: 'synthetic',
  };
  const sourceFile = join(root, 'input.gz');
  const manifestFile = join(root, 'expected.json');
  const destinationDirectory = join(root, 'assets/public/catalog');
  await writeFile(sourceFile, gzip);
  await writeFile(manifestFile, JSON.stringify(manifest));
  const options = { sourceFile, manifestFile, destinationDirectory };
  return { root, raw, gzip, manifest, options, writeManifest: (changes) => writeFile(manifestFile, JSON.stringify({ ...manifest, ...changes })) };
}

async function code(root) {
  const directory = join(root, 'assets/public');
  await mkdir(join(directory, 'assets'), { recursive: true });
  await writeFile(join(directory, 'index.html'), '<script type="module" src="/assets/app.js"></script>');
  await writeFile(join(directory, 'assets/app.js'), 'new Worker(new URL("/assets/catalog.worker-test.js",import.meta.url),{type:"module"});');
  await writeFile(join(directory, 'assets/catalog.worker-test.js'), 'const glue=await import("./wa-sqlite-test.js");');
  await writeFile(join(directory, 'assets/wa-sqlite-test.js'), 'new URL("/assets/wa-sqlite-test.wasm",import.meta.url);');
  await writeFile(join(directory, 'assets/wa-sqlite-test.wasm'), Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]));
  return directory;
}

test('explicit validated input copies exact bytes atomically without rewriting the source manifest', async t => {
  const { gzip, manifest, options } = await fixture(t);
  const expectedText = await readFile(options.manifestFile, 'utf8');
  assert.deepEqual(await prepareAndroidCatalog(options), { sha256: manifest.sha256, bytesGzipped: gzip.length, bytesRaw: manifest.bytesRaw });
  assert.deepEqual(await readFile(join(options.destinationDirectory, manifest.file + '.bin')), gzip);
  assert.equal(await readFile(options.manifestFile, 'utf8'), expectedText);
  assert.deepEqual(await readdir(options.destinationDirectory), [manifest.file + '.bin']);
});

test('missing, tampered, truncated and oversized inputs reject before overwriting a valid output', async t => {
  const { gzip, manifest, options } = await fixture(t);
  await prepareAndroidCatalog(options);
  const output = join(options.destinationDirectory, manifest.file + '.bin');
  await assert.rejects(prepareAndroidCatalog({ ...options, sourceFile: undefined }), /explicit private catalog/);
  await assert.rejects(prepareAndroidCatalog({ ...options, sourceFile: join(options.destinationDirectory, 'missing') }), /ENOENT/);
  const tampered = Buffer.from(gzip); tampered[15] ^= 1;
  for (const [bytes, reason] of [[tampered, /SHA-256/], [gzip.subarray(0, gzip.length - 1), /compressed size/], [Buffer.alloc(CATALOG_COMPRESSED_LIMIT + 1), /at most/]]) {
    await writeFile(options.sourceFile, bytes);
    await assert.rejects(prepareAndroidCatalog(options), reason);
    assert.deepEqual(await readFile(output), gzip);
  }
});

test('manifest identity, raw bounds, expansion and SQLite header stay strict', async t => {
  const { options, raw, writeManifest } = await fixture(t);
  for (const changes of [{ file: '../escape.gz' }, { board: 'other-board' }, { bytesRaw: CATALOG_RAW_LIMIT + 1 }]) {
    await writeManifest(changes);
    await assert.rejects(prepareAndroidCatalog(options), /manifest/);
  }
  await writeManifest({ bytesRaw: raw.length - 1 });
  await assert.rejects(prepareAndroidCatalog(options), /exceeds its declared raw size/);
  await writeManifest({ bytesRaw: raw.length + 1 });
  await assert.rejects(prepareAndroidCatalog(options), /raw size/);
  const invalid = gzipSync(Buffer.alloc(raw.length));
  await writeFile(options.sourceFile, invalid);
  await writeManifest({ bytesGzipped: invalid.length, sha256: createHash('sha256').update(invalid).digest('hex') });
  await assert.rejects(prepareAndroidCatalog(options), /SQLite/);
});

test('synced and final APK checks reject missing gzip, expanded old APK, wrong digest and orphan code', async t => {
  const { root, raw, manifest, options } = await fixture(t);
  const directory = await code(root);
  await mkdir(options.destinationDirectory, { recursive: true });
  await writeFile(join(options.destinationDirectory, 'manifest.json'), await readFile(options.manifestFile));
  await assert.rejects(checkAndroidCatalog(directory), /ENOENT/);
  await writeFile(join(options.destinationDirectory, manifest.file.replace(/\.gz$/, '')), raw);
  const oldApk = join(root, 'old.apk');
  execFileSync('zip', ['-qr', oldApk, 'assets'], { cwd: root });
  await assert.rejects(checkAndroidCatalogApk(oldApk, options.manifestFile), /ENOENT/);
  await prepareAndroidCatalog(options);
  const apk = join(root, 'valid.apk');
  execFileSync('zip', ['-qr', apk, 'assets'], { cwd: root });
  assert.equal((await checkAndroidCatalogApk(apk, options.manifestFile)).sha256, manifest.sha256);
  await writeFile(join(options.destinationDirectory, manifest.file + '.bin'), Buffer.alloc(manifest.bytesGzipped));
  await assert.rejects(checkAndroidCatalog(directory), /SHA-256/);
  await prepareAndroidCatalog(options);
  await writeFile(join(directory, 'assets/app.js'), 'console.log("orphan worker");');
  await assert.rejects(checkAndroidCatalog(directory), /reachable catalog/);
});

test('final APK compares against expected manifest and follows referenced WASM', async t => {
  const { root, options, manifest } = await fixture(t);
  const directory = await code(root);
  await prepareAndroidCatalog(options);
  await writeFile(join(options.destinationDirectory, 'manifest.json'), JSON.stringify({ ...manifest, generatedFrom: 'changed' }));
  await assert.rejects(checkAndroidCatalog(directory, options.manifestFile), /differs/);
  await writeFile(join(options.destinationDirectory, 'manifest.json'), JSON.stringify(manifest));
  await rm(join(directory, 'assets/wa-sqlite-test.wasm'));
  await assert.rejects(checkAndroidCatalog(directory), /ENOENT/);
});

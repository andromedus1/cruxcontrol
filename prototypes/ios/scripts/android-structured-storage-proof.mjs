// Synthetic emulator-only scale proof of the real native library adapter.
// A separate database preserves the app library. This is NOT the in-app cloud
// recovery gate: that must also be exercised through normal UI on an empty app.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalSnapshot, decodeLibraryBackup } from '../../../web/src/library-backup/codec.ts';
import { catalogDevice, pause } from './android-catalog-device.mjs';

const [serial, fixtureFile, outputArgument] = process.argv.slice(2);
assert(/^emulator-\d+$/.test(serial ?? '') && fixtureFile && outputArgument,
  'Usage: node --experimental-strip-types android-structured-storage-proof.mjs emulator-N SYNTHETIC_BACKUP PRIVATE_OUTPUT');
const output = resolve(outputArgument);
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
if (output === root || output.startsWith(`${root}/`)) execFileSync('git', ['check-ignore', '--quiet', output]);
const text = await readFile(fixtureFile, 'utf8');
const fixture = decodeLibraryBackup(text);
assert.equal(fixture.drafts.length, 10_000);
assert.equal(fixture.playlists.length, 1_000);
const canonicalSha256 = createHash('sha256').update(canonicalSnapshot(fixture)).digest('hex');
const database = `crux-synthetic-scale-${Date.now()}`; // Never reuse, clear or replace a database.
const require = createRequire(new URL('../../firebase-vault/gateway/package.json', import.meta.url));
const { build } = require('esbuild');
const entry = `
  import { CapacitorSQLite } from '@capacitor-community/sqlite';
  import { createNativeLibraryOpener } from './src/open-native-library.ts';
  import { decodeLibraryBackup, canonicalSnapshot } from '../../web/src/library-backup/codec.ts';
  const database = ${JSON.stringify(database)};
  const plugin = Object.fromEntries(['createConnection','open','closeConnection','execute','run','query']
    .map(method => [method, options => CapacitorSQLite[method]({...options,database})]));
  const open = createNativeLibraryOpener(plugin);
  async function digest(value) {
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))]
      .map(b => b.toString(16).padStart(2,'0')).join('');
  }
  export async function run(text) {
    const library = await open();
    const initial = await library.preservation.capture();
    if (initial.snapshot.drafts.length || initial.snapshot.playlists.length) throw new Error('Scale database must be empty');
    const before = performance.now();
    const restored = await library.backupStore.restoreMissingSnapshot(decodeLibraryBackup(text));
    const after = await library.preservation.capture();
    const restoredSha256 = await digest(canonicalSnapshot(after.snapshot));
    const record = await library.preservation.read();
    library.close();
    const reopened = await open();
    const again = await reopened.preservation.capture();
    const reopenedSha256 = await digest(canonicalSnapshot(again.snapshot));
    reopened.close();
    return {restored,revision:again.revision,recovery:record.recovery,restoredSha256,reopenedSha256,
      elapsedMs:Math.round(performance.now()-before),climbs:again.snapshot.drafts.length,
      playlists:again.snapshot.playlists.length,references:again.snapshot.playlists.reduce((n,p)=>n+p.entries.length,0)};
  }`;
const bundle = await build({ stdin: { contents: entry, resolveDir: fileURLToPath(new URL('..', import.meta.url)),
  sourcefile: 'synthetic-storage-proof.ts', loader: 'ts' }, bundle: true, platform: 'browser',
  format: 'iife', globalName: '__cruxScale', write: false, logLevel: 'silent' });
const device = catalogDevice(serial);
try {
  await device.start();
  await device.evaluate(bundle.outputFiles[0].text);
  await device.evaluate('window.__cruxScaleInput = []');
  for (let offset = 0; offset < text.length; offset += 65536) {
    await device.evaluate(`window.__cruxScaleInput.push(${JSON.stringify(text.slice(offset, offset + 65536))})`);
  }
  await device.evaluate(`(() => { window.__cruxScaleResult = null; window.__cruxScale.run(window.__cruxScaleInput.join(''))
    .then(value => {window.__cruxScaleResult={ok:true,value};}, error => {window.__cruxScaleResult={ok:false,error:String(error)};});
    delete window.__cruxScaleInput; })()`);
  const deadline = Date.now() + 600_000;
  let result;
  while (Date.now() < deadline) {
    result = await device.evaluate('window.__cruxScaleResult');
    if (result) break;
    await pause(500);
  }
  assert(result?.ok, result?.error ?? 'Structured native storage proof timed out');
  assert.equal(result.value.restoredSha256, canonicalSha256);
  assert.equal(result.value.reopenedSha256, canonicalSha256);
  assert.equal(result.value.recovery, null);
  assert.equal(result.value.revision, 1);
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  await writeFile(output, JSON.stringify({ at: new Date().toISOString(), database,
    scope: 'isolated native adapter scale; not in-app cloud recovery', bytes: Buffer.byteLength(text),
    canonicalSha256, ...result.value }, null, 2), { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ ok: true, ...result.value }));
} finally {
  await device.evaluate('delete window.__cruxScale; delete window.__cruxScaleInput; delete window.__cruxScaleResult').catch(() => undefined);
  await device.detach();
}

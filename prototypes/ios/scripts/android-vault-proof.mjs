// Emulator-only acceptance through the actual production TypeScript/native port.
// The temporary IIFE exists only in the instrumented WebView, never in an APK.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalogDevice } from './android-catalog-device.mjs';
import { decodeLibraryBackup } from '../../../web/src/library-backup/codec.ts';

const [serial, method, outputArgument, inputArgument, slot] = process.argv.slice(2);
assert(/^emulator-\d+$/.test(serial ?? '') && ['status', 'list', 'stage', 'upload', 'download', 'discard', 'signOut', 'signIn', 'verifySession'].includes(method) && outputArgument,
  'Usage: node --experimental-strip-types android-vault-proof.mjs emulator-N METHOD PRIVATE_OUTPUT [BACKUP_OR_STAGE_FILE [SLOT]]');
const output = resolve(outputArgument);
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
if (output === root || output.startsWith(`${root}/`)) execFileSync('git', ['check-ignore', '--quiet', output]);
await mkdir(dirname(output), { recursive: true, mode: 0o700 });
const device = catalogDevice(serial);
const require = createRequire(new URL('../../firebase-vault/gateway/package.json', import.meta.url));
const { build } = require('esbuild');
const bundle = await build({ entryPoints: [fileURLToPath(new URL('../src/native-private-vault.ts', import.meta.url))],
  bundle: true, platform: 'browser', format: 'iife', globalName: '__cruxVaultModule', write: false, logLevel: 'silent' });

async function operation(expression, timeoutMs = 180000) {
  await device.evaluate(`(() => { window.__cruxVaultJob = { complete: false }; Promise.resolve().then(() => (${expression})).then(value => { window.__cruxVaultJob = {complete:true, ok:true, value}; }, error => { window.__cruxVaultJob = {complete:true, ok:false, code:typeof error?.code === 'string' ? error.code : 'unavailable'}; }); })()`);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await device.evaluate('window.__cruxVaultJob.complete')) {
      const summary = await device.evaluate('({ok:window.__cruxVaultJob.ok, code:window.__cruxVaultJob.code})');
      if (!summary.ok) return summary;
      return { ok: true };
    }
    await new Promise(accept => setTimeout(accept, 250));
  }
  throw new Error('Native vault acceptance operation timed out; outcome is unknown, retain staged evidence');
}

try {
  await device.start();
  await device.evaluate(bundle.outputFiles[0].text);
  await device.evaluate('window.__cruxVault = window.__cruxVaultModule.createNativePrivateVault()');
  const statusResult = await operation('window.__cruxVault.status()');
  assert(statusResult.ok, 'Native vault status failed');
  let status = await device.evaluate('window.__cruxVaultJob.value');
  assert(status.configured && /^acceptance-v1\/r00[1-4]$/.test(status.scope), 'Live proof requires configured isolated acceptance scope');
  const uid = status.account?.uid;
  let result;
  if (method === 'status') result = { ok: true, value: status };
  else if (method === 'signIn' || method === 'signOut') {
    result = await operation(`window.__cruxVault.${method}()`);
    if (result.ok) result.value = (await operation('window.__cruxVault.status()')).ok
      ? await device.evaluate('window.__cruxVaultJob.value') : null;
  } else if (method === 'verifySession') {
    // Session refresh is the common native account implementation, no token return.
    result = await operation("window.Capacitor.nativePromise('NativeAccount', 'verifySession', {})");
    if (result.ok) result.value = await device.evaluate('window.__cruxVaultJob.value');
  } else {
    assert(uid, 'Sign into the acceptance account first');
    if (method === 'list') {
      result = await operation(`window.__cruxVault.list(${JSON.stringify(uid)})`);
      if (result.ok) result.value = await device.evaluate('window.__cruxVaultJob.value');
    } else if (method === 'stage') {
      assert(inputArgument, 'A synthetic backup file is required');
      const text = await readFile(inputArgument, 'utf8');
      decodeLibraryBackup(text);
      await device.evaluate('window.__cruxVaultInput = []');
      // CDP chunks are test transport, not Capacitor. The actual adapter below
      // still performs the production UTF-8 staging/chunk/digest path.
      for (let offset = 0; offset < text.length; offset += 65536) {
        await device.evaluate(`window.__cruxVaultInput.push(${JSON.stringify(text.slice(offset, offset + 65536))})`);
      }
      result = await operation(`window.__cruxVault.stage(${JSON.stringify(uid)}, window.__cruxVaultInput.join(''))`);
      await device.evaluate('delete window.__cruxVaultInput');
      if (result.ok) result.value = await device.evaluate('window.__cruxVaultJob.value');
    } else if (method === 'upload' || method === 'discard') {
      assert(inputArgument, 'Successful stage evidence is required');
      const stage = JSON.parse(await readFile(inputArgument, 'utf8'));
      assert(stage.method === 'stage' && stage.ok && stage.uid === uid && stage.scope === status.scope,
        'Staged evidence must belong to the current account and scope');
      if (method === 'upload') {
        assert(/^\d{5}$/.test(slot ?? '') && Number(slot) <= 511, 'Expected slot 00000–00511');
        result = await operation(`window.__cruxVault.upload(${JSON.stringify(uid)}, ${JSON.stringify(slot)}, ${JSON.stringify(stage.value)})`);
      } else result = await operation(`window.__cruxVault.discard(${JSON.stringify(uid)}, ${JSON.stringify(stage.value.id)})`);
      if (result.ok && method === 'upload') result.value = await device.evaluate('window.__cruxVaultJob.value');
    } else if (method === 'download') {
      assert(/^\d{5}$/.test(inputArgument ?? '') && Number(inputArgument) <= 511, 'Expected snapshot slot');
      assert((await operation(`window.__cruxVault.list(${JSON.stringify(uid)})`)).ok, 'Discovery failed');
      const listing = await device.evaluate('window.__cruxVaultJob.value');
      const snapshot = listing.snapshots.find(entry => entry.slot === inputArgument);
      assert(snapshot, 'Requested snapshot was not discovered');
      result = await operation(`window.__cruxVault.download(${JSON.stringify(uid)}, ${JSON.stringify(snapshot)})`);
      if (result.ok) {
        const length = await device.evaluate('window.__cruxVaultJob.value.length');
        assert(Number.isSafeInteger(length) && length > 0 && length <= 25 * 1024 * 1024);
        const chunks = [];
        for (let offset = 0; offset < length; offset += 65536) {
          chunks.push(await device.evaluate(`window.__cruxVaultJob.value.slice(${offset}, ${offset + 65536})`));
        }
        const text = chunks.join('');
        const backup = decodeLibraryBackup(text);
        assert.equal(Buffer.byteLength(text), snapshot.bytes);
        assert.equal(createHash('sha256').update(text).digest('hex'), snapshot.sha256);
        const downloaded = `${output}.backup.json`;
        await writeFile(downloaded, text, { mode: 0o600, flag: 'wx' });
        result.value = { snapshot, downloaded, climbs: backup.drafts.length, playlists: backup.playlists.length };
      }
    }
  }
  assert(result, 'Unknown acceptance operation');
  const evidence = { at: new Date().toISOString(), method, uid: uid ?? null,
    scope: status.scope, installationId: status.installationId, ...result };
  await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ method, scope: status.scope, ok: result.ok, code: result.code ?? null,
    bytes: result.value?.bytes ?? result.value?.snapshot?.bytes ?? null }));
} finally {
  // Remove only the temporary test harness from this instrumented WebView.
  await device.evaluate('delete window.__cruxVault; delete window.__cruxVaultModule; delete window.__cruxVaultJob; delete window.__cruxVaultInput').catch(() => undefined);
  await device.detach();
}

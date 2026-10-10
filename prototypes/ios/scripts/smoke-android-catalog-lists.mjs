// Bounded private observation of an already-installed catalog; no import/reset.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { canonicalSnapshot, decodeLibraryBackup, encodeLibraryBackup } from '../../../web/src/library-backup/codec.ts';
import { appId, catalogDevice, catalogLibrarySnapshot, verifyColdCatalogLists } from './android-catalog-device.mjs';
import { checkAndroidCatalogApk } from './check-android-catalog.mjs';

const [serial, expectedFile, evidenceDirectory, upgradeApk] = process.argv.slice(2);
if (!expectedFile || !evidenceDirectory || process.argv.length > 6) throw new Error('Usage: node --experimental-strip-types smoke-android-catalog-lists.mjs emulator-N EXPECTED_SYNTHETIC_BACKUP EVIDENCE_DIRECTORY [PRIVATE_UPGRADE_APK]');
const expected = decodeLibraryBackup(await readFile(expectedFile, 'utf8'));
const fixture = decodeLibraryBackup(await readFile(new URL('../fixtures/synthetic-library.json', import.meta.url), 'utf8'));
const edited = expected.drafts.find(row => row.name === 'Prototype finish A — Android preservation proof');
const ordered = fixture.playlists.find(row => row.name === 'Prototype ordered');
const changed = expected.playlists.find(row => row.id === ordered.id);
assert.equal(changed.entries.length, ordered.entries.length + 1);
assert.deepEqual(changed.entries.slice(0, -1), ordered.entries);
assert.equal(changed.entries.at(-1).kind, 'provider');
assert.equal(changed.revision, ordered.revision + 1);
const allowed = {
  drafts: fixture.drafts.map(row => edited?.id === row.id ? { ...row, name: edited.name, revision: edited.revision, updatedAt: edited.updatedAt } : row),
  playlists: fixture.playlists.map(row => row.id === ordered.id ? { ...row, entries: changed.entries, revision: changed.revision, updatedAt: changed.updatedAt } : row),
};
assert.equal(canonicalSnapshot(expected), canonicalSnapshot(allowed), 'Only the complete preserved synthetic fixture and intentional catalog append are accepted');
const packaged = upgradeApk ? await checkAndroidCatalogApk(upgradeApk, new URL('../../../web/public/catalog/manifest.json', import.meta.url)) : null;
const evidence = resolve(evidenceDirectory);
await mkdir(evidence, { recursive: true });
const device = catalogDevice(serial);
const originalAirplane = device.adb('shell', 'settings', 'get', 'global', 'airplane_mode_on');
async function snapshot(label) {
  const library = await catalogLibrarySnapshot(device);
  assert.equal(canonicalSnapshot(library), canonicalSnapshot(expected), 'Complete authored library must remain unchanged');
  await writeFile(join(evidence, label + '.json'), encodeLibraryBackup(library, new Date()));
  return library;
}
try {
  await device.start();
  await snapshot('before');
  if (upgradeApk) {
    await device.detach();
    device.adb('install', '-r', resolve(upgradeApk));
    device.adb('shell', 'am', 'force-stop', appId);
    await device.start();
    await snapshot('upgraded');
  }
  device.adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'enable');
  await device.restart();
  assert.equal(device.adb('shell', 'settings', 'get', 'global', 'airplane_mode_on'), '1');
  const coldLists = await verifyColdCatalogLists(device, expected);
  await snapshot('cold-lists');
  const databaseNames = await device.evaluate('indexedDB.databases().then(rows=>rows.map(row=>row.name).sort())');
  assert.deepEqual(databaseNames, ['cruxcontrol-catalog-metadata']);
  assert.deepEqual(await device.evaluate('navigator.serviceWorker.getRegistrations().then(rows=>rows.map(row=>row.scope))'), []);
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ status: 'passed', packaged, coldLists, databaseNames, androidApi: device.adb('shell', 'getprop', 'ro.build.version.sdk'), webView: await device.evaluate('navigator.userAgent'), comparison: 'All canonical authored fields unchanged before/after optional preserved upgrade and cold offline Lists-first provider resolution/play-through.' }, null, 2));
  await device.click('Exit play-through');
  console.log('Cold offline Lists-first catalog proof passed; private evidence', evidence);
} finally {
  await device.detach();
  device.adb('shell', 'cmd', 'connectivity', 'airplane-mode', originalAirplane === '1' ? 'enable' : 'disable');
}

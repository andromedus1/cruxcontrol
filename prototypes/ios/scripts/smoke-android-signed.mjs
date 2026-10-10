import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { canonicalSnapshot, decodeLibraryBackup } from '../../../web/src/library-backup/codec.ts';
import { appId, catalogDevice, catalogLibrarySnapshot, pause } from './android-catalog-device.mjs';
import { androidUi, chooseDownloadedFile } from './android-document-picker.mjs';
import { chooseDownloadsAndSave, downloadNames, readDownload } from './android-save-picker.mjs';
import { checkAndroidCatalogApk } from './check-android-catalog.mjs';

const [serial, initialArgument, updateArgument, expectedArgument, evidenceArgument] = process.argv.slice(2);
assert.ok(serial && initialArgument && updateArgument && expectedArgument && evidenceArgument, 'Usage: emulator-N signed-proof.apk release.apk expected-synthetic-backup.json /outside/git/evidence');
const initial = resolve(initialArgument), update = resolve(updateArgument), expectedFile = resolve(expectedArgument), evidence = resolve(evidenceArgument);
mkdirSync(evidence); // Preserve evidence: a prior directory is never overwritten.
const expected = decodeLibraryBackup(readFileSync(expectedFile, 'utf8'));
const device = catalogDevice(serial), ui = androidUi(device);
const tools = join(process.env.ANDROID_HOME, 'build-tools/36.0.0');
function packageInfo(apk) {
  const badging = execFileSync(join(tools, 'aapt'), ['dump', 'badging', apk], { encoding: 'utf8' });
  const version = Number(badging.match(/versionCode='(\d+)'/)?.[1]);
  assert.ok(badging.includes(`package: name='${appId}'`));
  assert.ok(Number.isSafeInteger(version) && version > 0);
  const certificates = execFileSync(join(tools, 'apksigner'), ['verify', '--print-certs', apk], { encoding: 'utf8' });
  const digest = certificates.match(/Signer #1 certificate SHA-256 digest: ([a-f0-9]+)/)?.[1];
  assert.ok(digest, 'APK must have a valid signer');
  return { version, digest, debuggable: badging.includes('application-debuggable') };
}
const first = packageInfo(initial), next = packageInfo(update);
assert.equal(first.digest, next.digest, 'Update must use the retained initial signing key');
assert.ok(first.debuggable, 'Initial synthetic proof requires the explicit instrumented variant');
assert.equal(next.debuggable, false, 'Final release must disable debugging');
assert.ok(next.version > first.version, 'Update versionCode must increase');
await checkAndroidCatalogApk(initial, new URL('../../../web/public/catalog/manifest.json', import.meta.url));
await checkAndroidCatalogApk(update, new URL('../../../web/public/catalog/manifest.json', import.meta.url));

async function exportUsingNativeUi(label) {
  const before = downloadNames(device.adb);
  await ui.tap(node => node.text === 'Back up & restore', 'backup button');
  await ui.tap(node => node.text === 'Save library backup file', 'save backup');
  await chooseDownloadsAndSave({ adb: device.adb, pause });
  device.adb('shell', 'input', 'keyevent', '4');
  const created = [...downloadNames(device.adb)].filter(name => !before.has(name));
  assert.equal(created.length, 1, 'Expected exactly one provider-written backup');
  const text = readDownload(device.adbBytes, created[0]);
  const decoded = decodeLibraryBackup(text);
  assert.equal(canonicalSnapshot(decoded), canonicalSnapshot(expected), `${label} changed the complete authored library`);
  writeFileSync(join(evidence, `${label}.json`), text);
  return created[0];
}

try {
  const installed = device.adb('shell', 'pm', 'list', 'packages', appId);
  if (!installed) device.adb('install', initial);
  else assert.match(device.adb('shell', 'dumpsys', 'package', appId), new RegExp(`versionCode=${first.version}\\b`), 'Resume requires the exact synthetic initial build');
  await device.start();
  const existing = await catalogLibrarySnapshot(device);
  if (existing.drafts.length === 0 && existing.playlists.length === 0) {
    const filename = `CruxControl-signed-synthetic-${Date.now()}.json`;
    device.adb('push', expectedFile, `/sdcard/Download/${filename}`);
    await device.click('Back up & restore');
    await ui.tap(node => node['resource-id'] === 'library-backup-file', 'backup file input');
    writeFileSync(join(evidence, 'system-import-picker.xml'), await chooseDownloadedFile(device, filename));
    await device.waitFor("document.body.innerText.includes('Review recovery')", 'Native chooser did not return selected backup');
    await device.click(`Add ${expected.drafts.length} climbs & ${expected.playlists.length} playlists`);
    await device.waitFor("document.body.innerText.includes('Recovery complete')", 'Native chooser restore failed');
    await device.click('Close backup and restore');
  } else assert.equal(canonicalSnapshot(existing), canonicalSnapshot(expected), 'Existing proof library must match exactly; no reset permitted');
  assert.equal(canonicalSnapshot(await catalogLibrarySnapshot(device)), canonicalSnapshot(expected));
  await device.restart();
  const beforeFilename = await exportUsingNativeUi('before-update');
  await device.detach();
  device.adb('install', '-r', update); // Never -d, uninstall, reset or a changed app ID.
  device.adb('shell', 'am', 'start', '-n', `${appId}/.MainActivity`);
  await pause(1200);
  const afterFilename = await exportUsingNativeUi('after-update');
  device.adb('shell', 'am', 'force-stop', appId);
  device.adb('shell', 'am', 'start', '-n', `${appId}/.MainActivity`);
  await pause(1200);
  await exportUsingNativeUi('release-relaunch');
  writeFileSync(join(evidence, 'result.json'), JSON.stringify({ initial: { filename: basename(initial), ...first }, update: { filename: basename(update), ...next }, beforeFilename, afterFilename, completeCanonicalEqual: true, realReleaseUiExport: true, source: 'explicit synthetic backup', physicalBoardAccepted: false }, null, 2));
  console.log('Retained-key signed proof → non-debuggable release upgrade/relaunch preserved the complete synthetic library through actual SAF exports');
} finally { await device.detach(); }

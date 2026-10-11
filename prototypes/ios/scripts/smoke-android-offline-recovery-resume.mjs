// Follow the preserving app update after smoke-android-recovery-hold.mjs.
// The real coordinator must verify committed SQLite content without a network,
// allow ordinary editing, then automatically protect the entire large library.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { canonicalSnapshot, decodeLibraryBackup } from '../../../web/src/library-backup/codec.ts';
import { catalogDevice, pause } from './android-catalog-device.mjs';
import { preservedLibrarySnapshot, writePreservationEvidence } from './android-preservation-evidence.mjs';

const [serial, outputArgument, expectedArgument] = process.argv.slice(2);
assert(/^emulator-\d+$/.test(serial ?? '') && outputArgument && expectedArgument);
const baseline = decodeLibraryBackup(await readFile(expectedArgument, 'utf8'));
assert.equal(baseline.drafts.length, 10_000);
assert.equal(baseline.playlists.length, 1_000);
assert(baseline.drafts.every(d => /^(Prototype|Synthetic) /.test(d.name)));
const climb = baseline.drafts.find(d => d.id === '00000000-0000-4000-8000-000000000902');
const playlist = baseline.playlists.find(p => p.name === 'Prototype mixed');
assert(climb && playlist && playlist.entries.some(e => e.kind === 'local' && e.id === climb.id));
const output = resolve(outputArgument);
execFileSync('git', ['check-ignore', '--quiet', `${output}/result.json`]);
await mkdir(output, { mode: 0o700 });
const device = catalogDevice(serial);
assert.equal(device.adb('shell', 'settings', 'get', 'global', 'airplane_mode_on'), '1',
  'The interrupted-restore emulator must still be offline during its preserving update');
const save = (name, value) => writeFile(`${output}/${name}.json`, JSON.stringify(value, null, 2), { mode: 0o600, flag: 'wx' });
async function record() {
  const rows = await device.evaluate(`window.Capacitor.Plugins.CapacitorSQLite.query({database:'cruxcontrol-library',
    statement:'SELECT revision, control, recovery_revision FROM library_preservation',values:[],readonly:false}).then(r=>r.values)`);
  assert.equal(rows.length, 1);
  return { revision: rows[0].revision, recoveryRevision: rows[0].recovery_revision, control: JSON.parse(rows[0].control) };
}
async function waitRecord(predicate, label, milliseconds = 300_000) {
  const deadline = Date.now() + milliseconds;
  while (Date.now() < deadline) {
    const value = await record();
    if (predicate(value)) return value;
    await pause(250);
  }
  throw new Error(label);
}
async function protect() {
  const value = await waitRecord(r => r.recoveryRevision === null && r.control.pending === null
    && r.control.protected?.revision === r.revision, 'Full library did not receive an exact current receipt');
  await device.waitFor("document.querySelector('.automatic-backup-status strong')?.innerText==='All saved changes backed up'", 'Protected status missing', 1200);
  return value;
}
async function edit(grade, previousRevision) {
  await device.click('Lists', true);
  await device.click(playlist.name, true);
  await device.click(`Edit ${climb.name}`);
  await device.setValue('.editor-fields input[placeholder="e.g. V4 or 6B"]', grade);
  await waitRecord(r => r.revision > previousRevision, 'Ordinary editing stayed blocked after local verification');
  await device.waitFor("document.querySelector('.save-chip')?.innerText.toLowerCase()==='saved'", 'Local save failed', 480);
  await device.click('Back');
  const current = (await preservedLibrarySnapshot(device)).snapshot;
  const changed = current.drafts.find(d => d.id === climb.id);
  const expected = { drafts: baseline.drafts.map(d => d.id === climb.id ? { ...d,
    revision: changed.revision, updatedAt: changed.updatedAt, metadata: { ...d.metadata, grade } } : d),
    playlists: baseline.playlists };
  assert.equal(canonicalSnapshot(current), canonicalSnapshot(expected), 'Editing changed unrelated fields or ordering');
}
try {
  await device.start();
  const vault = await device.evaluate("window.Capacitor.nativePromise('PrivateVault','status',{})");
  assert(vault.configured && vault.scope === 'acceptance-v1/r002' && vault.account);
  assert.equal(await device.evaluate('navigator.onLine'), false);
  const verified = await waitRecord(r => r.recoveryRevision === null, 'Local recovery hold did not clear offline');
  assert.equal(await device.evaluate('navigator.onLine'), false, 'Verification accidentally used connectivity');
  await writePreservationEvidence(device, `${output}/verified-offline.json`, expectedArgument);
  await save('verified-offline-control', verified);
  await edit('V8', verified.revision);
  const offline = await record();
  assert.equal(await device.evaluate('navigator.onLine'), false);
  assert.notEqual(offline.control.protected?.revision, offline.revision);
  await writePreservationEvidence(device, `${output}/authored-offline.json`);

  device.adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'disable');
  await device.waitFor('navigator.onLine===true', 'Connectivity did not return');
  await device.evaluate("document.querySelector('.automatic-backup-status button').click()");
  await device.click('Use this phone’s library');
  await device.click('Close private backup');
  const admitted = await protect();
  assert.equal(admitted.control.protected.snapshot.counts.climbs, 10_000);
  assert.equal(admitted.control.protected.snapshot.counts.playlists, 1_000);
  assert(admitted.control.protected.snapshot.bytes > 26_000_000);
  await save('full-admission-upload', admitted);

  // An ordinary subsequent edit must be protected by the production debounce,
  // without pressing Retry, adopting again, or staging through operator tooling.
  await edit('V9', admitted.revision);
  const automatic = await protect();
  assert.equal(automatic.control.protected.snapshot.counts.climbs, 10_000);
  assert(automatic.control.protected.snapshot.bytes > 26_000_000);
  assert.equal(automatic.control.history.length, admitted.control.history.length + 1);
  assert.notEqual(automatic.control.protected.snapshot.sha256, admitted.control.protected.snapshot.sha256);
  await save('full-automatic-upload', automatic);
  await writePreservationEvidence(device, `${output}/final.json`);
  await device.restart();
  const reopened = await protect();
  assert.deepEqual(reopened.control.history, automatic.control.history);
  assert.deepEqual(reopened.control.protected, automatic.control.protected);
  await writePreservationEvidence(device, `${output}/reopened.json`, `${output}/final.json.backup.json`);
  await save('result', { ok: true, localVerificationWhileOffline: true, offlineAuthoringAfterRecovery: true,
    fullAutomaticCaptureUpload: true, exactCurrentRevision: true, exactReopenContent: true,
    climbs: 10_000, playlists: 1_000, revision: reopened.revision,
    remoteSlot: reopened.control.protected.snapshot.slot, remoteSha256: reopened.control.protected.snapshot.sha256 });
  console.log('Offline recovery verification, ordinary editing and full-size automatic uploads passed.');
} finally {
  device.adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'disable');
  await device.detach();
}

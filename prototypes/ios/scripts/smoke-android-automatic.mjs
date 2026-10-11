// Real UI + native service acceptance on two explicitly synthetic emulators.
// No injected backup/restore calls: JavaScript instrumentation reads evidence
// and activates the same controls as the user. Never clears or uninstalls data.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { canonicalSnapshot, decodeLibraryBackup } from '../../../web/src/library-backup/codec.ts';
import { appId, catalogDevice, pause } from './android-catalog-device.mjs';
import { preservedLibrarySnapshot, writePreservationEvidence } from './android-preservation-evidence.mjs';

const [sourceSerial, recoverySerial, outputArgument, baselineArgument] = process.argv.slice(2);
assert(/^emulator-\d+$/.test(sourceSerial ?? '') && /^emulator-\d+$/.test(recoverySerial ?? '')
  && sourceSerial !== recoverySerial && outputArgument && baselineArgument,
  'Usage: node --experimental-strip-types smoke-android-automatic.mjs SOURCE_EMULATOR RECOVERY_EMULATOR NEW_PRIVATE_DIRECTORY SYNTHETIC_SOURCE_BASELINE');
const output = resolve(outputArgument);
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
if (output === root || output.startsWith(`${root}/`)) execFileSync('git', ['check-ignore', '--quiet', `${output}/result.json`]);
await mkdir(output, { mode: 0o700 });
const baseline = decodeLibraryBackup(await readFile(baselineArgument, 'utf8'));
assert.equal(baseline.drafts.length, 8);
assert(baseline.drafts.every(d => /^(Prototype|Synthetic) /.test(d.name)), 'Synthetic records required');
const playlist = baseline.playlists.find(p => p.name === 'Prototype mixed');
assert(playlist && playlist.entries.length >= 2 && playlist.entries[0].kind === 'local');
const climb = baseline.drafts.find(d => d.id === playlist.entries[0].id);
assert(climb && !climb.trashedAt);
const onlineGrade = climb.metadata.grade === 'V4' ? 'V5' : 'V4';
const offlineGrade = 'V6';
const source = catalogDevice(sourceSerial), recovery = catalogDevice(recoverySerial);
const originalAirplane = source.adb('shell', 'settings', 'get', 'global', 'airplane_mode_on');
const originalWifi = source.adb('shell', 'settings', 'get', 'global', 'wifi_on');
const originalData = source.adb('shell', 'settings', 'get', 'global', 'mobile_data');
assert.equal(originalAirplane, '0', 'Begin the acceptance online');
const save = (name, value) => writeFile(`${output}/${name}.json`, JSON.stringify(value, null, 2), { mode: 0o600, flag: 'wx' });

async function record(device) {
  const rows = await device.evaluate(`window.Capacitor.Plugins.CapacitorSQLite.query({database:'cruxcontrol-library',
    statement:'SELECT revision, control, recovery_revision FROM library_preservation',values:[],readonly:false}).then(r=>r.values)`);
  assert.equal(rows.length, 1);
  return { revision: rows[0].revision, control: JSON.parse(rows[0].control), recoveryRevision: rows[0].recovery_revision };
}
async function waitRecord(device, predicate, label, timeout = 120_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const state = await record(device);
    if (predicate(state)) return state;
    await pause(250);
  }
  throw new Error(label);
}
async function protectedState(device) {
  const state = await waitRecord(device, r => r.control.protected?.revision === r.revision
    && r.control.pending === null && r.recoveryRevision === null, 'Current revision never received a verified backup');
  await device.waitFor("document.querySelector('.automatic-backup-status strong')?.innerText === 'All saved changes backed up'",
    'UI did not acknowledge the verified current revision', 480);
  return state;
}
async function assertStatusLayout(device) {
  const box = await device.evaluate(`(() => {
    const status = document.querySelector('.automatic-backup-status');
    const copy = status.querySelector('.automatic-backup-status__copy').getBoundingClientRect();
    const button = status.querySelector('button').getBoundingClientRect();
    return { viewport: innerWidth, status: status.getBoundingClientRect().toJSON(),
      copy: copy.toJSON(), button: button.toJSON() };
  })()`);
  assert(box.copy.width >= Math.min(160, box.viewport * 0.35), 'Status copy is squeezed by its action');
  assert(box.button.left >= box.copy.right && box.button.right <= box.status.right, 'Status action overlaps or overflows');
  return box;
}
async function manage(device) {
  await device.waitFor("!!document.querySelector('.automatic-backup-status button')", 'Automatic status is absent');
  await device.evaluate("document.querySelector('.automatic-backup-status button').click()");
  await device.waitFor("!!document.querySelector('.automatic-backup-manage[open]')", 'Manage did not open');
}
async function editGrade(value, previousRevision) {
  await source.click('Lists', true);
  await source.click(playlist.name, true);
  await source.click(`Edit ${climb.name}`);
  await source.setValue('.editor-fields input[placeholder="e.g. V4 or 6B"]', value);
  await waitRecord(source, r => r.revision > previousRevision, 'Grade did not reach durable native storage');
  await source.waitFor("document.querySelector('.save-chip')?.innerText.toLowerCase() === 'saved'", 'Grade save never finished');
  await source.click('Back');
}
function assertAuthoredChanges(snapshot, grade, entries) {
  const changedClimb = snapshot.drafts.find(d => d.id === climb.id);
  const changedPlaylist = snapshot.playlists.find(p => p.id === playlist.id);
  assert(changedClimb && changedPlaylist);
  const expected = {
    drafts: baseline.drafts.map(d => d.id === climb.id ? { ...d,
      revision: changedClimb.revision, updatedAt: changedClimb.updatedAt,
      metadata: { ...d.metadata, grade } } : d),
    playlists: baseline.playlists.map(p => p.id === playlist.id ? { ...p,
      revision: changedPlaylist.revision, updatedAt: changedPlaylist.updatedAt, entries } : p),
  };
  assert.equal(canonicalSnapshot(snapshot), canonicalSnapshot(expected),
    'Grade/list edits changed unrelated saved content');
}

try {
  await source.start();
  const sourceVault = await source.evaluate("window.Capacitor.nativePromise('PrivateVault','status',{})");
  assert(sourceVault.configured && sourceVault.scope === 'acceptance-v1/r002' && sourceVault.account?.uid,
    'Source must be signed into the isolated automatic acceptance pool');
  assert.equal(canonicalSnapshot((await preservedLibrarySnapshot(source)).snapshot), canonicalSnapshot(baseline));
  await writePreservationEvidence(source, `${output}/source-before.json`, baselineArgument);
  const beforeAdmission = await record(source);
  if (beforeAdmission.control.admission !== 'active') {
    await manage(source);
    await source.click('Use this phone’s library');
    await source.click('Close private backup');
  }
  const first = await protectedState(source);
  await save('status-layout', await assertStatusLayout(source));
  assert(first.control.history.length >= 1, 'The source needs a verified initial copy');
  if (beforeAdmission.control.history.length === 0) assert.equal(first.control.history.length, 1);
  await save('initial-protection', first);

  await editGrade(onlineGrade, first.revision);
  assert.notEqual(await source.evaluate("document.querySelector('.automatic-backup-status strong')?.innerText"),
    'All saved changes backed up', 'Newly saved content borrowed an earlier receipt');
  const beforeReorder = await record(source);
  await source.click(`Move down ${climb.name}`);
  await waitRecord(source, r => r.revision > beforeReorder.revision, 'List order was not saved');
  // No Retry action: the production coalescing timer must protect these changes.
  const edited = await protectedState(source);
  assert(edited.revision >= first.revision + 2);
  const afterEdits = (await preservedLibrarySnapshot(source)).snapshot;
  assert.equal(afterEdits.drafts.find(d => d.id === climb.id).metadata.grade, onlineGrade);
  const expectedOrder = [...playlist.entries];
  [expectedOrder[0], expectedOrder[1]] = [expectedOrder[1], expectedOrder[0]];
  assert.deepEqual(afterEdits.playlists.find(p => p.id === playlist.id).entries, expectedOrder);
  assertAuthoredChanges(afterEdits, onlineGrade, expectedOrder);
  await writePreservationEvidence(source, `${output}/source-after-edits.json`);
  await save('automatic-edit-protection', edited);

  source.adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'enable');
  await source.waitFor('navigator.onLine === false', 'Emulator did not become offline');
  await editGrade(offlineGrade, edited.revision);
  const offline = await record(source);
  assert(offline.revision > offline.control.protected.revision);
  assertAuthoredChanges((await preservedLibrarySnapshot(source)).snapshot, offlineGrade, expectedOrder);
  await writePreservationEvidence(source, `${output}/source-offline.json`);
  await source.restart();
  await writePreservationEvidence(source, `${output}/source-offline-restarted.json`, `${output}/source-offline.json.backup.json`);
  assert.notEqual(await source.evaluate("document.querySelector('.automatic-backup-status strong')?.innerText"),
    'All saved changes backed up');
  source.adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'disable');
  await source.waitFor('navigator.onLine === true', 'Connectivity did not return');
  const resumed = await protectedState(source);
  assert.equal(resumed.control.protected.revision, offline.revision);
  await save('automatic-resume-protection', resumed);
  await writePreservationEvidence(source, `${output}/source-resumed.json`, `${output}/source-offline.json.backup.json`);

  // Emulator console delay affects cellular traffic, not Wi-Fi. Leave the
  // production coordinator/transport untouched and stop the process only after
  // it has committed real pending metadata and published its uploading state.
  source.adb('shell', 'svc', 'data', 'enable');
  source.adb('shell', 'svc', 'wifi', 'disable');
  await source.waitFor('navigator.onLine === true', 'Cellular connectivity did not become available');
  source.adb('emu', 'network', 'delay', '10000');
  await editGrade('V7', resumed.revision);
  await writePreservationEvidence(source, `${output}/source-before-interruption.json`);
  const interrupted = await waitRecord(source, r => r.control.pending?.revision === r.revision,
    'No durable pending upload was observed');
  await source.waitFor("document.querySelector('.automatic-backup-status')?.innerText.includes('Checking a new online copy')",
    'Pending upload never reached its visible committed state');
  assertAuthoredChanges((await preservedLibrarySnapshot(source)).snapshot, 'V7', expectedOrder);
  await save('pending-before-interruption', interrupted);
  await source.detach();
  source.adb('shell', 'am', 'force-stop', appId);
  assert.match(interrupted.control.pending.id, /^[a-zA-Z0-9-]+$/);
  const retained = source.adb('shell', 'run-as', appId, 'find', 'no_backup', '-name', `${interrupted.control.pending.id}.sealed`);
  assert(retained.endsWith(`${interrupted.control.pending.id}.sealed`), 'Pending sealed file did not survive process exit');
  source.adb('emu', 'network', 'delay', 'none');
  source.adb('shell', 'svc', 'wifi', originalWifi === '1' ? 'enable' : 'disable');
  await source.start();
  const finalProtected = await protectedState(source);
  assert.equal(finalProtected.control.protected.revision, interrupted.control.pending.revision);
  assert.equal(finalProtected.control.protected.snapshot.slot, interrupted.control.pending.slot);
  assert.equal(finalProtected.control.protected.snapshot.sha256, interrupted.control.pending.staged.sha256);
  assert.equal(finalProtected.control.protected.snapshot.bytes, interrupted.control.pending.staged.bytes);
  assert.equal(finalProtected.control.history.length, resumed.control.history.length + 1);
  await save('pending-restart-protection', finalProtected);
  await writePreservationEvidence(source, `${output}/source-final.json`, `${output}/source-before-interruption.json.backup.json`);

  await recovery.start();
  const recoveryVault = await recovery.evaluate("window.Capacitor.nativePromise('PrivateVault','status',{})");
  assert.equal(recoveryVault.scope, sourceVault.scope);
  assert.equal(recoveryVault.account?.uid, sourceVault.account.uid);
  assert.notEqual(recoveryVault.installationId, sourceVault.installationId);
  const empty = (await preservedLibrarySnapshot(recovery)).snapshot;
  assert.equal(empty.drafts.length, 0);
  assert.equal(empty.playlists.length, 0);
  await writePreservationEvidence(recovery, `${output}/recovery-before.json`);
  await manage(recovery);
  await recovery.waitFor("!!document.querySelector('.automatic-backup-manage__versions li:first-child button:not(:disabled)')",
    'Separate installation did not discover retained history', 480);
  await recovery.evaluate("document.querySelector('.automatic-backup-manage__versions li:first-child button').click()");
  await recovery.click(`Restore ${baseline.drafts.length} climbs and ${baseline.playlists.length} lists`);
  await recovery.waitFor("document.querySelector('.automatic-backup-manage__result h3')?.innerText === 'Recovery saved'",
    'Cloud recovery did not complete', 480);
  await recovery.click('Close private backup');
  const recovered = await protectedState(recovery);
  assert.deepEqual(recovered.control.protected.snapshot, finalProtected.control.protected.snapshot);
  assert.equal(recovered.control.history.length, finalProtected.control.history.length, 'Recovery created a duplicate copy');
  await writePreservationEvidence(recovery, `${output}/recovery-after.json`, `${output}/source-final.json.backup.json`);
  await recovery.restart();
  await protectedState(recovery);
  await writePreservationEvidence(recovery, `${output}/recovery-reopened.json`, `${output}/source-final.json.backup.json`);
  await save('result', { ok: true, inAppRecovery: true, independentInstallation: true,
    automaticEdits: true, offlineRestartAndAutomaticResume: true, exactRecordsAndOrdering: true,
    pendingStageSurvivesRestart: true, exactPendingReceipt: true,
    noDuplicateRecoveryUpload: true, sourceRevision: finalProtected.revision, recoveryRevision: recovered.revision,
    climbs: baseline.drafts.length, playlists: baseline.playlists.length });
  console.log('Automatic edit/offline restart and independent in-app recovery passed.');
} finally {
  source.adb('emu', 'network', 'delay', 'none');
  source.adb('shell', 'svc', 'wifi', originalWifi === '1' ? 'enable' : 'disable');
  source.adb('shell', 'svc', 'data', originalData === '1' ? 'enable' : 'disable');
  source.adb('shell', 'cmd', 'connectivity', 'airplane-mode', originalAirplane === '1' ? 'enable' : 'disable');
  await source.detach();
  await recovery.detach();
}

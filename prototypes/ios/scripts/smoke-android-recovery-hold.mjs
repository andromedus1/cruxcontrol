// Interrupt normal UI recovery at its persisted verification barrier. Synthetic
// emulator only: never changes a database row or injects a restore implementation.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { appId, catalogDevice, pause } from './android-catalog-device.mjs';
import { writePreservationEvidence } from './android-preservation-evidence.mjs';

const [serial, outputArgument, expectedArgument, slot] = process.argv.slice(2);
assert(/^emulator-\d+$/.test(serial ?? '') && outputArgument && expectedArgument && /^\d{5}$/.test(slot ?? ''));
const expected = JSON.parse(await readFile(expectedArgument, 'utf8'));
assert.equal(expected.drafts.length, 10_000);
assert.equal(expected.playlists.length, 1_000);
const output = resolve(outputArgument);
execFileSync('git', ['check-ignore', '--quiet', `${output}/result.json`]);
await mkdir(output, { mode: 0o700 });
const device = catalogDevice(serial);
const originalAirplane = device.adb('shell', 'settings', 'get', 'global', 'airplane_mode_on');
assert.equal(originalAirplane, '0');
let retainOffline = false;
async function record() {
  const rows = await device.evaluate(`window.Capacitor.Plugins.CapacitorSQLite.query({database:'cruxcontrol-library',
    statement:'SELECT revision, control, recovery_revision, recovery_sha256 FROM library_preservation',
    values:[],readonly:false}).then(r=>r.values)`);
  assert.equal(rows.length, 1);
  return { ...rows[0], control: JSON.parse(rows[0].control) };
}
try {
  await device.start();
  const vault = await device.evaluate("window.Capacitor.nativePromise('PrivateVault','status',{})");
  assert(vault.configured && vault.scope === 'acceptance-v1/r002' && vault.account);
  const before = await writePreservationEvidence(device, `${output}/before.json`);
  assert.equal(before.climbs, 8);
  assert.equal(before.playlists, 3);
  await device.evaluate("document.querySelector('.automatic-backup-status button').click()");
  await device.click('Refresh history');
  await device.waitFor("[...document.querySelectorAll('.automatic-backup-manage button')].some(b=>b.innerText==='Refresh history'&&!b.disabled)", 'History failed');
  const target = (await record()).control.history.find(s => s.slot === slot);
  assert(target && target.counts.climbs === 10_000);
  const chosen = await device.evaluate(`(()=>{
    const label='Saved '+new Date(${JSON.stringify(target.createdAt)}).toLocaleString();
    const rows=[...document.querySelectorAll('.automatic-backup-manage__versions li')].filter(r=>r.querySelector('h4')?.innerText===label);
    if(rows.length!==1)return false; rows[0].querySelector('button').click();return true;
  })()`);
  assert(chosen);
  await device.waitFor("!!document.querySelector('.automatic-backup-manage__review h3')", 'Review failed', 1200);
  await device.click('Restore 9992 climbs and 997 lists');
  let held;
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    const current = await record();
    if (current.recovery_revision !== null) { held = current; break; }
    await pause(50);
  }
  assert(held, 'Never observed a verification barrier; do not fabricate one');
  // The independent reopen below establishes that the barrier/records committed.
  // A too-early interruption would roll back and fail the canonical comparison.
  await pause(250);
  await device.detach();
  device.adb('shell', 'am', 'force-stop', appId);
  device.adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'enable');
  await device.start();
  await device.waitFor('navigator.onLine === false', 'Offline launch required');
  const reopened = await record();
  assert.equal(reopened.revision, held.recovery_revision);
  assert.equal(reopened.recovery_revision, reopened.revision,
    'This pre-fix reproduction expects the offline hold to remain');
  assert.equal(reopened.recovery_sha256, held.recovery_sha256);
  const verified = await writePreservationEvidence(device, `${output}/offline-held.json`, expectedArgument);
  await pause(3000);
  assert.equal((await record()).recovery_revision, reopened.revision);
  await writeFile(`${output}/result.json`, JSON.stringify({ reproduced: true,
    committedRestoreHeldOffline: true, exactCommittedContent: true,
    revision: reopened.revision, canonicalSha256: verified.canonicalSha256,
    climbs: 10_000, playlists: 1_000, leftOfflineForPreservingUpdate: true }, null, 2), { mode: 0o600, flag: 'wx' });
  retainOffline = true;
  console.log('Real interrupted restore reproduced the offline verification hold; complete library preserved.');
} finally {
  if (!retainOffline) device.adb('shell', 'cmd', 'connectivity', 'airplane-mode', originalAirplane === '1' ? 'enable' : 'disable');
  await device.detach();
}

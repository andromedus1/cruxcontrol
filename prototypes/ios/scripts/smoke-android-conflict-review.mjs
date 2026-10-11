// Focused acceptance for reviewing an older, conflicting retained copy. The
// normal Manage UI discovers and reviews the copy; SQLite access is read-only
// evidence. This script never restores, edits records, or changes cloud state.
//
// Close any editor/dialog normally before starting this driver. It expects the
// synthetic 8/3 baseline after the saved V7 edit and Prototype mixed reorder.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmod, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { canonicalSnapshot, decodeLibraryBackup } from '../../../web/src/library-backup/codec.ts';
import { VAULT_SLOT_PATTERN } from '../../../web/src/private-vault/contract.ts';
import { catalogDevice, pause } from './android-catalog-device.mjs';
import { preservedLibrarySnapshot } from './android-preservation-evidence.mjs';

const [serial, outputArgument, baselineArgument, targetSlot] = process.argv.slice(2);
assert(/^emulator-\d+$/.test(serial ?? '') && outputArgument && baselineArgument
  && VAULT_SLOT_PATTERN.test(targetSlot ?? '') && Number(targetSlot) <= 511,
'Usage: node --experimental-strip-types smoke-android-conflict-review.mjs EMULATOR NEW_PRIVATE_OUTPUT_DIR RECOVERED_SYNTHETIC_BASELINE STAGED_CLOUD_SLOT');

const output = resolve(outputArgument);
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
if (output === root || output.startsWith(`${root}/`)) {
  execFileSync('git', ['check-ignore', '--quiet', output]);
}
await assert.rejects(lstat(output), { code: 'ENOENT' }, 'Output directory must be new');
await mkdir(output, { recursive: true, mode: 0o700 });
await chmod(output, 0o700);

const baseline = decodeLibraryBackup(await readFile(baselineArgument, 'utf8'));
assert.equal(baseline.drafts.length, 8, 'Use the recovered synthetic 8-climb baseline');
assert.equal(baseline.playlists.length, 3, 'Use the recovered synthetic 3-list baseline');
const changedClimb = baseline.drafts.find(draft => draft.id === '00000000-0000-4000-8000-000000000902');
const reorderedList = baseline.playlists.find(playlist => playlist.id === '00000000-0000-4000-8000-000000000906');
assert.equal(changedClimb?.metadata.grade, 'V7', 'Baseline must include the accepted V7 edit');
assert.equal(reorderedList?.name, 'Prototype mixed');
assert.deepEqual(reorderedList?.entries.slice(0, 2).map(entry => entry.id), [
  '00000000-0000-4000-8000-000000000901',
  '00000000-0000-4000-8000-000000000902',
], 'Baseline must include the accepted Prototype mixed reorder');

const device = catalogDevice(serial);

async function readPreservationRecord() {
  const rows = await device.evaluate(`window.Capacitor.Plugins.CapacitorSQLite.query({
    database:'cruxcontrol-library', statement:'SELECT revision, control, recovery_revision FROM library_preservation',
    values:[], readonly:false }).then(result => result.values)`);
  assert.equal(rows.length, 1, 'Expected the v2 library-preservation record');
  return {
    revision: rows[0].revision,
    control: JSON.parse(rows[0].control),
    recoveryRevision: rows[0].recovery_revision,
  };
}

async function waitForRecord(predicate, label, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const record = await readPreservationRecord();
    if (predicate(record)) return record;
    await pause(500);
  }
  throw new Error(label);
}

async function waitForUi(expression, label, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await device.evaluate(expression)) return;
    await pause(500);
  }
  throw new Error(`${label}\n${await device.evaluate('document.body.innerText')}`);
}

async function openManage() {
  const alreadyOpen = await device.evaluate("!!document.querySelector('.automatic-backup-manage[open]')");
  if (alreadyOpen) {
    await device.click('Close private backup');
    await waitForUi("!document.querySelector('.automatic-backup-manage[open]')", 'Manage did not close');
  }
  await waitForUi("!!document.querySelector('.automatic-backup-status button')", 'Automatic backup status is absent');
  await device.evaluate("document.querySelector('.automatic-backup-status button').click()");
  await waitForUi("!!document.querySelector('.automatic-backup-manage[open]')", 'Manage did not open');
}

async function refreshHistory() {
  await device.click('Refresh history');
  await waitForUi(`(() => {
    const button = [...document.querySelectorAll('.automatic-backup-manage button')]
      .find(item => item.innerText.trim() === 'Refresh history');
    return Boolean(button && !button.disabled);
  })()`, 'History refresh did not finish');
}

function historyOf(record) {
  const snapshots = record.control.history;
  assert(Array.isArray(snapshots), 'Expected the complete retained-copy history');
  assert.equal(new Set(snapshots.map(snapshot => snapshot.slot)).size, snapshots.length,
    'History contains duplicate slots');
  return snapshots;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

async function reviewTarget(snapshot) {
  const clicked = await device.evaluate(`(() => {
    const expectedDate = new Date(${JSON.stringify(snapshot.createdAt)}).toLocaleString();
    const expectedSize = ${JSON.stringify(formatBytes(snapshot.bytes))};
    const rows = [...document.querySelectorAll('.automatic-backup-manage__versions li')]
      .filter(row => row.querySelector('h4')?.innerText.trim() === 'Saved ' + expectedDate
        && row.querySelector('p')?.innerText.trim() === expectedSize);
    if (rows.length !== 1) return { count: rows.length };
    const button = rows[0].querySelector('button[aria-label^="Review backup saved "]');
    if (!button || button.disabled) return { count: 0 };
    button.click();
    return { count: 1, label: button.getAttribute('aria-label') };
  })()`);
  assert.equal(clicked.count, 1, 'The selected receipt must have one visible history row');
  await waitForUi("!!document.querySelector('.automatic-backup-manage__review h3')",
    'Manage did not show the selected copy review');
  return clicked.label;
}

async function readReview() {
  return device.evaluate(`(() => {
    const section = document.querySelector('.automatic-backup-manage__review');
    if (!section) return null;
    const values = Object.fromEntries([...section.querySelectorAll('dl div')].map(row => [
      row.querySelector('dt')?.innerText.trim(), row.querySelector('dd')?.innerText.trim(),
    ]));
    const conflictRows = [...section.querySelectorAll('.automatic-backup-manage__conflicts li')]
      .map(row => ({ name: row.querySelector('strong')?.innerText.trim(),
        detail: row.querySelector('span')?.innerText.trim() }));
    const restoreActions = [...section.querySelectorAll('button')]
      .filter(button => /restore/i.test([button.innerText, button.getAttribute('aria-label')]
        .filter(Boolean).join(' ')))
      .map(button => ({ disabled: button.disabled, label: button.innerText.trim() }));
    return { values, conflictRows, restoreActions, text: section.innerText };
  })()`);
}

function normalizedHistory(history) {
  return [...history].sort((left, right) => left.slot.localeCompare(right.slot));
}

async function assertBaseline(device, baselineCanonical, expectedRevision, label) {
  const captured = await preservedLibrarySnapshot(device);
  assert.equal(canonicalSnapshot(captured.snapshot), baselineCanonical, label);
  assert.equal(captured.revision, expectedRevision, `${label}: aggregate revision changed`);
  return captured;
}

async function saveEvidence(value) {
  await writeFile(resolve(output, 'result.json'), `${JSON.stringify(value, null, 2)}\n`,
    { mode: 0o600, flag: 'wx' });
}

try {
  await device.start();
  assert.equal(await device.evaluate('window.Capacitor.getPlatform()'), 'android');
  const vault = await device.evaluate("window.Capacitor.nativePromise('PrivateVault','status',{})");
  assert(vault.configured && vault.account && vault.scope === 'acceptance-v1/r002',
    'Use the signed synthetic automatic-acceptance pool');

  const initial = await preservedLibrarySnapshot(device);
  const baselineCanonical = canonicalSnapshot(baseline);
  assert.equal(canonicalSnapshot(initial.snapshot), baselineCanonical,
    'The target emulator must contain the supplied post-edit 8/3 baseline');
  const initialRecord = await readPreservationRecord();
  assert.equal(initial.revision, initialRecord.revision);
  assert.equal(initialRecord.recoveryRevision, null, 'Baseline must not have an unresolved recovery hold');

  await openManage();
  await refreshHistory();
  await waitForRecord(record => historyOf(record).some(item => item.slot === targetSlot),
    'Manage history did not discover the specified older cloud slot');
  const listedRecord = await readPreservationRecord();
  const historyBefore = normalizedHistory(historyOf(listedRecord));
  const target = historyBefore.find(item => item.slot === targetSlot);
  assert(target, 'The specified cloud slot is absent from retained history');
  assert.equal(target.counts.climbs, baseline.drafts.length);
  assert.equal(target.counts.playlists, baseline.playlists.length);
  assert(historyBefore.some(item => Date.parse(item.createdAt) > Date.parse(target.createdAt)),
    'The selected copy must predate the accepted later copy');
  const visibleHistoryCount = await device.evaluate(
    "document.querySelectorAll('.automatic-backup-manage__versions li').length");
  assert.equal(visibleHistoryCount, historyBefore.length,
    'Manage did not display the complete discovered history');

  await reviewTarget(target);
  const review = await readReview();
  assert(review, 'Expected a visible review for the selected older copy');
  assert.equal(review.values['Climbs in copy'], String(baseline.drafts.length));
  assert.equal(review.values['Lists in copy'], String(baseline.playlists.length));
  assert.equal(review.values['Climbs to add'], '0');
  assert.equal(review.values['Lists to add'], '0');
  assert(review.conflictRows.length > 0, 'The older copy must show same-identity content conflicts');
  assert(review.text.includes('These identities exist on this phone with different contents'));
  assert(review.conflictRows.some(row => row.name === changedClimb.name
    && row.detail?.startsWith('Climb · saved version differs')),
  'The prior grade for the same climb identity must be shown as a conflict');
  assert(review.conflictRows.some(row => row.name === reorderedList.name
    && row.detail?.startsWith('List · saved version differs')),
  'The prior ordered membership for the same list identity must be shown as a conflict');
  assert(review.text.includes('Both versions remain unchanged'));
  assert.deepEqual(review.restoreActions, [], 'Manage must not offer Restore while conflicts are present');
  const reviewed = await assertBaseline(device, baselineCanonical, initial.revision,
    'Reviewing the older copy changed the complete local library');
  const afterReviewRecord = await readPreservationRecord();
  assert.deepEqual(normalizedHistory(historyOf(afterReviewRecord)), historyBefore,
    'Review changed retained cloud receipt metadata');

  await device.click('Close private backup');
  await waitForUi("!document.querySelector('.automatic-backup-manage[open]')", 'Manage did not close normally');
  await assertBaseline(device, baselineCanonical, reviewed.revision,
    'Closing a conflict review changed the local library');
  const afterCloseRecord = await readPreservationRecord();
  assert.deepEqual(normalizedHistory(historyOf(afterCloseRecord)), historyBefore,
    'Closing conflict review changed retained cloud receipt metadata');

  await device.restart();
  const reopened = await assertBaseline(device, baselineCanonical, initial.revision,
    'Process restart changed the complete local library');
  await openManage();
  await refreshHistory();
  const relaunchedRecord = await readPreservationRecord();
  const historyAfter = normalizedHistory(historyOf(relaunchedRecord));
  assert.deepEqual(historyAfter, historyBefore,
    'Freshly listed retained cloud history metadata changed during conflict review');
  assert.equal(await device.evaluate(
    "document.querySelectorAll('.automatic-backup-manage__versions li').length"), historyAfter.length,
  'Relaunched Manage did not display complete remote history');
  await device.click('Close private backup');
  await waitForUi("!document.querySelector('.automatic-backup-manage[open]')", 'Manage did not close after history verification');
  const final = await assertBaseline(device, baselineCanonical, initial.revision,
    'Cloud history refresh changed the local library');

  const historyHash = createHash('sha256').update(JSON.stringify(historyBefore)).digest('hex');
  const localHash = createHash('sha256').update(baselineCanonical).digest('hex');
  await saveEvidence({
    at: new Date().toISOString(),
    status: 'passed',
    scenario: 'synthetic older-copy conflict review through Manage UI',
    baseline: { climbs: baseline.drafts.length, lists: baseline.playlists.length,
      revision: initial.revision, canonicalSha256: localHash },
    review: { copyClimbs: Number(review.values['Climbs in copy']),
      copyLists: Number(review.values['Lists in copy']), conflicts: review.conflictRows.length,
      restoreActionAbsent: review.restoreActions.length === 0,
      localBaselineUnchanged: true },
    retainedHistory: { copies: historyAfter.length, metadataStableAfterRestart: true,
      metadataSha256: historyHash },
    afterRestart: { revision: reopened.revision, exactCanonicalContent: true },
    afterHistoryRefresh: { revision: final.revision, exactCanonicalContent: true },
  });
  console.log(JSON.stringify({ status: 'passed', conflicts: review.conflictRows.length,
    retainedCopies: historyAfter.length, localRevision: final.revision }));
} finally {
  await device.detach().catch(() => undefined);
}

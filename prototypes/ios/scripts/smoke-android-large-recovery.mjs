// Focused acceptance for a staged maximum-size continuation. The selected copy
// is discovered, reviewed and restored through Manage; SQLite access below is
// read-only evidence. Never clear app data, import a file, or inject a restore.
//
// Close any editor/dialog normally before starting this driver. Generate and
// upload the continuation through the operator's actual native-vault path first.
// The acceptance uses a synthetic 8-climb/3-list baseline and a new ignored
// output directory; neither backup bytes nor account/device identifiers are
// written to evidence.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmod, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  canonicalSnapshot,
  decodeLibraryBackup,
  LIBRARY_BACKUP_LIMITS,
} from '../../../web/src/library-backup/codec.ts';
import { VAULT_SLOT_PATTERN } from '../../../web/src/private-vault/contract.ts';
import { catalogDevice, pause } from './android-catalog-device.mjs';
import { preservedLibrarySnapshot } from './android-preservation-evidence.mjs';
import { createStructuredContinuation } from '../fixtures/structured-library.mjs';

const [serial, outputArgument, baselineArgument, targetSlot] = process.argv.slice(2);
assert(/^emulator-\d+$/.test(serial ?? '') && outputArgument && baselineArgument
  && VAULT_SLOT_PATTERN.test(targetSlot ?? '') && Number(targetSlot) <= 511,
'Usage: node --experimental-strip-types smoke-android-large-recovery.mjs EMULATOR NEW_PRIVATE_OUTPUT_DIR SYNTHETIC_BASELINE_BACKUP STAGED_CLOUD_SLOT');

const output = resolve(outputArgument);
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
if (output === root || output.startsWith(`${root}/`)) {
  execFileSync('git', ['check-ignore', '--quiet', output]);
}
await assert.rejects(lstat(output), { code: 'ENOENT' }, 'Output directory must be new');
await mkdir(output, { recursive: true, mode: 0o700 });
await chmod(output, 0o700);

const baselineText = await readFile(baselineArgument, 'utf8');
const baseline = decodeLibraryBackup(baselineText);
assert.equal(baseline.drafts.length, 8, 'Use the recovered synthetic 8-climb baseline');
assert.equal(baseline.playlists.length, 3, 'Use the recovered synthetic 3-list baseline');
const expectedText = createStructuredContinuation(baselineText);
const expected = decodeLibraryBackup(expectedText);
const expectedCanonical = canonicalSnapshot(expected);
const expectedCanonicalSha256 = createHash('sha256').update(expectedCanonical).digest('hex');
const expectedBytes = Buffer.byteLength(expectedText);
const expectedSha256 = createHash('sha256').update(expectedText).digest('hex');
const expectedReferences = expected.playlists.reduce((sum, playlist) => sum + playlist.entries.length, 0);
const expectedTrash = expected.drafts.filter(draft => draft.trashedAt !== undefined).length;
assert.equal(expected.drafts.length, LIBRARY_BACKUP_LIMITS.climbs);
assert.equal(expected.playlists.length, LIBRARY_BACKUP_LIMITS.playlists);
assert.equal(expectedReferences, LIBRARY_BACKUP_LIMITS.references);
assert(expectedBytes <= LIBRARY_BACKUP_LIMITS.bytes);
assert(expected.playlists.some(playlist => Buffer.byteLength(JSON.stringify(playlist)) > 32_768),
  'Continuation must exercise a playlist larger than one native bridge chunk');

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

async function protectedState(label) {
  const record = await waitForRecord(value => value.control.protected?.revision === value.revision
    && value.control.pending === null && value.recoveryRevision === null, label);
  await waitForUi("document.querySelector('.automatic-backup-status strong')?.innerText === 'All saved changes backed up'",
    'The UI did not report the verified current revision');
  return record;
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

function controlHistory(record) {
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
  // The slot is intentionally absent from user-facing copy. Pair the exact
  // native-list receipt with its unique visible date/size row, then click that
  // row's ordinary Review button. The large digest/size must identify one copy.
  const candidates = controlHistory(await readPreservationRecord())
    .filter(item => item.bytes === expectedBytes && item.sha256 === expectedSha256);
  assert.equal(candidates.length, 1, 'Expected one retained copy matching the staged continuation');
  assert.equal(candidates[0].slot, snapshot.slot);
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
  assert.equal(clicked.count, 1, 'The staged copy must have one matching visible history row');
  await waitForUi("!!document.querySelector('.automatic-backup-manage__review h3')",
    'Manage did not show the selected copy review');
  return clicked.label;
}

async function readReviewSummary() {
  return device.evaluate(`(() => {
    const section = document.querySelector('.automatic-backup-manage__review');
    if (!section) return null;
    const values = Object.fromEntries([...section.querySelectorAll('dl div')].map(row => [
      row.querySelector('dt')?.innerText.trim(), row.querySelector('dd')?.innerText.trim(),
    ]));
    return { values, conflicts: section.querySelectorAll('.automatic-backup-manage__conflicts li').length,
      text: section.innerText };
  })()`);
}

function assertReview(summary) {
  assert(summary, 'Expected the selected copy review to be visible');
  assert.equal(summary.values['Climbs in copy'], String(expected.drafts.length));
  assert.equal(summary.values['Climbs in Trash'], String(expectedTrash));
  assert.equal(summary.values['Lists in copy'], String(expected.playlists.length));
  assert.equal(summary.values['Climbs to add'], String(expected.drafts.length - baseline.drafts.length));
  assert.equal(summary.values['Lists to add'], String(expected.playlists.length - baseline.playlists.length));
  assert.equal(summary.values['Already here, unchanged'],
    `${baseline.drafts.length} climbs · ${baseline.playlists.length} lists`);
  assert.equal(summary.conflicts, 0,
    'Preserving continuation should add records without conflicting with baseline identities');
}

async function assertBaselineStillPresent(label) {
  const current = await preservedLibrarySnapshot(device);
  assert.equal(canonicalSnapshot(current.snapshot), canonicalSnapshot(baseline), label);
  return current.revision;
}

async function writeEvidence(value) {
  await writeFile(resolve(output, 'result.json'), `${JSON.stringify(value, null, 2)}\n`,
    { mode: 0o600, flag: 'wx' });
}

try {
  await device.start();
  assert.equal(await device.evaluate('window.Capacitor.getPlatform()'), 'android');
  const vault = await device.evaluate("window.Capacitor.nativePromise('PrivateVault','status',{})");
  assert(vault.configured && vault.account && vault.scope === 'acceptance-v1/r002',
    'Use the signed synthetic automatic-acceptance pool');

  const before = await preservedLibrarySnapshot(device);
  assert.equal(canonicalSnapshot(before.snapshot), canonicalSnapshot(baseline),
    'The target emulator must contain the supplied recovered 8/3 baseline');
  const beforeRecord = await readPreservationRecord();
  await openManage();
  await refreshHistory();
  await waitForRecord(record => controlHistory(record).some(item => item.slot === targetSlot),
    'Manage history did not discover the operator-staged cloud slot');

  const listed = await readPreservationRecord();
  const target = controlHistory(listed).find(item => item.slot === targetSlot);
  assert(target, 'The specified cloud slot is absent from the discovered history');
  assert.equal(target.bytes, expectedBytes, 'Staged receipt size differs from the continuation fixture');
  assert.equal(target.sha256, expectedSha256, 'Staged receipt digest differs from the continuation fixture');
  assert.deepEqual(target.counts, {
    climbs: expected.drafts.length,
    finished: expected.drafts.filter(draft => draft.trashedAt === undefined && draft.status === 'finished').length,
    drafts: expected.drafts.filter(draft => draft.trashedAt === undefined && draft.status === 'draft').length,
    trash: expectedTrash,
    playlists: expected.playlists.length,
  });
  const visibleCount = await device.evaluate(
    "document.querySelectorAll('.automatic-backup-manage__versions li').length");
  assert.equal(visibleCount, controlHistory(listed).length,
    'Manage did not display the complete discovered receipt history');

  await reviewTarget(target);
  assertReview(await readReviewSummary());
  const reviewRevision = await assertBaselineStillPresent('Review changed the local baseline');
  assert.equal(reviewRevision, before.revision, 'Review changed the aggregate library revision');
  await device.click('Close private backup');
  await waitForUi("!document.querySelector('.automatic-backup-manage[open]')", 'Review cancellation did not close Manage');
  const cancelledRevision = await assertBaselineStillPresent('Cancelling review changed the local baseline');
  assert.equal(cancelledRevision, before.revision, 'Cancelling review changed the aggregate library revision');

  // A conflict is deliberately not manufactured: this continuation preserves
  // the baseline records exactly. Creating a conflict would require an altered
  // staged copy or an authored local mutation outside this preservation check.
  await openManage();
  await refreshHistory();
  await reviewTarget(target);
  const summary = await readReviewSummary();
  assertReview(summary);
  const addClimbs = expected.drafts.length - baseline.drafts.length;
  const addLists = expected.playlists.length - baseline.playlists.length;
  await device.click(`Restore ${addClimbs} climbs and ${addLists} lists`);

  // The actual bridge restore+verification proof takes ~67 seconds; allow a
  // generous WebView bound without treating a slow but progressing restore as
  // failure. No UI or database restore hook is installed by this script.
  const restoreStartedAt = Date.now();
  await waitForUi("document.querySelector('.automatic-backup-manage__result h3')?.innerText === 'Recovery saved'",
    'Large in-app recovery did not complete', 15 * 60 * 1000);
  const restoreElapsedMs = Date.now() - restoreStartedAt;
  const resultText = await device.evaluate(
    "document.querySelector('.automatic-backup-manage__result')?.innerText ?? ''");
  assert(resultText.includes(`${addClimbs} climbs and ${addLists} lists added.`),
    'Restore result did not report the reviewed additions');
  assert(resultText.includes(`${baseline.drafts.length} climbs and ${baseline.playlists.length} lists were already here, unchanged.`),
    'Restore result did not report preserved baseline records');
  await device.click('Close private backup');
  await waitForUi("!document.querySelector('.automatic-backup-manage[open]')", 'Manage did not close after recovery');

  const afterCommit = await protectedState('Restored revision did not reach a verified receipt');
  const committedSnapshot = await preservedLibrarySnapshot(device);
  const committedCanonical = canonicalSnapshot(committedSnapshot.snapshot);
  assert.equal(committedCanonical, expectedCanonical, 'Committed library differs from the complete continuation');
  const afterRecord = await readPreservationRecord();
  assert(afterRecord.revision > beforeRecord.revision, 'Atomic restore did not increment the library revision');
  assert.equal(afterRecord.recoveryRevision, null, 'Recovery verification barrier remained set after success');
  assert.equal(afterRecord.control.admission, 'active');
  assert.equal(afterRecord.control.pending, null, 'Restore left an unrelated pending upload');
  assert.equal(afterRecord.control.protected?.revision, afterRecord.revision);
  assert.deepEqual(afterRecord.control.protected?.snapshot, target,
    'Protected receipt does not identify the reviewed source copy');
  assert.equal(controlHistory(afterRecord).filter(item => item.slot === targetSlot).length, 1);
  assert.equal(controlHistory(afterRecord).length, visibleCount,
    'Recovery created a duplicate retained-history entry');

  await device.restart();
  const afterRestart = await protectedState('Restart lost the verified large recovery receipt');
  const reopenedSnapshot = await preservedLibrarySnapshot(device);
  const reopenedCanonical = canonicalSnapshot(reopenedSnapshot.snapshot);
  assert.equal(reopenedCanonical, expectedCanonical, 'Relaunch changed canonical large-library content');
  assert.equal(reopenedSnapshot.revision, afterRestart.revision);
  assert.deepEqual(afterRestart.control.protected?.snapshot, target);
  assert.equal(afterRestart.control.pending, null);
  assert.equal(afterRestart.recoveryRevision, null);
  assert.deepEqual(controlHistory(afterRestart), controlHistory(afterRecord),
    'Relaunch changed the complete retained receipt history');

  await openManage();
  await refreshHistory();
  const refreshedAfterRestart = await readPreservationRecord();
  assert.deepEqual(controlHistory(refreshedAfterRestart), controlHistory(afterRestart),
    'The Manage UI did not rediscover the same complete remote history');
  const refreshedVisibleCount = await device.evaluate(
    "document.querySelectorAll('.automatic-backup-manage__versions li').length");
  assert.equal(refreshedVisibleCount, controlHistory(refreshedAfterRestart).length);
  await device.click('Close private backup');
  await waitForUi("!document.querySelector('.automatic-backup-manage[open]')", 'Manage did not close after history verification');

  // A normal maximum-wait window after process restart proves the recovered
  // source baseline is acknowledged rather than automatically uploaded again.
  await pause(65_000);
  const settled = await readPreservationRecord();
  assert.equal(settled.revision, afterRestart.revision, 'A duplicate authoring revision appeared after restart');
  assert.deepEqual(settled.control.history, refreshedAfterRestart.control.history,
    'Automatic retry created or removed a receipt after recovery');
  assert.deepEqual(settled.control.protected, afterRestart.control.protected,
    'The acknowledged recovery source changed after restart');
  assert.equal(settled.control.pending, null);
  assert.equal(settled.recoveryRevision, null);
  assert.equal(controlHistory(settled).filter(item => item.slot === targetSlot).length, 1);
  assert.equal(await device.evaluate(
    "document.querySelector('.automatic-backup-status strong')?.innerText === 'All saved changes backed up'"), true);

  await writeEvidence({
    at: new Date().toISOString(),
    status: 'passed',
    scenario: 'synthetic preserving large cloud recovery through Manage UI',
    baseline: { climbs: baseline.drafts.length, lists: baseline.playlists.length, revision: before.revision },
    reviewedCopy: { climbs: expected.drafts.length, lists: expected.playlists.length,
      references: expectedReferences, bytes: expectedBytes, sha256: expectedSha256 },
    preview: { climbsAdded: addClimbs, listsAdded: addLists, unchangedClimbs: baseline.drafts.length,
      unchangedLists: baseline.playlists.length, trashClimbs: expectedTrash },
    afterRestore: { climbs: committedSnapshot.snapshot.drafts.length, lists: committedSnapshot.snapshot.playlists.length,
      references: expectedReferences, revision: afterRecord.revision, canonicalSha256: expectedCanonicalSha256,
      restoreElapsedMs, protectedReceiptPresent: true, recoveryBarrierClear: true },
    afterRestart: { revision: afterRestart.revision, exactCanonicalContent: true,
      receiptHistoryStableAfterRetryWindow: true, retainedCopyCount: settled.control.history.length,
      completeManageHistoryAfterRestart: true },
    reviewCancellationPreservedBaseline: true,
    conflictingCopyReview: 'not manufactured; continuation preserves all baseline records',
  });
  console.log(JSON.stringify({ status: 'passed', climbs: expected.drafts.length,
    lists: expected.playlists.length, references: expectedReferences, restoreElapsedMs }));
} finally {
  await device.detach().catch(() => undefined);
}

import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { canonicalSnapshot, decodeLibraryBackup, encodeLibraryBackup } from '../../../web/src/library-backup/codec.ts';
import { createPortablePlaylist } from '../../../web/src/playlists/portable-export.ts';
import { decodePortablePlaylist, encodePortablePlaylist } from '../../../web/src/playlists/portable-codec.ts';
import { catalogDevice, catalogLibrarySnapshot, pause } from './android-catalog-device.mjs';
import { chooseDownloadedFile, chooseDownloadedImages, tapWebFileInput, waitForDocumentPicker } from './android-document-picker.mjs';
import { chooseDownloadsAndSave, downloadNames } from './android-save-picker.mjs';
import { syntheticScreenshots } from './synthetic-screenshots.mjs';

const [serial, baselineArgument, evidenceArgument, resumeArgument] = process.argv.slice(2);
assert.ok(serial && baselineArgument && evidenceArgument, 'Usage: emulator-N expected-synthetic-backup.json /outside/git/new-evidence');
const baseline = decodeLibraryBackup(readFileSync(resolve(baselineArgument), 'utf8')), evidence = resolve(evidenceArgument);
mkdirSync(evidence);
const screenshotsOnly = resumeArgument === '--screenshots-only';
assert.ok(!resumeArgument || screenshotsOnly, 'Unknown resume argument');
const device = catalogDevice(serial);
function originalUnchanged(after, before) {
  const originals = { drafts: after.drafts.filter(row => before.drafts.some(original => original.id === row.id)), playlists: after.playlists.filter(row => before.playlists.some(original => original.id === row.id)) };
  assert.equal(canonicalSnapshot(originals), canonicalSnapshot(before), 'An original authored record changed or disappeared');
}
function creationFields(row, originals, started, ended) {
  assert.ok(!originals.some(original => original.id === row.id), 'Imported identity must be fresh');
  assert.equal(row.revision, 1);
  assert.equal(row.updatedAt, row.createdAt);
  assert.ok(Date.parse(row.createdAt) >= started && Date.parse(row.createdAt) <= ended, 'Creation timestamp must fall within the native operation');
  return { id: row.id, revision: 1, createdAt: row.createdAt, updatedAt: row.createdAt };
}
function checkpoint(name, snapshot) {
  writeFileSync(join(evidence, name), encodeLibraryBackup(snapshot, new Date()));
}

try {
  await device.start();
  assert.equal(canonicalSnapshot(await catalogLibrarySnapshot(device)), canonicalSnapshot(baseline), 'Refuse unrelated or already-modified source; never reset');
  let imported = baseline, addedClimbs = [];
  if (!screenshotsOnly) {
  const playlist = baseline.playlists.find(row => row.entries.some(entry => entry.kind === 'provider'));
  assert.ok(playlist, 'Expected synthetic ordered playlist with a provider reference');
  await device.click('Lists', true); await device.click(playlist.name, true); await device.click('Share list');
  assert.equal(await device.evaluate(`document.querySelector('dialog[open]').innerText.includes('Copy link')`), false, 'Native must omit fictitious localhost links');
  assert.equal(await device.evaluate(`document.querySelector('dialog[open]').innerText.includes('Share links are unavailable')`), true);
  const downloadsBefore = downloadNames(device.adb);
  await device.click('Save playlist file'); await chooseDownloadsAndSave({ adb: device.adb, pause });
  await device.waitFor("document.body.innerText.includes('Playlist file saved.')", 'Native playlist save failed');
  const createdFiles = [...downloadNames(device.adb)].filter(name => !downloadsBefore.has(name));
  assert.equal(createdFiles.length, 1);
  const filename = createdFiles[0], text = device.adbBytes('exec-out', 'cat', `/sdcard/Download/${filename}`).toString('utf8');
  const portable = decodePortablePlaylist(JSON.parse(text));
  assert.equal(encodePortablePlaylist(portable), encodePortablePlaylist(createPortablePlaylist(playlist, baseline.drafts, () => new Date(portable.exportedAt))), 'SAF bytes lost content, effects, ordered snapshots or provider references');
  writeFileSync(join(evidence, 'playlist.cruxplaylist.json'), text);
  await device.click('Save playlist file'); await waitForDocumentPicker(device); device.adb('shell', 'input', 'keyevent', '4');
  await device.waitFor("document.body.innerText.includes('Playlist file save canceled.')", 'Picker cancel falsely reported delivery');
  assert.equal(canonicalSnapshot(await catalogLibrarySnapshot(device)), canonicalSnapshot(baseline));
  await device.click('Close sharing'); await device.click('Import list');
  const started = await device.evaluate('Date.now()');
  await tapWebFileInput(device, '.playlist-portable-file input');
  writeFileSync(join(evidence, 'playlist-system-picker.xml'), await chooseDownloadedFile(device, filename));
  await device.waitFor("document.body.innerText.includes('Import as new list')", 'System picker did not return playlist');
  await device.click('Import as new list'); await device.waitFor("!document.querySelector('.playlist-portable-dialog[open]')", 'Playlist import did not finish');
  imported = await catalogLibrarySnapshot(device); const ended = await device.evaluate('Date.now()');
  originalUnchanged(imported, baseline);
  const addedList = imported.playlists.filter(row => !baseline.playlists.some(original => original.id === row.id));
  addedClimbs = imported.drafts.filter(row => !baseline.drafts.some(original => original.id === row.id));
  assert.equal(addedList.length, 1);
  assert.equal(addedClimbs.length, portable.playlist.entries.filter(entry => entry.kind === 'local-snapshot').length);
  const newList = addedList[0], freshEntries = portable.playlist.entries.map((entry, index) => {
    const actual = newList.entries[index];
    if (entry.kind === 'provider') { assert.deepEqual(actual, entry); return entry; }
    assert.equal(actual.kind, 'local');
    const row = addedClimbs.find(climb => climb.id === actual.id); assert.ok(row);
    assert.deepEqual(row, { schemaVersion: baseline.drafts[0].schemaVersion, ...creationFields(row, baseline.drafts, started, ended), installationId: baseline.drafts[0].installationId, ...entry.snapshot });
    return { kind: 'local', id: row.id };
  });
  assert.deepEqual(newList, { schemaVersion: 1, ...creationFields(newList, baseline.playlists, started, ended), name: portable.playlist.name, notes: portable.playlist.notes, entries: freshEntries });
  checkpoint('playlist-imported.json', imported);
  }

  const screenshots = syntheticScreenshots();
  for (const screenshot of screenshots) {
    const path = join(evidence, screenshot.filename); writeFileSync(path, screenshot.bytes);
    device.adb('push', path, `/sdcard/Download/${screenshot.filename}`);
  }
  const alreadyReviewing = await device.evaluate("!!document.querySelector('.screenshot-import-dialog[open]')");
  if (!alreadyReviewing) { await device.click('My Climbs', true); await device.click('Import Kilter screenshots'); }
  const screenshotStart = await device.evaluate('Date.now()');
  if (!await device.evaluate("!!document.querySelector('.screenshot-import-review')")) await tapWebFileInput(device, '.screenshot-import-file input');
  if (!await device.evaluate("!!document.querySelector('.screenshot-import-review')")) writeFileSync(join(evidence, 'two-png-system-picker.xml'), await chooseDownloadedImages(device, screenshots.map(row => row.filename)));
  await device.waitFor("document.body.innerText.includes('Screenshot 1 of 2')", 'Native picker/decode did not produce two-image review');
  for (let index = 0; index < screenshots.length; index += 1) {
    const sourceName = await device.evaluate("document.querySelector('.screenshot-import-progress').innerText");
    const screenshot = screenshots.find(row => sourceName.includes(row.filename)); assert.ok(screenshot);
    await device.setValue('#screenshot-review-name', screenshot.name);
    if (await device.evaluate("!!document.querySelector('.screenshot-import-warnings input')")) await device.evaluate("document.querySelector('.screenshot-import-warnings input').click()");
    await device.click(index === 0 ? 'Next' : 'Import 2 drafts');
  }
  await device.waitFor("!document.querySelector('.screenshot-import-dialog[open]')", 'Screenshot drafts did not finish saving');
  const saved = await catalogLibrarySnapshot(device), screenshotEnd = await device.evaluate('Date.now()');
  originalUnchanged(saved, imported);
  const pngDrafts = saved.drafts.filter(row => !imported.drafts.some(original => original.id === row.id));
  assert.equal(pngDrafts.length, 2);
  for (const screenshot of screenshots) {
    const row = pngDrafts.find(draft => draft.name === screenshot.name); assert.ok(row);
    assert.deepEqual(row, { schemaVersion: baseline.drafts[0].schemaVersion, ...creationFields(row, imported.drafts, screenshotStart, screenshotEnd), installationId: baseline.drafts[0].installationId, definitionId: baseline.drafts[0].definitionId, layoutRevision: baseline.drafts[0].layoutRevision, status: 'draft', name: screenshot.name, angle: 40, assignments: screenshot.assignments, effectGroups: [], metadata: {} });
  }
  checkpoint('verified-picker-library.json', saved);
  await device.restart();
  assert.equal(canonicalSnapshot(await catalogLibrarySnapshot(device)), canonicalSnapshot(saved), 'Relaunch changed the complete intentionally augmented library');
  writeFileSync(join(evidence, 'result.json'), JSON.stringify({ actualPlaylistSystemChooser: !screenshotsOnly, actualTwoPngSystemChooser: true, exactPortableContentOrderProviders: !screenshotsOnly, freshIdentities: true, allOriginalRecordsUnchanged: true, completeRelaunchEquality: true, fixture: 'fictional discs generated solely from public board geometry', intentionalAdditions: { localPlaylistCopies: addedClimbs.length, playlists: screenshotsOnly ? 0 : 1, screenshotDrafts: 2 } }, null, 2));
  console.log(`${screenshotsOnly ? 'Actual two-PNG chooser' : 'Actual playlist and two-PNG choosers'} preserved all originals and exact intended additions across relaunch`);
} finally { await device.detach(); }

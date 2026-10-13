// Private emulator proof. Neither the real snapshot nor evidence is uploaded.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { canonicalSnapshot, decodeLibraryBackup, encodeLibraryBackup } from '../../../web/src/library-backup/codec.ts';
import { checkAndroidCatalogApk } from './check-android-catalog.mjs';
import { readCatalogManifest } from './prepare-android-catalog.mjs';
import { appId, catalogDevice, catalogLibrarySnapshot, pause, verifyColdCatalogLists } from './android-catalog-device.mjs';

const [serial, apkFile, expectedBackupFile, evidenceDirectory, resumeMode] = process.argv.slice(2);
if (!apkFile || !expectedBackupFile || !evidenceDirectory) throw new Error('Usage: node --experimental-strip-types smoke-android-catalog.mjs emulator-N PRIVATE_APK EXPECTED_SYNTHETIC_BACKUP EVIDENCE_DIRECTORY');
if (resumeMode !== undefined && resumeMode !== '--resume-installed') throw new Error('Only --resume-installed is supported after the evidence directory');
const evidence = resolve(evidenceDirectory);
await mkdir(evidence, { recursive: true });
const expected = decodeLibraryBackup(await readFile(expectedBackupFile, 'utf8'));
const fixture = decodeLibraryBackup(await readFile(new URL('../fixtures/synthetic-library.json', import.meta.url), 'utf8'));
const edited = expected.drafts.find(row => row.name === 'Prototype finish A — Android preservation proof');
const allowed = { drafts: fixture.drafts.map(row => edited?.id === row.id ? { ...row, name: edited.name, revision: edited.revision, updatedAt: edited.updatedAt } : row), playlists: fixture.playlists };
assert.equal(canonicalSnapshot(expected), canonicalSnapshot(allowed), 'Only the complete known synthetic native fixture is accepted');
const manifestFile = new URL('../../../web/public/catalog/manifest.json', import.meta.url);
const manifest = await readCatalogManifest(manifestFile);
const packaged = await checkAndroidCatalogApk(apkFile, manifestFile);
const device = catalogDevice(serial);
const { adb, evaluate, waitFor, click, setValue } = device;
const originalAirplane = adb('shell', 'settings', 'get', 'global', 'airplane_mode_on');
async function snapshot(label) {
  const value = await catalogLibrarySnapshot(device);
  const text = encodeLibraryBackup(value, new Date());
  await writeFile(join(evidence, label + '.json'), text);
  return decodeLibraryBackup(text);
}
async function screenshot(label) { await writeFile(join(evidence, label + '.png'), device.adbBytes('exec-out', 'screencap', '-p')); }

// Serialized into an emulator-only module wrapper; never loaded by the app.
async function interruptibleCatalogWorker(source) {
  let armed = false;
  let initialized = false;
  const queued = [];
  self.addEventListener('message', event => {
    if (event.data?.type === 'catalog-proof-arm') {
      armed = true;
      event.stopImmediatePropagation();
    } else if (!initialized) {
      queued.push(event);
      event.stopImmediatePropagation();
    }
  });
  const capabilities = {
    source, origin: location.origin,
    syncHandle: typeof FileSystemFileHandle.prototype.createSyncAccessHandle,
    locks: typeof navigator.locks.request, wasm: typeof WebAssembly.instantiate,
  };
  self.postMessage({ type: 'catalog-proof-capabilities', capabilities });
  const write = FileSystemSyncAccessHandle.prototype.write;
  FileSystemSyncAccessHandle.prototype.write = function(...args) {
    const written = write.apply(this, args);
    if (armed && written >= 65536) {
      armed = false;
      this.flush();
      self.postMessage({ type: 'catalog-proof-first-write', written, requested: args[0].byteLength, ...capabilities });
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) { /* Host force-stops the app at this boundary. */ }
      throw new Error('Catalog interruption proof was not terminated in time');
    }
    return written;
  };
  await import(source);
  initialized = true;
  for (const event of queued) self.dispatchEvent(new MessageEvent('message', { data: event.data, ports: event.ports }));
}

async function observeWorkers() {
  // Only the interrupted attempt is instrumented. A module wrapper imports the
  // exact bundled worker, flushes its first real OPFS write and blocks before it
  // can publish a receipt. Relaunch restores the ordinary unmodified Worker.
  await evaluate(`(() => {
    window.__catalogProofWorkers = []; window.__catalogProofCapabilities = [];
    const ActualWorker = window.Worker;
    window.Worker = class extends ActualWorker {
      constructor(url, options) {
        const source = new URL(url, location.href).href;
        const filename = new URL(source).pathname.split('/').at(-1);
        if (!filename.startsWith('catalog.worker-') || !filename.endsWith('.js')) { super(url, options); return; }
        const prelude = '(' + ${JSON.stringify(interruptibleCatalogWorker.toString())} + ')(' + JSON.stringify(source) + ');';
        super(URL.createObjectURL(new Blob([prelude], {type:'text/javascript'})), options);
        window.__catalogProofWorkers.push(this);
        this.addEventListener('message', event=>{
          if(event.data?.type==='catalog-proof-capabilities') window.__catalogProofCapabilities.push(event.data.capabilities);
          if(event.data?.type==='catalog-proof-first-write') window.__catalogProofFirstWrite=event.data;
        });
      }
    };
  })()`);
}
async function openCatalog() {
  await click('Kilter');
  await waitFor("document.body.innerText.includes('Install the catalog to browse') || document.body.innerText.includes('Available offline')", 'Catalog worker could not open');
}
async function manifestOffer() {
  await click('Manage');
  await waitFor("[...document.querySelectorAll('button')].some(button => button.innerText.trim() === 'Download 5.1 MB' && !button.disabled)", 'Bundled manifest could not be read');
  assert.match(await evaluate('document.body.innerText'), /Source freshness: unknown/);
}

try {
  await device.start();
  const before = await snapshot('before');
  console.log('Complete synthetic native library matched');
  assert.equal(canonicalSnapshot(before), canonicalSnapshot(expected), 'Unexpected authored data: abort before installing or catalog writes');
  await device.detach();
  adb('install', '-r', resolve(apkFile));
  adb('shell', 'am', 'force-stop', appId);
  await device.start();
  assert.equal(canonicalSnapshot(await snapshot('upgraded')), canonicalSnapshot(before));
  const compressed = await evaluate(`(async()=>{ const response=await fetch('/catalog/${manifest.file}'); const bytes=await response.arrayBuffer(); const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join(''); return {status:response.status,url:response.url,encoding:response.headers.get('Content-Encoding'),bytes:bytes.byteLength,sha256:hash}; })()`);
  assert.equal(compressed.status, 200); assert.equal(compressed.url, `https://localhost/catalog/${manifest.file}`);
  assert.equal(compressed.encoding, 'identity'); assert.equal(compressed.bytes, manifest.bytesGzipped); assert.equal(compressed.sha256, manifest.sha256);
  console.log('Actual local canonical gzip verified');
  let firstWrite;
  let workerEvidence;
  if (resumeMode) {
    const priorWrite = JSON.parse(await readFile(join(evidence, 'interrupted-write.json'), 'utf8'));
    assert.ok(priorWrite.firstWrite.written >= 65536, 'Resume requires a previous interrupted database-chunk proof');
    for (const label of ['interrupted', 'installed']) assert.equal(canonicalSnapshot(decodeLibraryBackup(await readFile(join(evidence, label + '.json'), 'utf8'))), canonicalSnapshot(before), 'Resume requires unchanged complete authored snapshots from interrupted/reinstalled catalog');
    firstWrite = priorWrite.firstWrite; workerEvidence = priorWrite.workerEvidence;
    await click('Kilter');
    await waitFor("document.body.innerText.includes('Available offline')", 'Verified installed catalog did not reopen');
    await click('Manage');
  } else {
  await observeWorkers();
  await openCatalog();
  assert.ok(await evaluate('window.__catalogProofWorkers.length > 0'), 'Actual bundled catalog module Worker must be imported');
  assert.match(await evaluate('document.body.innerText'), /Not installed/);
  await manifestOffer();
  console.log('Instrumented bundled worker opened; consent offer ready');
  await evaluate("window.__catalogProofWorkers.forEach(worker=>worker.postMessage({type:'catalog-proof-arm'}))");
  await click('Download 5.1 MB');
  for (let attempt = 0; attempt < 120 && !firstWrite; attempt += 1) {
    firstWrite = await evaluate('window.__catalogProofFirstWrite');
    if (!firstWrite) await pause(100);
  }
  assert.ok(firstWrite?.written > 0, `No real OPFS write observed: ${await evaluate('document.body.innerText')}`);
  workerEvidence = await evaluate('window.__catalogProofCapabilities');
  console.log('Flushed real OPFS write observed', firstWrite.written);
  // Worker blocks after a flushed synchronous write, before receipt commit.
  await writeFile(join(evidence, 'interrupted-write.json'), JSON.stringify({ firstWrite, workerEvidence }, null, 2));
  await device.restart();
  assert.equal(canonicalSnapshot(await snapshot('interrupted')), canonicalSnapshot(before));
  await click('Kilter');
  await waitFor("document.body.innerText.includes('Install the catalog to browse')", 'Interrupted candidate must not appear installed');
  await screenshot('interrupted-recovered');
  await manifestOffer();
  await click('Download 5.1 MB');
  await waitFor("document.body.innerText.includes('Available offline on this device.')", 'Real Worker/WASM catalog installation failed', 240);
  console.log('Unmodified Worker/WASM installation completed');
  }
  assert.equal(canonicalSnapshot(await snapshot('installed')), canonicalSnapshot(before));
  await screenshot('installed');
  await click('Done');
  await waitFor("document.querySelectorAll('.climb-row').length > 0", 'Installed catalog has no compatible climbs');
  const first = await evaluate("({name:document.querySelector('.climb-row .climb-row__name')?.innerText, text:document.querySelector('.climb-row')?.innerText, grade:document.querySelector('.climb-row__meta')?.innerText.split(' · ')[1]})");
  // Use the first actual compatible row rather than pinning a third-party name.
  const routeName = first.name;
  assert.ok(routeName, `Climb row name unavailable: ${JSON.stringify(first)}`);
  await setValue('input[type=search]', 'cruxcontrol-no-such-synthetic-name');
  await waitFor("document.body.innerText.includes('No climbs match these filters')", 'Search did not filter');
  await setValue('input[type=search]', routeName);
  await waitFor("document.querySelectorAll('.climb-row').length > 0", 'Search failed to restore known climb');
  const gradeValue = await evaluate(`[...document.querySelectorAll('.catalog-filters select')][0].options[1].textContent === ${JSON.stringify(first.grade)} ? [...document.querySelectorAll('.catalog-filters select')][0].options[2].value : [...document.querySelectorAll('.catalog-filters select')][0].options[1].value`);
  await setValue('.catalog-filters select', gradeValue);
  await waitFor("document.body.innerText.includes('No climbs match these filters')", 'Grade filter did not exclude the known climb');
  await setValue('.catalog-filters select', 'all');
  await waitFor("document.querySelectorAll('.climb-row').length > 0", 'Known climb did not return after grade reset');
  await setValue('.catalog-filters label:nth-child(3) select', '45');
  await waitFor("document.body.innerText.includes('No climbs match these filters') || (document.querySelectorAll('.climb-row').length > 0 && [...document.querySelectorAll('.climb-row__meta')].every(row=>row.innerText.startsWith('45°')))", 'Angle filter did not settle to matching data');
  await setValue('.catalog-filters label:nth-child(3) select', '40');
  await waitFor("document.querySelectorAll('.climb-row').length > 0 && [...document.querySelectorAll('.climb-row__meta')].every(row=>row.innerText.startsWith('40°'))", 'Configured angle results did not return');
  await evaluate("document.querySelector('.climb-row').click()");
  await waitFor("document.querySelector('dialog[open]')?.innerText.toLowerCase().includes('legacy kilter · read only')", 'Real catalog details failed');
  assert.equal(await evaluate("!!document.querySelector('dialog[open] [aria-label=\"Board preview\"]')"), true);
  await screenshot('detail');
  await click('Add to lists');
  await waitFor("!!document.querySelector('#playlist-membership-heading')", 'Provider membership dialog unavailable');
  const playlistId = before.playlists.find(row => row.name === 'Prototype ordered')?.id;
  assert.ok(playlistId, 'Expected synthetic ordered playlist missing');
  await evaluate("[...document.querySelectorAll('dialog[open] label')].find(label=>label.innerText.includes('Prototype ordered')).querySelector('input[type=checkbox]').click()");
  await waitFor("document.querySelector('#playlist-membership-heading')?.closest('dialog').innerText.includes('Saved')", 'Provider membership was not saved');
  const added = await snapshot('membership');
  const changed = added.playlists.find(row => row.id === playlistId);
  const prior = before.playlists.find(row => row.id === playlistId);
  assert.equal(changed.entries.length, prior.entries.length + 1);
  assert.deepEqual(changed.entries.slice(0, -1), prior.entries);
  assert.equal(changed.entries.at(-1).kind, 'provider');
  assert.equal(changed.revision, prior.revision + 1);
  const allowedMembership = { drafts: before.drafts, playlists: before.playlists.map(row => row.id === playlistId ? { ...row, entries: changed.entries, revision: changed.revision, updatedAt: changed.updatedAt } : row) };
  assert.equal(canonicalSnapshot(added), canonicalSnapshot(allowedMembership), 'Only the intentional ordered provider append may change authored library');
  await click('Close lists');
  await click('Close climb details');
  adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'enable');
  await device.restart();
  assert.equal(adb('shell', 'settings', 'get', 'global', 'airplane_mode_on'), '1');
  const coldLists = await verifyColdCatalogLists(device, added);
  await screenshot('offline-play-through');
  assert.equal(canonicalSnapshot(await snapshot('offline')), canonicalSnapshot(added));
  await click('Exit play-through');
  await click('Kilter');
  await waitFor("document.body.innerText.includes('Available offline') && document.querySelectorAll('.climb-row').length > 0", 'Offline catalog did not reopen');
  assert.equal(canonicalSnapshot(await snapshot('verified-session')), canonicalSnapshot(added));
  const databaseNames = await evaluate('indexedDB.databases().then(rows=>rows.map(row=>row.name).sort())');
  assert.deepEqual(databaseNames, ['cruxcontrol-catalog-metadata'], 'Only catalog receipt metadata may use IndexedDB');
  assert.deepEqual(await evaluate('navigator.serviceWorker.getRegistrations().then(rows=>rows.map(row=>row.scope))'), []);
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ status: 'passed', packaged, compressed, firstWrite, workerEvidence, androidApi: adb('shell', 'getprop', 'ro.build.version.sdk'), webView: await evaluate('navigator.userAgent'), databaseNames, coldLists, appendedReference: changed.entries.at(-1), comparison: 'All canonical fields of every draft/finished/Trash record, metadata, assignments, effect recipes, playlists and ordered references; only the intentional provider append and target playlist revision/update timestamp differ.' }, null, 2));
  console.log('Android catalog proof passed; evidence', evidence);
} finally {
  await device.detach();
  adb('shell', 'cmd', 'connectivity', 'airplane-mode', originalAirplane === '1' ? 'enable' : 'disable');
}

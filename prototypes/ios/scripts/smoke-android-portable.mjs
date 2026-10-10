// Run with Node 22 --experimental-strip-types on a prepared synthetic source emulator
// and a booted emulator without the app installed. It never clears or uninstalls data.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  canonicalSnapshot,
  decodeLibraryBackup,
} from "../../../web/src/library-backup/codec.ts";
import { CATALOG_RECEIPT_DATABASE } from "../../../web/src/data/sqlite/catalog-config.ts";
import { DRAFT_DATABASE_NAME } from "../../../web/src/drafts/open-draft-database.ts";
import { PLAYLIST_DATABASE_NAME } from "../../../web/src/playlists/open-playlist-database.ts";
import {
  chooseDownloadsAndSave,
  downloadNames,
  readDownload,
} from "./android-save-picker.mjs";

const [sourceSerial, recoverySerial, apk, evidenceDirectory, sourceBaselineFile, previousSourceEvidenceDirectory] = process.argv.slice(2);
if (!/^emulator-\d+$/.test(sourceSerial ?? "") || !/^emulator-\d+$/.test(recoverySerial ?? "") || sourceSerial === recoverySerial || !apk || !evidenceDirectory || !sourceBaselineFile) {
  throw new Error("Usage: node --experimental-strip-types smoke-android-portable.mjs SOURCE_EMULATOR RECOVERY_EMULATOR APK EVIDENCE_DIRECTORY SOURCE_BASELINE_JSON [PREVIOUS_SOURCE_EVIDENCE_DIRECTORY]");
}

const evidence = resolve(evidenceDirectory);
if (existsSync(evidence)) {
  assert.equal(readdirSync(evidence).length, 0, "Use a fresh empty evidence directory so a new proof cannot overwrite previous results");
} else {
  mkdirSync(evidence, { recursive: true });
}
const androidSdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
if (!process.env.ADB && !androidSdk) throw new Error("Set ADB or ANDROID_HOME/ANDROID_SDK_ROOT for native proof");
const adbPath = process.env.ADB ?? join(androidSdk, "platform-tools", "adb");
const appId = "io.github.andromedus1.cruxcontrol.prototype";
const database = "cruxcontrol-library";
const fixture = decodeLibraryBackup(readFileSync(new URL("../fixtures/synthetic-library.json", import.meta.url), "utf8"));
const sourceBaselineText = readFileSync(resolve(sourceBaselineFile), "utf8");
const sourceBaseline = decodeLibraryBackup(sourceBaselineText);
const syntheticMarker = "Prototype finish A — Android preservation proof";
const editedName = "Prototype finish A — isolated restore edit";
const recoveryEditId = "00000000-0000-4000-8000-000000000902";
const recoverySourceName = syntheticMarker;
const libraryDatabaseNames = new Set([DRAFT_DATABASE_NAME, PLAYLIST_DATABASE_NAME]);
const expectedProviderReference = {
  kind: "provider",
  id: {
    provider: "kilter",
    sourceId: "001706160DE64AF2B5550E81418D2DB9",
    layoutRevision: "kilter:7:8:17:f0d70b3db9a6",
  },
};
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

function inspectPackagePolicy(apkFile) {
  if (!androidSdk && !process.env.AAPT2) throw new Error("Set AAPT2 or Android SDK path to inspect the final APK policy");
  const buildTools = androidSdk
    ? readdirSync(join(androidSdk, "build-tools")).filter((version) => /^\d+(?:\.\d+)+$/.test(version)).sort(compareVersions)
    : [];
  const aapt2 = process.env.AAPT2 ?? join(androidSdk, "build-tools", buildTools.at(-1) ?? "", process.platform === "win32" ? "aapt2.exe" : "aapt2");
  if (!existsSync(aapt2)) throw new Error(`Android aapt2 was not found: ${aapt2}`);
  const apkPath = resolve(apkFile);
  const xmltree = (file) => execFileSync(aapt2, ["dump", "xmltree", "--file", file, apkPath], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  const manifest = xmltree("AndroidManifest.xml");
  const backupRules = xmltree("res/xml/backup_rules.xml");
  const extractionRules = xmltree("res/xml/data_extraction_rules.xml");
  const badging = execFileSync(aapt2, ["dump", "badging", apkPath], { encoding: "utf8" });
  const resources = execFileSync(aapt2, ["dump", "resources", apkPath], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  const configText = execFileSync("unzip", ["-p", apkPath, "assets/capacitor.config.json"], { encoding: "utf8", maxBuffer: 1024 * 1024 });
  const config = JSON.parse(configText);
  const packageMetadata = badging.match(/^package: name='([^']+)' versionCode='(\d+)'/m);
  assert.ok(packageMetadata, "APK package metadata is missing");
  assert.equal(packageMetadata[1], appId, "APK package id does not match the installed prototype");
  assert.match(manifest, /A: package="io\.github\.andromedus1\.cruxcontrol\.prototype"/);
  assert.match(manifest, /:allowBackup\([^\n]+\)\s*=\s*false\b/);
  for (const [attribute, resourceName] of [["fullBackupContent", "backup_rules"], ["dataExtractionRules", "data_extraction_rules"]]) {
    const resource = resources.match(new RegExp(`resource (0x[\\da-fA-F]+) xml/${resourceName}\\b`))?.[1];
    assert.ok(resource, `Packaged XML resource ${resourceName} is missing`);
    const line = manifest.split("\n").find((candidate) => candidate.includes(`:${attribute}(`));
    assert.ok(line, `Merged manifest ${attribute} reference is missing`);
    assert.match(line, new RegExp(`=\\s*@?${resource}\\b`), `Merged manifest ${attribute} does not reference ${resourceName}`);
  }
  const legacyBackupExclusions = (backupRules.match(/E: exclude\b/g) ?? []).length;
  assert.ok(legacyBackupExclusions >= 9, "Legacy backup rules must exclude all app data domains");
  assert.match(extractionRules, /E: cloud-backup\b/);
  assert.match(extractionRules, /E: device-transfer\b/);
  const cloudAndDeviceTransferExclusions = (extractionRules.match(/E: exclude\b/g) ?? []).length;
  assert.ok(cloudAndDeviceTransferExclusions >= 18, "Cloud backup and device transfer rules must exclude all app data domains");
  assert.equal(config.loggingBehavior, "none", "The packaged Capacitor bridge must not log plugin payloads");
  writeFileSync(resolve(evidence, "package-manifest.txt"), manifest);
  writeFileSync(resolve(evidence, "backup-rules.txt"), backupRules);
  writeFileSync(resolve(evidence, "data-extraction-rules.txt"), extractionRules);
  writeFileSync(resolve(evidence, "capacitor-config.json"), configText);
  return {
    packageId: appId,
    versionCode: Number(packageMetadata[2]),
    allowBackup: false,
    legacyBackupExclusions,
    cloudAndDeviceTransferExclusions,
    loggingBehavior: config.loggingBehavior,
  };
}

function beginLogcatWindow(target, name) {
  const marker = `${name}_${Date.now()}`;
  const begin = `${marker}_BEGIN`;
  const end = `${marker}_END`;
  target.adb("shell", "log", "-p", "i", "-t", "CruxBackupProof", begin);
  return { begin, end };
}

function captureLogcatWindow(target, name, windowMarkers, payloads, forbiddenMarkers = [syntheticMarker]) {
  target.adb("shell", "log", "-p", "i", "-t", "CruxBackupProof", windowMarkers.end);
  const logcat = target.adbBytes("logcat", "-b", "main", "-d", "-v", "raw").toString("utf8");
  const start = logcat.indexOf(windowMarkers.begin);
  const finish = logcat.indexOf(windowMarkers.end, start + windowMarkers.begin.length);
  assert.ok(start >= 0 && finish > start, `${name} Logcat window markers were not both retained`);
  const window = logcat.slice(start, finish);
  for (const marker of forbiddenMarkers) assert.ok(!window.includes(marker), `${name} Logcat contains the synthetic marker ${JSON.stringify(marker)}`);
  for (const payload of payloads) assert.ok(!window.includes(payload), `${name} Logcat contains the full backup payload`);
  writeFileSync(resolve(evidence, `${name}-logcat.txt`), window);
  return { captured: true, checkedSyntheticMarkers: forbiddenMarkers, fullBackupPayloadLogged: false };
}

function device(serial) {
  const adb = (...args) => execFileSync(adbPath, ["-s", serial, ...args], { encoding: "utf8", timeout: 30000 }).trim();
  const adbBytes = (...args) => execFileSync(adbPath, ["-s", serial, ...args], { maxBuffer: 64 * 1024 * 1024, timeout: 30000 });
  let socket;
  let port;
  let sequence = 0;
  const pending = new Map();

  async function attach() {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        const pid = adb("shell", "pidof", appId);
        if (!/^\d+$/.test(pid)) throw new Error("App process unavailable");
        port = adb("forward", "tcp:0", `localabstract:webview_devtools_remote_${pid}`);
        const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) })).json();
        const target = targets.find((entry) => entry.url === "https://localhost/");
        if (!target) throw new Error("Bundled app page unavailable");
        socket = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
          socket.addEventListener("open", resolve, { once: true });
          socket.addEventListener("error", reject, { once: true });
        });
        socket.addEventListener("message", (event) => {
          const message = JSON.parse(event.data);
          if (!message.id || !pending.has(message.id)) return;
          const request = pending.get(message.id);
          pending.delete(message.id);
          clearTimeout(request.timer);
          if (message.error) request.reject(new Error(message.error.message));
          else request.resolve(message.result);
        });
        return;
      } catch {
        if (port) {
          adb("forward", "--remove", `tcp:${port}`);
          port = undefined;
        }
        await pause(250);
      }
    }
    throw new Error(`Could not attach to ${serial}'s bundled app WebView`);
  }

  function cdp(method, params = {}) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out: ${method}`));
      }, 15000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.result?.description ?? result.exceptionDetails.text);
    return result.result.value;
  }

  async function waitFor(expression, label) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (await evaluate(expression)) return;
      await pause(250);
    }
    throw new Error(`${label}\n${await evaluate("document.body?.innerText ?? '<document.body unavailable>'")}`);
  }

  async function click(label, includes = false) {
    const condition = includes ? `b.innerText.includes(${JSON.stringify(label)})` : `b.innerText.trim() === ${JSON.stringify(label)}`;
    const buttons = `[...document.querySelectorAll('button')].filter(b => !b.disabled && b.getClientRects().length && ${condition})`;
    await waitFor(`${buttons}.length === 1`, `Expected one enabled button: ${label}`);
    await evaluate(`${buttons}[0].click()`);
  }

  async function startup() {
    adb("shell", "am", "start", "-n", `${appId}/.MainActivity`);
    await attach();
    await waitFor(
      "document.body?.innerText?.includes('My Climbs') && [...document.querySelectorAll('button')].some(b => b.innerText.includes('Back up & restore'))",
      "App failed to start",
    );
    assert.equal(await evaluate("window.Capacitor.getPlatform()"), "android");
    const browserDatabaseNames = await evaluate("indexedDB.databases().then(dbs => dbs.map(db => db.name))");
    assert.deepEqual(
      browserDatabaseNames.filter((name) => libraryDatabaseNames.has(name)),
      [],
      "Native library must not use the browser draft or playlist databases",
    );
    assert.ok(
      browserDatabaseNames.length <= 1 && browserDatabaseNames.every((name) => name === CATALOG_RECEIPT_DATABASE),
      "Catalog may use only its separate receipt database in IndexedDB",
    );
    assert.deepEqual(await evaluate("navigator.serviceWorker.getRegistrations().then(rows => rows.map(row => row.scope))"), []);
    assert.equal(await evaluate("document.querySelector('link[rel=manifest]') === null"), true);
    return browserDatabaseNames;
  }

  function versionCode() {
    const match = adb("shell", "dumpsys", "package", appId).match(/\bversionCode=(\d+)\b/);
    assert.ok(match, `Could not read installed ${appId} versionCode on ${serial}`);
    return Number(match[1]);
  }

  async function close() {
    socket?.close();
    socket = undefined;
    if (port) {
      try {
        adb("forward", "--remove", `tcp:${port}`);
      } catch {
        // A device disconnect during teardown must not hide the operation result.
      }
      port = undefined;
    }
  }

  function waitForDevice() {
    execFileSync(adbPath, ["-s", serial, "wait-for-device"], { encoding: "utf8", timeout: 60000 });
  }

  async function counts() {
    const result = await evaluate(`window.Capacitor.nativePromise('CapacitorSQLite', 'query', { database: ${JSON.stringify(database)}, readonly: false, statement: 'SELECT (SELECT COUNT(*) FROM climbs) AS climbs, (SELECT COUNT(*) FROM playlists) AS playlists', values: [] })`);
    return { climbs: Number(result.values[0].climbs), playlists: Number(result.values[0].playlists) };
  }

  async function saveExport(name, { logWindow, payloads = [], forbiddenMarkers = [syntheticMarker] } = {}) {
    const before = downloadNames(adb);
    const logMarkers = logWindow ?? beginLogcatWindow({ adb, adbBytes }, name);
    await click("Back up & restore");
    await click("Save library backup file");
    await chooseDownloadsAndSave({ adb, pause });
    await waitFor("document.body.innerText.includes('Backup file saved to the chosen location.')", "Native backup file save did not complete");
    let filename;
    let text;
    for (let attempt = 0; attempt < 60 && !text; attempt += 1) {
      const created = [...downloadNames(adb)].filter((candidate) => !before.has(candidate));
      if (created.length > 1) throw new Error("Android created multiple new backup files for one save");
      if (created.length === 1) {
        filename = created[0];
        try {
          text = readDownload(adbBytes, filename);
        } catch {
          await pause(250);
        }
      } else {
        await pause(250);
      }
    }
    assert.ok(text, "The Android document provider did not retain a readable export");
    const snapshot = decodeLibraryBackup(text);
    const expectedPrefix = `cruxcontrol-library-${snapshot.exportedAt.replace(/:/g, "-")}`;
    assert.ok(filename === `${expectedPrefix}.json` || filename.startsWith(`${expectedPrefix}-`));
    writeFileSync(resolve(evidence, `${name}.json`), text);
    const logcat = captureLogcatWindow({ adb, adbBytes }, name, logMarkers, [...payloads, text], forbiddenMarkers);
    await click("Close");
    return { filename, text, snapshot, logcat };
  }

  async function editClimbName(existingName, nextName) {
    await click(existingName, true);
    await click("Edit climb");
    await waitFor(
      `[...document.querySelectorAll('input')].some(input => input.value === ${JSON.stringify(existingName)})`,
      "Restored climb editor unavailable",
    );
    await evaluate(`(() => {
      const input = [...document.querySelectorAll('input')].find(candidate => candidate.value === ${JSON.stringify(existingName)});
      if (!input) throw new Error('Restored name input missing');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(nextName)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.blur();
    })()`);
    await waitFor(
      `document.querySelector('.save-chip')?.textContent === 'saved' && document.querySelector('h1')?.textContent === ${JSON.stringify(nextName)}`,
      "Restored synthetic name edit did not save",
    );
    await click("Back");
  }

  return { adb, adbBytes, startup, close, counts, saveExport, attach, click, evaluate, waitFor, editClimbName, versionCode, waitForDevice };
}

const source = device(sourceSerial);
const recovery = device(recoverySerial);
const originals = new Map();

function setOffline(target) {
  const old = target.adb("shell", "settings", "get", "global", "airplane_mode_on");
  originals.set(target, old);
  target.adb("shell", "cmd", "connectivity", "airplane-mode", "enable");
}

function assertUpdated(record, original, label) {
  assert.equal(record.revision, original.revision + 1, `${label} must have exactly one intentional revision increment`);
  assert.ok(Date.parse(record.updatedAt) > Date.parse(original.updatedAt), `${label} update timestamp must advance`);
  assert.equal(new Date(record.updatedAt).toISOString(), record.updatedAt, `${label} update timestamp must be canonical`);
}

function assertSourceSnapshot(snapshot) {
  const editedFixture = fixture.drafts.find((draft) => draft.id === recoveryEditId);
  const editedSource = snapshot.drafts.find((draft) => draft.id === recoveryEditId);
  assert.ok(editedFixture && editedSource, "Expected the known finished fixture climb");
  assert.equal(editedSource.name, recoverySourceName);
  assert.equal(editedSource.createdAt, editedFixture.createdAt);
  assertUpdated(editedSource, editedFixture, "Source climb");

  const orderedFixture = fixture.playlists.find((playlist) => playlist.name === "Prototype ordered");
  const orderedSource = snapshot.playlists.find((playlist) => playlist.id === orderedFixture?.id);
  assert.ok(orderedFixture && orderedSource, "Expected the known ordered fixture playlist");
  assertUpdated(orderedSource, orderedFixture, "Catalog playlist");
  assert.deepEqual(orderedSource.entries, [...orderedFixture.entries, expectedProviderReference], "Catalog membership must be appended after the original ordered entries");

  const expected = {
    drafts: fixture.drafts.map((draft) => draft.id === editedFixture.id
      ? { ...draft, name: recoverySourceName, revision: editedSource.revision, updatedAt: editedSource.updatedAt }
      : draft),
    playlists: fixture.playlists.map((playlist) => playlist.id === orderedFixture.id
      ? { ...playlist, revision: orderedSource.revision, entries: orderedSource.entries, updatedAt: orderedSource.updatedAt }
      : playlist),
  };
  assert.equal(canonicalSnapshot(snapshot), canonicalSnapshot(expected), "Source differs from the fixture outside the known name/revision edit and catalog membership append");
}

function assertOnlyRecoveryEdit(before, after) {
  const previous = before.drafts.find((draft) => draft.id === recoveryEditId);
  const current = after.drafts.find((draft) => draft.id === recoveryEditId);
  assert.ok(previous && current, "Recovery edit target is missing");
  assert.equal(previous.name, recoverySourceName);
  assert.equal(current.name, editedName);
  assert.equal(current.createdAt, previous.createdAt);
  assertUpdated(current, previous, "Recovery edit");
  const expected = {
    drafts: before.drafts.map((draft) => draft.id === current.id
      ? { ...draft, name: current.name, revision: current.revision, updatedAt: current.updatedAt }
      : draft),
    playlists: before.playlists,
  };
  assert.equal(canonicalSnapshot(after), canonicalSnapshot(expected), "Recovery changed authored fields other than the one requested name edit");
}

let primaryFailure;
try {
  source.waitForDevice();
  recovery.waitForDevice();
  assert.equal(source.adb("shell", "getprop", "ro.kernel.qemu"), "1", "Source target must be an emulator");
  assert.equal(recovery.adb("shell", "getprop", "ro.kernel.qemu"), "1", "Recovery target must be an emulator");
  const recoveryAlreadyInstalled = recovery.adb("shell", "pm", "list", "packages", appId).includes(appId);
  const packagePolicy = inspectPackagePolicy(apk);
  assertSourceSnapshot(sourceBaseline);
  writeFileSync(resolve(evidence, "source-catalog-baseline.json"), sourceBaselineText);
  const sourceVersionBeforeUpdate = source.versionCode();
  assert.ok(packagePolicy.versionCode >= sourceVersionBeforeUpdate, "Source app is newer than the inspected final APK");
  setOffline(source);
  setOffline(recovery);

  let sourceBeforeUpdate;
  let captured;
  let sourceVersionAfterUpdate;
  let sourceUpgradeMode;
  let sourceUpgradeEvidence;
  if (sourceVersionBeforeUpdate < packagePolicy.versionCode) {
    await source.startup();
    sourceBeforeUpdate = await source.saveExport("source-before-upgrade");
    assertSourceSnapshot(sourceBeforeUpdate.snapshot);
    assert.equal(
      canonicalSnapshot(sourceBeforeUpdate.snapshot),
      canonicalSnapshot(sourceBaseline),
      "Current source differs from the catalog owner's validated canonical snapshot before update",
    );
    await source.close();
    source.adb("shell", "am", "force-stop", appId);
    source.waitForDevice();
    source.adb("install", "-r", resolve(apk));
    sourceVersionAfterUpdate = source.versionCode();
    assert.equal(sourceVersionAfterUpdate, packagePolicy.versionCode, "Source app did not upgrade to the inspected final APK");
    await source.startup();
    captured = await source.saveExport("source");
    sourceUpgradeMode = "performed-in-this-run";
  } else {
    assert.equal(sourceVersionBeforeUpdate, packagePolicy.versionCode, "Source version does not match the inspected final APK");
    assert.ok(previousSourceEvidenceDirectory, "A resumed proof needs the previous source-upgrade evidence directory");
    const priorDirectory = resolve(previousSourceEvidenceDirectory);
    const beforeText = readFileSync(join(priorDirectory, "source-before-upgrade.json"), "utf8");
    const priorAfterText = readFileSync(join(priorDirectory, "source.json"), "utf8");
    const beforeSnapshot = decodeLibraryBackup(beforeText);
    const priorAfterSnapshot = decodeLibraryBackup(priorAfterText);
    assertSourceSnapshot(beforeSnapshot);
    assertSourceSnapshot(priorAfterSnapshot);
    assert.equal(canonicalSnapshot(beforeSnapshot), canonicalSnapshot(sourceBaseline), "Prior pre-upgrade export differs from the validated source baseline");
    assert.equal(canonicalSnapshot(priorAfterSnapshot), canonicalSnapshot(sourceBaseline), "Prior post-upgrade export differs from the validated source baseline");
    sourceUpgradeEvidence = JSON.parse(readFileSync(join(priorDirectory, "source-upgrade.json"), "utf8"));
    assert.equal(sourceUpgradeEvidence.sameSignatureUpgrade, true, "Prior source upgrade did not use an accepted same-signature install");
    assert.ok(sourceUpgradeEvidence.versionCodeBefore < sourceUpgradeEvidence.versionCodeAfter, "Prior source install was not an upgrade");
    assert.equal(sourceUpgradeEvidence.versionCodeAfter, packagePolicy.versionCode, "Prior source upgrade did not install the inspected APK");
    assert.equal(sourceUpgradeEvidence.sourceCanonicalUnchanged, true, "Prior source upgrade did not preserve the canonical library");
    assert.equal(sourceUpgradeEvidence.sourceBeforeUpgradeMatchesCatalogBaseline, true, "Prior source upgrade began from the validated baseline");
    sourceBeforeUpdate = {
      filename: `cruxcontrol-library-${beforeSnapshot.exportedAt.replace(/:/g, "-")}.json`,
      text: beforeText,
      snapshot: beforeSnapshot,
    };
    writeFileSync(resolve(evidence, "source-before-upgrade.json"), beforeText);
    writeFileSync(resolve(evidence, "prior-source-after-upgrade.json"), priorAfterText);
    writeFileSync(resolve(evidence, "source-before-upgrade-logcat.txt"), readFileSync(join(priorDirectory, "source-before-upgrade-logcat.txt")));
    await source.startup();
    captured = await source.saveExport("source");
    assert.equal(canonicalSnapshot(captured.snapshot), canonicalSnapshot(priorAfterSnapshot), "Resumed current export differs from the prior post-upgrade export");
    sourceVersionAfterUpdate = source.versionCode();
    assert.equal(sourceVersionAfterUpdate, packagePolicy.versionCode, "Resumed source is not on the inspected final APK");
    sourceUpgradeMode = "resumed-after-prior-upgrade";
  }
  assertSourceSnapshot(captured.snapshot);
  assert.equal(
    canonicalSnapshot(captured.snapshot),
    canonicalSnapshot(sourceBeforeUpdate.snapshot),
    "Same-signature update changed the source library",
  );
  if (sourceUpgradeMode === "performed-in-this-run") {
    sourceUpgradeEvidence = {
      versionCodeBefore: sourceVersionBeforeUpdate,
      versionCodeAfter: sourceVersionAfterUpdate,
      installCommand: "adb install -r",
      sameSignatureUpgrade: true,
      sourceCanonicalUnchanged: true,
      sourceBeforeUpgradeMatchesCatalogBaseline: true,
    };
    writeFileSync(resolve(evidence, "source-upgrade.json"), JSON.stringify(sourceUpgradeEvidence, null, 2));
  }

  recovery.waitForDevice();
  if (recoveryAlreadyInstalled) {
    assert.equal(recovery.versionCode(), packagePolicy.versionCode, "Resumed recovery installation is not the inspected final APK");
  } else {
    recovery.adb("install", resolve(apk));
  }
  assert.equal(recovery.versionCode(), packagePolicy.versionCode, "Recovery app did not install the inspected final APK");
  const recoveryBrowserDatabases = await recovery.startup();
  assert.deepEqual(await recovery.counts(), { climbs: 0, playlists: 0 }, "Recovery installation must start with an empty native library");
  const recoveryLog = beginLogcatWindow(recovery, "restore");
  await recovery.click("Back up & restore");
  const backupInput = captured.text;
  const decoded = decodeLibraryBackup(backupInput);
  await recovery.evaluate(`(() => { const input = document.querySelector('#library-backup-file'); const files = new DataTransfer(); files.items.add(new File([${JSON.stringify(backupInput)}], ${JSON.stringify(captured.filename)}, { type: 'application/json' })); input.files = files.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  const addLabel = `Add ${decoded.drafts.length} climbs & ${decoded.playlists.length} playlists`;
  await recovery.waitFor(`[...document.querySelectorAll('button')].some(b => b.innerText.trim() === ${JSON.stringify(addLabel)} && !b.disabled)`, "Actual Android export could not be reviewed for restore");
  await recovery.click(addLabel);
  await recovery.waitFor("document.body.innerText.includes('Recovery complete')", "Actual Android export did not restore into the empty installation");
  assert.deepEqual(await recovery.counts(), { climbs: decoded.drafts.length, playlists: decoded.playlists.length });
  await recovery.click("Close");

  const restored = await recovery.saveExport("restored", { logWindow: recoveryLog, payloads: [backupInput] });
  assert.equal(canonicalSnapshot(restored.snapshot), canonicalSnapshot(captured.snapshot), "Restored export differs from the actual file delivered by Android's document picker");
  const editLog = beginLogcatWindow(recovery, "recovery-edit");
  await recovery.editClimbName(recoverySourceName, editedName);
  const edited = await recovery.saveExport("recovery-edited", {
    logWindow: editLog,
    payloads: [backupInput, restored.text],
    forbiddenMarkers: [recoverySourceName, editedName],
  });
  assertOnlyRecoveryEdit(captured.snapshot, edited.snapshot);

  await recovery.close();
  recovery.adb("shell", "am", "force-stop", appId);
  const relaunchedBrowserDatabases = await recovery.startup();
  const relaunchLog = beginLogcatWindow(recovery, "relaunch");
  const relaunched = await recovery.saveExport("recovery-relaunched", { logWindow: relaunchLog, payloads: [backupInput, edited.text] });
  assert.equal(canonicalSnapshot(relaunched.snapshot), canonicalSnapshot(edited.snapshot), "Process relaunch changed the restored library after the intentional editor edit");

  writeFileSync(resolve(evidence, "result.json"), JSON.stringify({
    packagePolicy,
    sourceUpgrade: { ...sourceUpgradeEvidence, verificationMode: sourceUpgradeMode },
    sourceBeforeUpgradeFilename: sourceBeforeUpdate.filename,
    sourceFilename: captured.filename,
    sourceCanonicalComparison: "synthetic native source equals the committed fixture plus exactly one named-climb update and one catalog-provider append",
    sourceClimbs: captured.snapshot.drafts.length,
    sourcePlaylists: captured.snapshot.playlists.length,
    recoveryStartedEmpty: true,
    recoveryInstallResumed: recoveryAlreadyInstalled,
    offline: true,
    documentProviderReadback: true,
    restoredFilename: restored.filename,
    recoveredCanonicalComparison: "actual selected-location file equals the independent empty-installation restore export",
    recoveryEditorChange: { id: recoveryEditId, previousName: recoverySourceName, name: editedName },
    recoveryEditedFilename: edited.filename,
    relaunchFilename: relaunched.filename,
    forceStopRelaunchCanonicalComparison: true,
    browserIndexedDBNames: [...new Set([...recoveryBrowserDatabases, ...relaunchedBrowserDatabases])],
    browserLibraryDatabases: [],
    logcat: { source: captured.logcat, restore: restored.logcat, recoveryEdit: edited.logcat, relaunch: relaunched.logcat },
  }, null, 2));
  console.log(`Android portable restore passed. Evidence: ${evidence}`);
} catch (error) {
  primaryFailure = error;
  throw error;
} finally {
  const cleanupFailures = [];
  try { await source.close(); } catch (error) { cleanupFailures.push(error); }
  try { await recovery.close(); } catch (error) { cleanupFailures.push(error); }
  for (const [target, original] of originals) {
    if (original !== "1") {
      try {
        target.adb("shell", "cmd", "connectivity", "airplane-mode", "disable");
      } catch (error) {
        cleanupFailures.push(error);
      }
    }
  }
  if (cleanupFailures.length) {
    if (primaryFailure) console.error(`Cleanup also reported ${cleanupFailures.length} error(s) after the primary failure.`);
    else throw new AggregateError(cleanupFailures, "Android portable proof cleanup failed");
  }
}

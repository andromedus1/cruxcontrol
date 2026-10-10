// Run with Node 22 --experimental-strip-types on a prepared synthetic source emulator
// and a booted emulator without the app installed. It never clears or uninstalls data.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

const [sourceSerial, recoverySerial, apk, evidenceDirectory, sourceBaselineFile, optionalSourceEvidenceOrMode, optionalModeOrBuildProvenance, optionalBuildProvenance] = process.argv.slice(2);
const proofMode = ["source-upgrade", "grade-roundtrip"].includes(optionalSourceEvidenceOrMode)
  ? optionalSourceEvidenceOrMode
  : optionalModeOrBuildProvenance ?? "source-upgrade";
const previousSourceEvidenceDirectory = ["source-upgrade", "grade-roundtrip"].includes(optionalSourceEvidenceOrMode)
  ? undefined
  : optionalSourceEvidenceOrMode;
const buildProvenanceFile = ["source-upgrade", "grade-roundtrip"].includes(optionalSourceEvidenceOrMode)
  ? optionalModeOrBuildProvenance
  : optionalBuildProvenance;
if (!/^emulator-\d+$/.test(sourceSerial ?? "") || !/^emulator-\d+$/.test(recoverySerial ?? "") || sourceSerial === recoverySerial || !apk || !evidenceDirectory || !sourceBaselineFile) {
  throw new Error("Usage: node --experimental-strip-types smoke-android-portable.mjs SOURCE_EMULATOR RECOVERY_EMULATOR APK EVIDENCE_DIRECTORY SOURCE_BASELINE_JSON [PREVIOUS_SOURCE_EVIDENCE_DIRECTORY] [source-upgrade|grade-roundtrip] [BUILD_PROVENANCE_JSON]");
}
assert.ok(["source-upgrade", "grade-roundtrip"].includes(proofMode), "Proof mode must be source-upgrade or grade-roundtrip");

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
const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function gitOutput(...args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function trackedDirtyState() {
  const isDirty = (...args) => {
    try {
      execFileSync("git", args, { cwd: repoRoot, stdio: "ignore" });
      return false;
    } catch (error) {
      if (error.status === 1) return true;
      throw error;
    }
  };
  return {
    workingTree: isDirty("diff", "--quiet"),
    index: isDirty("diff", "--cached", "--quiet"),
  };
}

function makeSourceUpgradeEvidence({ before, after, versionCodeBefore, versionCodeAfter, packagePolicy }) {
  const apkEvidence = { filename: basename(apk), sha256: sha256(readFileSync(resolve(apk))) };
  const buildProvenance = readBuildProvenance(packagePolicy);
  if (buildProvenance) assert.equal(buildProvenance.apk.sha256, apkEvidence.sha256, "Build-boundary provenance refers to another APK");
  return {
    producer: "smoke-android-portable.mjs",
    schemaVersion: 1,
    verification: "same-signature adb install -r; exact SAF exports and canonical library equality",
    sourceVersionCodeBefore: versionCodeBefore,
    sourceVersionCodeAfter: versionCodeAfter,
    apkVersionCode: packagePolicy.versionCode,
    sameSignatureUpgrade: versionCodeAfter > versionCodeBefore && versionCodeAfter === packagePolicy.versionCode,
    installCommand: "adb install -r",
    sourceBaselineSha256: sha256(sourceBaselineText),
    sourceBeforeUpgradeFile: before.filename,
    sourceBeforeUpgradeSha256: sha256(before.text),
    sourceAfterUpgradeFile: after.filename,
    sourceAfterUpgradeSha256: sha256(after.text),
    sourceBeforeCanonicalSha256: sha256(canonicalSnapshot(before.snapshot)),
    sourceAfterCanonicalSha256: sha256(canonicalSnapshot(after.snapshot)),
    sourceCanonicalEqualsBaseline: canonicalSnapshot(before.snapshot) === canonicalSnapshot(sourceBaseline)
      && canonicalSnapshot(after.snapshot) === canonicalSnapshot(sourceBaseline),
    apk: apkEvidence,
    buildProvenance,
    repositoryAtVerification: {
      commit: gitOutput("rev-parse", "HEAD"),
      trackedDirty: trackedDirtyState(),
    },
  };
}

function readBuildProvenance(packagePolicy) {
  if (!buildProvenanceFile) return undefined;
  const provenance = JSON.parse(readFileSync(resolve(buildProvenanceFile), "utf8"));
  assert.equal(provenance.producer, "android-portable-build-boundary", "Build provenance was not created by the documented build wrapper");
  assert.equal(provenance.schemaVersion, 1, "Build provenance schema is unsupported");
  assert.match(
    provenance.command,
    /^npm --prefix prototypes\/ios run build:android:catalog -- --catalog \S+ --version-code \d+$/,
    "Build provenance must record the exact private catalog build command",
  );
  if (packagePolicy) assert.ok(provenance.command.endsWith(`--version-code ${packagePolicy.versionCode}`), "Build command version code differs from APK metadata");
  assert.ok(provenance.startedAt && provenance.finishedAt, "Build provenance is missing its build interval");
  assert.ok(provenance.repository?.commit, "Build provenance is missing the source commit");
  assert.equal(typeof provenance.repository?.trackedDirty?.workingTree, "boolean");
  assert.equal(typeof provenance.repository?.trackedDirty?.index, "boolean");
  assert.equal(provenance.apk?.sha256, sha256(readFileSync(resolve(apk))), "Build provenance APK hash does not match the inspected artifact");
  return provenance;
}

function verifyPriorSourceUpgrade(directory, packagePolicy) {
  const priorDirectory = resolve(directory);
  const beforeText = readFileSync(join(priorDirectory, "source-before-upgrade.json"), "utf8");
  const afterText = readFileSync(join(priorDirectory, "source.json"), "utf8");
  const before = decodeLibraryBackup(beforeText);
  const after = decodeLibraryBackup(afterText);
  const proof = JSON.parse(readFileSync(join(priorDirectory, "source-upgrade.json"), "utf8"));
  assert.equal(proof.producer, "smoke-android-portable.mjs", "Prior source-upgrade receipt was not written by the committed runner");
  assert.equal(proof.schemaVersion, 1, "Prior source-upgrade receipt schema is unsupported");
  assert.equal(proof.sourceBaselineSha256, sha256(sourceBaselineText), "Prior source receipt refers to another source baseline");
  assert.equal(proof.sourceBeforeUpgradeSha256, sha256(beforeText), "Prior pre-upgrade export does not match its machine receipt");
  assert.equal(proof.sourceAfterUpgradeSha256, sha256(afterText), "Prior post-upgrade export does not match its machine receipt");
  assert.equal(proof.apk?.sha256, sha256(readFileSync(resolve(apk))), "Prior source upgrade used a different APK");
  assert.equal(proof.apkVersionCode, packagePolicy.versionCode, "Prior source upgrade used a different APK version");
  assert.ok(proof.sourceVersionCodeBefore < proof.sourceVersionCodeAfter, "Prior source receipt does not prove a version upgrade");
  assert.equal(proof.sourceVersionCodeAfter, packagePolicy.versionCode, "Prior source receipt ended at a different APK version");
  assert.equal(proof.sameSignatureUpgrade, true, "Prior source receipt does not prove adb install -r succeeded");
  assert.equal(proof.sourceCanonicalEqualsBaseline, true, "Prior machine receipt does not prove exact baseline equality");
  if (proof.buildProvenance) assert.equal(proof.buildProvenance.apk.sha256, proof.apk.sha256, "Prior build provenance refers to another APK");
  assert.equal(proof.sourceBeforeCanonicalSha256, sha256(canonicalSnapshot(sourceBaseline)), "Prior pre-upgrade canonical library differs from baseline");
  assert.equal(proof.sourceAfterCanonicalSha256, sha256(canonicalSnapshot(sourceBaseline)), "Prior post-upgrade canonical library differs from baseline");
  const beforeLogcat = JSON.parse(readFileSync(join(priorDirectory, "source-before-upgrade-logcat-check.json"), "utf8"));
  const afterLogcat = JSON.parse(readFileSync(join(priorDirectory, "source-logcat-check.json"), "utf8"));
  assert.deepEqual(beforeLogcat.foundCanaries, [], "Prior pre-upgrade Logcat contains a checked synthetic canary");
  assert.deepEqual(afterLogcat.foundCanaries, [], "Prior post-upgrade Logcat contains a checked synthetic canary");
  assert.equal(beforeLogcat.markersRetained, true, "Prior pre-upgrade Logcat window was incomplete");
  assert.equal(afterLogcat.markersRetained, true, "Prior post-upgrade Logcat window was incomplete");
  assert.equal(canonicalSnapshot(before), canonicalSnapshot(sourceBaseline), "Prior pre-upgrade export differs from source baseline");
  assert.equal(canonicalSnapshot(after), canonicalSnapshot(sourceBaseline), "Prior post-upgrade export differs from source baseline");
  return { beforeText, afterText, before, after, proof };
}

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

function captureLogcatWindow(target, name, windowMarkers, forbiddenMarkers = [syntheticMarker]) {
  try {
    target.adb("shell", "log", "-p", "i", "-t", "CruxBackupProof", windowMarkers.end);
    const logcat = target.adbBytes("logcat", "-b", "main", "-d", "-v", "raw").toString("utf8");
    const start = logcat.indexOf(windowMarkers.begin);
    const finish = logcat.indexOf(windowMarkers.end, start + windowMarkers.begin.length);
    const markersRetained = start >= 0 && finish > start;
    const window = markersRetained ? logcat.slice(start, finish) : logcat;
    const foundCanaries = forbiddenMarkers.filter((marker) => window.includes(marker));
    writeFileSync(resolve(evidence, `${name}-logcat.txt`), window);
    const report = {
      captured: true,
      markersRetained,
      checkedUniqueCanaries: forbiddenMarkers,
      foundCanaries,
      fullBackupPayloadAbsenceClaim: false,
    };
    writeFileSync(resolve(evidence, `${name}-logcat-check.json`), JSON.stringify(report, null, 2));
    return report;
  } catch (error) {
    const report = { captured: false, error: error.message, checkedUniqueCanaries: forbiddenMarkers, fullBackupPayloadAbsenceClaim: false };
    writeFileSync(resolve(evidence, `${name}-logcat-check.json`), JSON.stringify(report, null, 2));
    return report;
  }
}

function assertLogcatClean(report, name) {
  assert.equal(report.captured, true, `${name} Logcat window could not be captured`);
  assert.equal(report.markersRetained, true, `${name} Logcat window markers were not both retained`);
  assert.deepEqual(report.foundCanaries, [], `${name} Logcat contains a synthetic backup canary`);
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

  async function saveExport(name, { logWindow, forbiddenMarkers = [syntheticMarker], onReadback } = {}) {
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
    onReadback?.({ filename, text, snapshot });
    const logcat = captureLogcatWindow({ adb, adbBytes }, name, logMarkers, forbiddenMarkers);
    await click("Close");
    return { filename, text, snapshot, logcat };
  }

  async function cancelSave() {
    const logMarkers = beginLogcatWindow({ adb, adbBytes }, "save-cancel");
    await click("Back up & restore");
    await click("Save library backup file");
    adb("shell", "input", "keyevent", "KEYCODE_BACK");
    await waitFor("document.body.innerText.includes('Backup export canceled.')", "Native document-picker cancellation was not reported");
    const status = await evaluate("document.body.innerText");
    assert.ok(status.includes("Backup export canceled."));
    const logcat = captureLogcatWindow({ adb, adbBytes }, "save-cancel", logMarkers, [syntheticMarker]);
    await click("Close");
    return { outcome: "cancelled", status: "Backup export canceled.", logcat };
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

  async function editClimbGradeAndAngle(existingName, grade, angle) {
    await click(existingName, true);
    await click("Edit climb");
    await waitFor(
      `[...document.querySelectorAll('input')].some(input => input.value === ${JSON.stringify(existingName)})`,
      "Restored climb editor unavailable for grade and angle edit",
    );
    await evaluate(`(() => {
      const grade = document.querySelector('input[placeholder="e.g. V4 or 6B"]');
      const angleLabel = [...document.querySelectorAll('label')].find(label => label.childNodes[0]?.textContent?.trim() === 'Angle');
      const angleInput = angleLabel?.querySelector('select');
      if (!grade || !angleInput) throw new Error('Restored grade or angle control missing');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(grade, ${JSON.stringify(grade)});
      grade.dispatchEvent(new Event('input', { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(angleInput, ${JSON.stringify(String(angle))});
      angleInput.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(
      `document.querySelector('.save-chip')?.textContent === 'saved' && document.querySelector('input[placeholder="e.g. V4 or 6B"]')?.value === ${JSON.stringify(grade)} && [...document.querySelectorAll('label')].find(label => label.childNodes[0]?.textContent?.trim() === 'Angle')?.querySelector('select')?.value === ${JSON.stringify(String(angle))}`,
      "Restored synthetic grade and angle edit did not save",
    );
    await click("Back");
  }

  return { adb, adbBytes, startup, close, counts, saveExport, cancelSave, attach, click, evaluate, waitFor, editClimbName, editClimbGradeAndAngle, versionCode, waitForDevice };
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

function assertOnlyGradeAngleEdit(before, after) {
  const previous = before.drafts.find((draft) => draft.id === recoveryEditId);
  const current = after.drafts.find((draft) => draft.id === recoveryEditId);
  assert.ok(previous && current, "Grade/angle edit target is missing");
  assert.equal(previous.name, editedName, "The known earlier name edit must remain unchanged");
  assert.equal(current.name, previous.name, "The grade/angle edit changed the climb name");
  assert.equal(previous.angle, 40);
  assert.equal(current.angle, 45);
  assert.equal(previous.metadata.grade, undefined, "Baseline must not already have a grade");
  assert.equal(current.metadata.grade, "V4");
  assert.equal(current.createdAt, previous.createdAt);
  assertUpdated(current, previous, "Grade/angle edit");
  const expected = {
    drafts: before.drafts.map((draft) => draft.id === current.id
      ? { ...draft, angle: 45, metadata: { ...draft.metadata, grade: "V4" }, revision: current.revision, updatedAt: current.updatedAt }
      : draft),
    playlists: before.playlists,
  };
  assert.equal(canonicalSnapshot(after), canonicalSnapshot(expected), "Grade/angle edit changed another authored field or record");
}

async function runGradeRoundtrip(packagePolicy, recoveryAlreadyInstalled) {
  assert.equal(recoveryAlreadyInstalled, false, "Grade roundtrip requires the separate recovery emulator to remain uninstalled and empty");
  assert.ok(buildProvenanceFile, "Grade roundtrip requires the APK build-boundary provenance file");
  assertSourceSnapshotForGradeBaseline(sourceBaseline);
  writeFileSync(resolve(evidence, "source-grade-baseline.json"), sourceBaselineText);
  const sourceVersionBeforeUpdate = source.versionCode();
  assert.ok(packagePolicy.versionCode > sourceVersionBeforeUpdate, "Grade proof APK must be a newer same-signature source update");
  setOffline(source);
  setOffline(recovery);

  await source.startup();
  const sourceBeforeUpdate = await source.saveExport("source-before-upgrade");
  assert.equal(canonicalSnapshot(sourceBeforeUpdate.snapshot), canonicalSnapshot(sourceBaseline), "Recovery 5582 differs from its accepted APK8 baseline before the final-source update");
  assertLogcatClean(sourceBeforeUpdate.logcat, "grade source before upgrade");
  await source.close();
  source.adb("shell", "am", "force-stop", appId);
  source.waitForDevice();
  source.adb("install", "-r", resolve(apk));
  const sourceVersionAfterUpdate = source.versionCode();
  assert.equal(sourceVersionAfterUpdate, packagePolicy.versionCode, "Source app did not upgrade to the inspected final APK");

  await source.startup();
  let sourceUpgradeEvidence;
  const sourceAfterUpdate = await source.saveExport("source", {
    onReadback(after) {
      assert.equal(canonicalSnapshot(after.snapshot), canonicalSnapshot(sourceBeforeUpdate.snapshot), "Same-signature update changed the recovery 5582 library");
      sourceUpgradeEvidence = makeSourceUpgradeEvidence({
        before: sourceBeforeUpdate,
        after,
        versionCodeBefore: sourceVersionBeforeUpdate,
        versionCodeAfter: sourceVersionAfterUpdate,
        packagePolicy,
      });
      writeFileSync(resolve(evidence, "source-upgrade.json"), JSON.stringify(sourceUpgradeEvidence, null, 2));
    },
  });
  assertLogcatClean(sourceAfterUpdate.logcat, "grade source after upgrade");

  const baselineDraft = sourceBaseline.drafts.find((draft) => draft.id === recoveryEditId);
  assert.ok(baselineDraft);
  const gradeEditLog = beginLogcatWindow(source, "grade-angle-edit");
  await source.editClimbGradeAndAngle(editedName, "V4", 45);
  const gradeEdited = await source.saveExport("source-grade-edited", {
    logWindow: gradeEditLog,
    forbiddenMarkers: [syntheticMarker, editedName],
  });
  assertOnlyGradeAngleEdit(sourceBaseline, gradeEdited.snapshot);
  assertLogcatClean(gradeEdited.logcat, "native grade and angle edit");

  await source.close();
  source.adb("shell", "am", "force-stop", appId);
  const sourceBrowserDatabases = await source.startup();
  const sourceRelaunchLog = beginLogcatWindow(source, "source-grade-relaunch");
  const sourceRelaunched = await source.saveExport("source-grade-relaunched", {
    logWindow: sourceRelaunchLog,
    forbiddenMarkers: [syntheticMarker, editedName],
  });
  assert.equal(canonicalSnapshot(sourceRelaunched.snapshot), canonicalSnapshot(gradeEdited.snapshot), "Native grade/angle edit did not survive force-stop and relaunch on emulator 5582");
  assertLogcatClean(sourceRelaunched.logcat, "native grade and angle relaunch");

  recovery.adb("install", resolve(apk));
  assert.equal(recovery.versionCode(), packagePolicy.versionCode, "Fresh recovery emulator did not install the inspected APK");
  const recoveryBrowserDatabases = await recovery.startup();
  assert.deepEqual(await recovery.counts(), { climbs: 0, playlists: 0 }, "Fresh grade recovery emulator must start with an empty native library");
  const cancellation = await recovery.cancelSave();
  assertLogcatClean(cancellation.logcat, "grade proof native picker cancellation");

  const recoveryLog = beginLogcatWindow(recovery, "grade-restore");
  await recovery.click("Back up & restore");
  const backupInput = sourceRelaunched.text;
  const decoded = decodeLibraryBackup(backupInput);
  await recovery.evaluate(`(() => { const input = document.querySelector('#library-backup-file'); const files = new DataTransfer(); files.items.add(new File([${JSON.stringify(backupInput)}], ${JSON.stringify(sourceRelaunched.filename)}, { type: 'application/json' })); input.files = files.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  const addLabel = `Add ${decoded.drafts.length} climbs & ${decoded.playlists.length} playlists`;
  await recovery.waitFor(`[...document.querySelectorAll('button')].some(b => b.innerText.trim() === ${JSON.stringify(addLabel)} && !b.disabled)`, "Actual graded SAF export could not be reviewed for restore");
  await recovery.click(addLabel);
  await recovery.waitFor("document.body.innerText.includes('Recovery complete')", "Actual graded SAF export did not restore into the fresh empty installation");
  assert.deepEqual(await recovery.counts(), { climbs: decoded.drafts.length, playlists: decoded.playlists.length });
  await recovery.click("Close");
  const restored = await recovery.saveExport("grade-restored", { logWindow: recoveryLog, forbiddenMarkers: [syntheticMarker, editedName] });
  assert.equal(canonicalSnapshot(restored.snapshot), canonicalSnapshot(sourceRelaunched.snapshot), "Restored file differs from the actual graded SAF bytes written on emulator 5582");
  const restoredDraft = restored.snapshot.drafts.find((draft) => draft.id === recoveryEditId);
  assert.equal(restoredDraft?.metadata.grade, "V4", "Grade did not survive file export and restore");
  assert.equal(restoredDraft?.angle, 45, "Different angle did not survive file export and restore");
  assertLogcatClean(restored.logcat, "grade restore export");

  await recovery.close();
  recovery.adb("shell", "am", "force-stop", appId);
  const relaunchBrowserDatabases = await recovery.startup();
  const recoveryRelaunchLog = beginLogcatWindow(recovery, "grade-recovery-relaunch");
  const recoveryRelaunched = await recovery.saveExport("grade-recovery-relaunched", {
    logWindow: recoveryRelaunchLog,
    forbiddenMarkers: [syntheticMarker, editedName],
  });
  assert.equal(canonicalSnapshot(recoveryRelaunched.snapshot), canonicalSnapshot(sourceRelaunched.snapshot), "Graded restore changed after force-stop and relaunch on emulator 5586");
  assertLogcatClean(recoveryRelaunched.logcat, "grade recovery relaunch export");
  const updatedDraft = sourceRelaunched.snapshot.drafts.find((draft) => draft.id === recoveryEditId);

  writeFileSync(resolve(evidence, "result.json"), JSON.stringify({
    packagePolicy,
    sourceUpgrade: { ...sourceUpgradeEvidence, verificationMode: "performed-in-this-run" },
    apkProvenance: sourceUpgradeEvidence.apk,
    buildProvenance: sourceUpgradeEvidence.buildProvenance,
    repositoryProvenance: sourceUpgradeEvidence.repositoryAtVerification,
    sourceBaselineSha256: sha256(sourceBaselineText),
    sourceBaselineOrigin: "accepted APK8 recovery-relaunched.json export with the one previously verified native name edit",
    sourceCanonicalComparison: "recovery 5582 equals its accepted APK8 export before and after same-signature install -r",
    gradeAngleEdit: {
      id: recoveryEditId,
      name: updatedDraft?.name,
      previousAngle: baselineDraft.angle,
      angle: updatedDraft?.angle,
      previousGrade: baselineDraft.metadata.grade ?? null,
      grade: updatedDraft?.metadata.grade,
      revisionBefore: baselineDraft.revision,
      revisionAfter: updatedDraft?.revision,
    },
    sourceGradeExportFilename: sourceRelaunched.filename,
    sourceGradeExportSha256: sha256(sourceRelaunched.text),
    sourceGradeSurvivedRelaunch: true,
    recoveryStartedEmpty: true,
    recoveryInstallResumed: false,
    offline: true,
    cancellation,
    documentProviderReadback: true,
    recoveryImportMethod: "harness-injected-file-input (DataTransfer); Android system file chooser import was not exercised",
    restoredFilename: restored.filename,
    recoveredCanonicalComparison: "actual SAF-selected grade export equals the fresh independent installation's re-export",
    recoveredGrade: { angle: restoredDraft?.angle, grade: restoredDraft?.metadata.grade },
    recoveryRelaunchFilename: recoveryRelaunched.filename,
    recoveredGradeSurvivedRelaunch: true,
    browserIndexedDBNames: [...new Set([...sourceBrowserDatabases, ...recoveryBrowserDatabases, ...relaunchBrowserDatabases])],
    browserLibraryDatabases: [],
    logcat: {
      sourceBeforeUpgrade: sourceBeforeUpdate.logcat,
      sourceAfterUpgrade: sourceAfterUpdate.logcat,
      gradeAngleEdit: gradeEdited.logcat,
      sourceRelaunch: sourceRelaunched.logcat,
      cancellation: cancellation.logcat,
      restore: restored.logcat,
      recoveryRelaunch: recoveryRelaunched.logcat,
      fullBackupPayloadAbsenceClaim: false,
    },
  }, null, 2));
  console.log(`Android native grade and portable restore passed. Evidence: ${evidence}`);
}

function assertSourceSnapshotForGradeBaseline(snapshot) {
  const draft = snapshot.drafts.find((record) => record.id === recoveryEditId);
  assert.ok(draft, "Accepted recovery baseline is missing its known synthetic climb");
  assert.equal(draft.name, editedName, "Grade baseline must retain the already verified name edit");
  assert.equal(draft.angle, 40, "Grade baseline must start at angle 40 before the new native edit");
  assert.equal(draft.metadata.grade, undefined, "Grade baseline must not already have a grade");
  assert.equal(snapshot.drafts.length, 4, "Grade baseline should preserve all four synthetic climbs");
  assert.equal(snapshot.playlists.length, 2, "Grade baseline should preserve both synthetic playlists");
}

let primaryFailure;
try {
  source.waitForDevice();
  recovery.waitForDevice();
  assert.equal(source.adb("shell", "getprop", "ro.kernel.qemu"), "1", "Source target must be an emulator");
  assert.equal(recovery.adb("shell", "getprop", "ro.kernel.qemu"), "1", "Recovery target must be an emulator");
  const recoveryAlreadyInstalled = recovery.adb("shell", "pm", "list", "packages", appId).includes(appId);
  const packagePolicy = inspectPackagePolicy(apk);
  if (buildProvenanceFile) {
    const provenance = readBuildProvenance(packagePolicy);
    writeFileSync(resolve(evidence, "build-provenance.json"), JSON.stringify(provenance, null, 2));
  }
  if (proofMode === "grade-roundtrip") {
    await runGradeRoundtrip(packagePolicy, recoveryAlreadyInstalled);
  } else {
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
    assertLogcatClean(sourceBeforeUpdate.logcat, "source before upgrade");
    await source.close();
    source.adb("shell", "am", "force-stop", appId);
    source.waitForDevice();
    source.adb("install", "-r", resolve(apk));
    sourceVersionAfterUpdate = source.versionCode();
    assert.equal(sourceVersionAfterUpdate, packagePolicy.versionCode, "Source app did not upgrade to the inspected final APK");
    await source.startup();
    sourceUpgradeMode = "performed-in-this-run";
    captured = await source.saveExport("source", {
      onReadback(after) {
        assertSourceSnapshot(after.snapshot);
        assert.equal(canonicalSnapshot(after.snapshot), canonicalSnapshot(sourceBeforeUpdate.snapshot), "Same-signature update changed the source library");
        sourceUpgradeEvidence = makeSourceUpgradeEvidence({
          before: sourceBeforeUpdate,
          after,
          versionCodeBefore: sourceVersionBeforeUpdate,
          versionCodeAfter: sourceVersionAfterUpdate,
          packagePolicy,
        });
        writeFileSync(resolve(evidence, "source-upgrade.json"), JSON.stringify(sourceUpgradeEvidence, null, 2));
      },
    });
    assertLogcatClean(captured.logcat, "source after upgrade");
  } else {
    assert.equal(sourceVersionBeforeUpdate, packagePolicy.versionCode, "Source version does not match the inspected final APK");
    assert.ok(previousSourceEvidenceDirectory, "A resumed proof needs the previous source-upgrade evidence directory");
    const prior = verifyPriorSourceUpgrade(previousSourceEvidenceDirectory, packagePolicy);
    const { beforeText, afterText: priorAfterText, before: beforeSnapshot, after: priorAfterSnapshot } = prior;
    assertSourceSnapshot(beforeSnapshot);
    assertSourceSnapshot(priorAfterSnapshot);
    assert.equal(canonicalSnapshot(beforeSnapshot), canonicalSnapshot(sourceBaseline), "Prior pre-upgrade export differs from the validated source baseline");
    assert.equal(canonicalSnapshot(priorAfterSnapshot), canonicalSnapshot(sourceBaseline), "Prior post-upgrade export differs from the validated source baseline");
    sourceUpgradeEvidence = prior.proof;
    sourceBeforeUpdate = {
      filename: `cruxcontrol-library-${beforeSnapshot.exportedAt.replace(/:/g, "-")}.json`,
      text: beforeText,
      snapshot: beforeSnapshot,
    };
    writeFileSync(resolve(evidence, "source-before-upgrade.json"), beforeText);
    writeFileSync(resolve(evidence, "prior-source-after-upgrade.json"), priorAfterText);
    writeFileSync(resolve(evidence, "source-before-upgrade-logcat.txt"), readFileSync(join(resolve(previousSourceEvidenceDirectory), "source-before-upgrade-logcat.txt")));
    await source.startup();
    captured = await source.saveExport("source");
    assert.equal(canonicalSnapshot(captured.snapshot), canonicalSnapshot(priorAfterSnapshot), "Resumed current export differs from the prior post-upgrade export");
    sourceVersionAfterUpdate = source.versionCode();
    assert.equal(sourceVersionAfterUpdate, packagePolicy.versionCode, "Resumed source is not on the inspected final APK");
    sourceUpgradeMode = "resumed-after-prior-upgrade";
    assertLogcatClean(captured.logcat, "resumed source");
  }
  assertSourceSnapshot(captured.snapshot);
  assert.equal(
    canonicalSnapshot(captured.snapshot),
    canonicalSnapshot(sourceBeforeUpdate.snapshot),
    "Same-signature update changed the source library",
  );
  recovery.waitForDevice();
  if (recoveryAlreadyInstalled) {
    assert.equal(recovery.versionCode(), packagePolicy.versionCode, "Resumed recovery installation is not the inspected final APK");
  } else {
    recovery.adb("install", resolve(apk));
  }
  assert.equal(recovery.versionCode(), packagePolicy.versionCode, "Recovery app did not install the inspected final APK");
  const recoveryBrowserDatabases = await recovery.startup();
  assert.deepEqual(await recovery.counts(), { climbs: 0, playlists: 0 }, "Recovery installation must start with an empty native library");
  const cancellation = await recovery.cancelSave();
  assertLogcatClean(cancellation.logcat, "native picker cancellation");
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

  const restored = await recovery.saveExport("restored", { logWindow: recoveryLog });
  assertLogcatClean(restored.logcat, "restored export");
  assert.equal(canonicalSnapshot(restored.snapshot), canonicalSnapshot(captured.snapshot), "Restored export differs from the actual file delivered by Android's document picker");
  const editLog = beginLogcatWindow(recovery, "recovery-edit");
  await recovery.editClimbName(recoverySourceName, editedName);
  const edited = await recovery.saveExport("recovery-edited", {
    logWindow: editLog,
    forbiddenMarkers: [recoverySourceName, editedName],
  });
  assertLogcatClean(edited.logcat, "recovery editor write");
  assertOnlyRecoveryEdit(captured.snapshot, edited.snapshot);

  await recovery.close();
  recovery.adb("shell", "am", "force-stop", appId);
  const relaunchedBrowserDatabases = await recovery.startup();
  const relaunchLog = beginLogcatWindow(recovery, "relaunch");
  const relaunched = await recovery.saveExport("recovery-relaunched", { logWindow: relaunchLog });
  assertLogcatClean(relaunched.logcat, "recovery relaunch export");
  assert.equal(canonicalSnapshot(relaunched.snapshot), canonicalSnapshot(edited.snapshot), "Process relaunch changed the restored library after the intentional editor edit");

  writeFileSync(resolve(evidence, "result.json"), JSON.stringify({
    packagePolicy,
    sourceUpgrade: { ...sourceUpgradeEvidence, verificationMode: sourceUpgradeMode },
    apkProvenance: sourceUpgradeEvidence.apk,
    buildProvenance: sourceUpgradeEvidence.buildProvenance,
    repositoryProvenance: sourceUpgradeEvidence.repositoryAtVerification,
    sourceBeforeUpgradeFilename: sourceBeforeUpdate.filename,
    sourceFilename: captured.filename,
    sourceCanonicalComparison: "synthetic native source equals the committed fixture plus exactly one named-climb update and one catalog-provider append",
    sourceClimbs: captured.snapshot.drafts.length,
    sourcePlaylists: captured.snapshot.playlists.length,
    recoveryStartedEmpty: true,
    recoveryInstallResumed: recoveryAlreadyInstalled,
    cancellation,
    offline: true,
    documentProviderReadback: true,
    recoveryImportMethod: "harness-injected-file-input (DataTransfer); Android system file chooser import was not exercised",
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
  }
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

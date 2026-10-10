// Run with Node 22 --experimental-strip-types on two already-running isolated emulators.
// This script never clears, uninstalls, or resets an installation.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  canonicalSnapshot,
  decodeLibraryBackup,
} from "../../../web/src/library-backup/codec.ts";
import {
  chooseDownloadsAndSave,
  downloadNames,
  readDownload,
} from "./android-save-picker.mjs";

const [sourceSerial, recoverySerial, apk, evidenceDirectory] = process.argv.slice(2);
if (!/^emulator-\d+$/.test(sourceSerial ?? "") || !/^emulator-\d+$/.test(recoverySerial ?? "") || sourceSerial === recoverySerial || !apk || !evidenceDirectory) {
  throw new Error("Usage: node --experimental-strip-types smoke-android-portable.mjs SOURCE_EMULATOR RECOVERY_EMULATOR APK EVIDENCE_DIRECTORY");
}

const evidence = resolve(evidenceDirectory);
mkdirSync(evidence, { recursive: true });
const adbPath = process.env.ADB ?? `${process.env.ANDROID_HOME}/platform-tools/adb`;
const appId = "io.github.andromedus1.cruxcontrol.prototype";
const database = "cruxcontrol-library";
const fixture = decodeLibraryBackup(readFileSync(new URL("../fixtures/synthetic-library.json", import.meta.url), "utf8"));
const authoredName = "Simulator grade check";
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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
    throw new Error(`${label}\n${await evaluate("document.body.innerText")}`);
  }

  async function click(label) {
    const buttons = `[...document.querySelectorAll('button')].filter(b => !b.disabled && b.getClientRects().length && b.innerText.trim() === ${JSON.stringify(label)})`;
    await waitFor(`${buttons}.length === 1`, `Expected one enabled button: ${label}`);
    await evaluate(`${buttons}[0].click()`);
  }

  async function startup() {
    adb("shell", "am", "start", "-n", `${appId}/.MainActivity`);
    await attach();
    await waitFor("[...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Create climb')", "App failed to start");
    assert.equal(await evaluate("window.Capacitor.getPlatform()"), "android");
    assert.deepEqual(await evaluate("indexedDB.databases().then(dbs => dbs.map(db => db.name))"), [], "Native library must not use browser databases");
    assert.deepEqual(await evaluate("navigator.serviceWorker.getRegistrations().then(rows => rows.map(row => row.scope))"), []);
    assert.equal(await evaluate("document.querySelector('link[rel=manifest]') === null"), true);
  }

  async function close() {
    socket?.close();
    socket = undefined;
    if (port) {
      adb("forward", "--remove", `tcp:${port}`);
      port = undefined;
    }
  }

  async function counts() {
    const result = await evaluate(`window.Capacitor.nativePromise('CapacitorSQLite', 'query', { database: ${JSON.stringify(database)}, readonly: false, statement: 'SELECT (SELECT COUNT(*) FROM climbs) AS climbs, (SELECT COUNT(*) FROM playlists) AS playlists', values: [] })`);
    return { climbs: Number(result.values[0].climbs), playlists: Number(result.values[0].playlists) };
  }

  async function saveExport(name) {
    const before = downloadNames(adb);
    await click("Back up & restore");
    await click("Save library backup file");
    await chooseDownloadsAndSave({ adb, pause });
    await waitFor("document.body.innerText.includes('Backup file saved to the chosen location.')", "Native backup file save did not complete");
    let filename;
    let text;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        const created = [...downloadNames(adb)].filter((candidate) => !before.has(candidate));
        assert.equal(created.length, 1);
        filename = created[0];
        text = readDownload(adbBytes, filename);
        const snapshot = decodeLibraryBackup(text);
        const expectedPrefix = `cruxcontrol-library-${snapshot.exportedAt.replace(/:/g, "-")}`;
        assert.ok(filename === `${expectedPrefix}.json` || filename.startsWith(`${expectedPrefix}-`));
        break;
      } catch {
        await pause(250);
      }
    }
    assert.ok(text, "The Android document provider did not retain a readable export");
    writeFileSync(resolve(evidence, `${name}.json`), text);
    await click("Close");
    return { filename, text, snapshot: decodeLibraryBackup(text) };
  }

  return { adb, adbBytes, startup, close, counts, saveExport, attach, click, evaluate, waitFor };
}

const source = device(sourceSerial);
const recovery = device(recoverySerial);
const originals = new Map();

function setOffline(target) {
  const old = target.adb("shell", "settings", "get", "global", "airplane_mode_on");
  originals.set(target, old);
  target.adb("shell", "cmd", "connectivity", "airplane-mode", "enable");
}

function assertFixturePreserved(snapshot) {
  const fixtureIds = new Set(fixture.drafts.map((draft) => draft.id));
  const fixtureDrafts = snapshot.drafts.filter((draft) => fixtureIds.has(draft.id));
  assert.equal(fixtureDrafts.length, fixture.drafts.length);
  assert.equal(snapshot.playlists.length, fixture.playlists.length);
  assert.equal(canonicalSnapshot({ drafts: fixtureDrafts, playlists: snapshot.playlists }), canonicalSnapshot(fixture), "Fixture records or playlist order changed before export");
  const additions = snapshot.drafts.filter((draft) => !fixtureIds.has(draft.id));
  assert.equal(additions.length, 1, "Expected the single simulator-authored draft");
  assert.equal(additions[0].name, authoredName);
  assert.equal(additions[0].angle, 40);
  assert.equal(additions[0].metadata.grade, "V4");
  assert.equal(additions[0].assignments.length, 0);
}

try {
  assert.equal(source.adb("shell", "getprop", "ro.kernel.qemu"), "1", "Source target must be an emulator");
  assert.equal(recovery.adb("shell", "getprop", "ro.kernel.qemu"), "1", "Recovery target must be an emulator");
  assert.equal(recovery.adb("shell", "pm", "list", "packages", appId).includes(appId), false, "Recovery emulator must be a fresh app installation; do not clear an existing database");
  setOffline(source);
  setOffline(recovery);

  source.adb("shell", "am", "start", "-n", `${appId}/.MainActivity`);
  await source.attach();
  const captured = await source.saveExport("source");
  assertFixturePreserved(captured.snapshot);

  recovery.adb("install", resolve(apk));
  await recovery.startup();
  assert.deepEqual(await recovery.counts(), { climbs: 0, playlists: 0 }, "Recovery installation must start with an empty native library");
  await recovery.click("Back up & restore");
  const backupInput = readFileSync(resolve(evidence, "source.json"), "utf8");
  const decoded = decodeLibraryBackup(backupInput);
  await recovery.evaluate(`(() => { const input = document.querySelector('#library-backup-file'); const files = new DataTransfer(); files.items.add(new File([${JSON.stringify(backupInput)}], ${JSON.stringify(captured.filename)}, { type: 'application/json' })); input.files = files.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  const addLabel = `Add ${decoded.drafts.length} climbs & ${decoded.playlists.length} playlists`;
  await recovery.waitFor(`[...document.querySelectorAll('button')].some(b => b.innerText.trim() === ${JSON.stringify(addLabel)} && !b.disabled)`, "Actual Android export could not be reviewed for restore");
  await recovery.click(addLabel);
  await recovery.waitFor("document.body.innerText.includes('Recovery complete')", "Actual Android export did not restore into the empty installation");
  assert.deepEqual(await recovery.counts(), { climbs: decoded.drafts.length, playlists: decoded.playlists.length });
  await recovery.click("Close");

  const restored = await recovery.saveExport("restored");
  assert.equal(canonicalSnapshot(restored.snapshot), canonicalSnapshot(captured.snapshot), "Restored export differs from the actual file delivered by Android's document picker");
  writeFileSync(resolve(evidence, "result.json"), JSON.stringify({
    sourceFilename: captured.filename,
    restoredFilename: restored.filename,
    sourceClimbs: captured.snapshot.drafts.length,
    sourcePlaylists: captured.snapshot.playlists.length,
    recoveryStartedEmpty: true,
    offline: true,
    documentProviderReadback: true,
    canonicalComparison: "actual selected-location export vs isolated restore/re-export",
  }, null, 2));
  console.log(`Android portable restore passed. Evidence: ${evidence}`);
} finally {
  await source.close();
  await recovery.close();
  for (const [target, original] of originals) {
    if (original !== "1") target.adb("shell", "cmd", "connectivity", "airplane-mode", "disable");
  }
}

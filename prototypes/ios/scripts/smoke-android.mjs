// Run with Node 22 --experimental-strip-types. Never accepts a physical target.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  canonicalSnapshot,
  decodeLibraryBackup,
} from "../../../web/src/library-backup/codec.ts";

const [serial, initialApk, updateApk, evidenceDirectory] =
  process.argv.slice(2);
if (
  !/^emulator-\d+$/.test(serial ?? "") ||
  !initialApk ||
  !updateApk ||
  !evidenceDirectory
) {
  throw new Error(
    "Usage: node --experimental-strip-types smoke-android.mjs emulator-N INITIAL_APK UPDATE_APK EVIDENCE_DIRECTORY",
  );
}
const evidence = resolve(evidenceDirectory);
mkdirSync(evidence, { recursive: true });
const adbPath =
  process.env.ADB ?? `${process.env.ANDROID_HOME}/platform-tools/adb`;
const appId = "io.github.andromedus1.cruxcontrol.prototype";
const database = "cruxcontrol-library";
const fixtureText = readFileSync(
  new URL("../fixtures/synthetic-library.json", import.meta.url),
  "utf8",
);
const fixture = decodeLibraryBackup(fixtureText);
const expectedName = "Prototype finish A — Android preservation proof";
const pause = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const adb = (...args) =>
  execFileSync(adbPath, ["-s", serial, ...args], {
    encoding: "utf8",
    timeout: 30000,
  }).trim();
assert.equal(
  adb("shell", "getprop", "ro.kernel.qemu"),
  "1",
  "Target must be an emulator",
);
const originalAirplaneMode = adb(
  "shell",
  "settings",
  "get",
  "global",
  "airplane_mode_on",
);
let socket;
let port;
let sequence = 0;
const pending = new Map();

async function attach() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const pid = adb("shell", "pidof", appId);
      if (!/^\d+$/.test(pid)) throw new Error("App process unavailable");
      port = adb(
        "forward",
        "tcp:0",
        `localabstract:webview_devtools_remote_${pid}`,
      );
      const targets = await (
        await fetch(`http://127.0.0.1:${port}/json/list`, {
          signal: AbortSignal.timeout(1000),
        })
      ).json();
      const target = targets.find(
        (entry) => entry.url === "https://localhost/",
      );
      if (!target) throw new Error("Bundled app page unavailable");
      socket = new WebSocket(target.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => {
        socket.addEventListener("open", resolve, { once: true });
        socket.addEventListener("error", reject, { once: true });
      });
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.id && pending.has(message.id)) {
          const { resolve, reject, timer } = pending.get(message.id);
          pending.delete(message.id);
          clearTimeout(timer);
          if (message.error) reject(new Error(message.error.message));
          else resolve(message.result);
        }
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
  throw new Error("Could not attach to the bundled app WebView");
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
  const result = await cdp("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails)
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text,
    );
  return result.result.value;
}
async function waitFor(expression, label) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await evaluate(expression)) return;
    await pause(250);
  }
  throw new Error(`${label}\n${await evaluate("document.body.innerText")}`);
}
async function click(label, includes = false) {
  const condition = includes
    ? `b.innerText.includes(${JSON.stringify(label)})`
    : `b.innerText.trim() === ${JSON.stringify(label)}`;
  const buttons = `[...document.querySelectorAll('button')].filter(b => !b.disabled && b.getClientRects().length && ${condition})`;
  await waitFor(
    `${buttons}.length === 1`,
    `Expected one enabled button: ${label}`,
  );
  await evaluate(`${buttons}[0].click()`);
}
async function startup() {
  adb("shell", "am", "start", "-n", `${appId}/.MainActivity`);
  await attach();
  await waitFor(
    "[...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Create climb')",
    "App failed to start",
  );
  assert.equal(await evaluate("window.Capacitor.getPlatform()"), "android");
  assert.deepEqual(
    await evaluate("indexedDB.databases().then(dbs => dbs.map(db => db.name))"),
    [],
    "Native library must not open browser databases",
  );
  assert.deepEqual(
    await evaluate(
      "navigator.serviceWorker.getRegistrations().then(rows => rows.map(row => row.scope))",
    ),
    [],
  );
  assert.equal(
    await evaluate("document.querySelector('link[rel=manifest]') === null"),
    true,
  );
}
async function detach() {
  socket?.close();
  socket = undefined;
  if (port) {
    adb("forward", "--remove", `tcp:${port}`);
    port = undefined;
  }
}
async function exportSnapshot(name) {
  const startedAt = Date.now();
  await click("Back up & restore");
  await click("Save or share library backup");
  let text;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const names = adb(
        "shell",
        "run-as",
        appId,
        "ls",
        "cache/cruxcontrol-backup-export",
      ).split("\n");
      assert.equal(names.length, 1);
      assert.match(names[0], /^cruxcontrol-library-\d{4}-\d{2}-\d{2}\.json$/);
      text = adb(
        "shell",
        "run-as",
        appId,
        "cat",
        `cache/cruxcontrol-backup-export/${names[0]}`,
      );
      if (Date.parse(decodeLibraryBackup(text).exportedAt) < startedAt)
        throw new Error("Previous export is still in cache");
      break;
    } catch {
      await pause(250);
    }
  }
  assert.ok(
    text,
    `Native export did not create a complete file: ${await evaluate("document.body.innerText")}`,
  );
  writeFileSync(resolve(evidence, `${name}.json`), text);
  // Inspect the actual native export before dismissing the chooser. Destination
  // delivery and Android chooser cancellation are a separate acceptance gate.
  let chooserVisible = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (
      /topResumedActivity=.*(?:ChooserActivity|ResolverActivity)/.test(
        adb("shell", "dumpsys", "activity", "activities"),
      )
    ) {
      chooserVisible = true;
      break;
    }
    await pause(250);
  }
  assert.ok(chooserVisible, "Native share chooser did not appear");
  adb("shell", "input", "keyevent", "KEYCODE_BACK");
  await waitFor(
    "[...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Close' && !b.disabled)",
    "Export did not settle after chooser dismissal",
  );
  await click("Close");
  return decodeLibraryBackup(text);
}
async function screenshot(name) {
  writeFileSync(
    resolve(evidence, `${name}.png`),
    execFileSync(adbPath, ["-s", serial, "exec-out", "screencap", "-p"]),
  );
}
function validateEdited(edited) {
  const target = fixture.drafts.find(
    (draft) => draft.name === "Prototype finish A",
  );
  const actual = edited.drafts.find((draft) => draft.id === target.id);
  assert.equal(actual?.name, expectedName);
  assert.ok(actual.revision > target.revision);
  assert.equal(actual.createdAt, target.createdAt);
  const expected = {
    drafts: fixture.drafts.map((draft) =>
      draft.id === target.id
        ? {
            ...draft,
            name: expectedName,
            revision: actual.revision,
            updatedAt: actual.updatedAt,
          }
        : draft,
    ),
    playlists: fixture.playlists,
  };
  assert.equal(
    canonicalSnapshot(edited),
    canonicalSnapshot(expected),
    "Edit changed other authored fields or memberships",
  );
}

try {
  adb("shell", "cmd", "connectivity", "airplane-mode", "enable");
  adb("install", "-r", resolve(initialApk));
  adb("shell", "am", "force-stop", appId);
  await startup();
  await screenshot("startup");
  const beforeRestore = await exportSnapshot("before-restore");
  const resumedAfterEdit = beforeRestore.drafts.some(
    (draft) => draft.name === expectedName,
  );
  if (
    beforeRestore.drafts.length === 0 &&
    beforeRestore.playlists.length === 0
  ) {
    await click("Back up & restore");
    await evaluate(
      `(() => { const input = document.querySelector('#library-backup-file'); const files = new DataTransfer(); files.items.add(new File([${JSON.stringify(fixtureText)}], 'synthetic-library.json', { type: 'application/json' })); input.files = files.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`,
    );
    await waitFor(
      "[...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Add 4 climbs & 2 playlists')",
      "Synthetic restore review failed",
    );
    await click("Add 4 climbs & 2 playlists");
    await waitFor(
      "document.body.innerText.includes('Recovery complete')",
      "Synthetic restore failed",
    );
    await click("Close");
  } else if (resumedAfterEdit) {
    validateEdited(beforeRestore);
    assert.equal(
      canonicalSnapshot(
        decodeLibraryBackup(
          readFileSync(resolve(evidence, "restored.json"), "utf8"),
        ),
      ),
      canonicalSnapshot(fixture),
      "Resuming requires evidence of the original complete restore",
    );
  } else {
    // Permit resuming a previously interrupted proof only before its edit.
    assert.equal(
      canonicalSnapshot(beforeRestore),
      canonicalSnapshot(fixture),
      "Use a fresh isolated emulator; existing library is not the unchanged synthetic fixture",
    );
  }
  if (!resumedAfterEdit) {
    const restored = await exportSnapshot("restored");
    assert.equal(
      canonicalSnapshot(restored),
      canonicalSnapshot(fixture),
      "Complete restored export differs from fixture",
    );
    await click("Prototype finish A", true);
    await click("Edit climb");
    await waitFor(
      "[...document.querySelectorAll('input')].some(i => i.value === 'Prototype finish A')",
      "Editor unavailable",
    );
    await evaluate(
      `(() => { const input = [...document.querySelectorAll('input')].find(i => i.value === 'Prototype finish A'); if (!input) throw new Error('Name input missing'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(expectedName)}); input.dispatchEvent(new Event('input', { bubbles: true })); input.blur(); })()`,
    );
    await waitFor(
      `document.querySelector('.save-chip')?.textContent === 'saved' && document.querySelector('h1')?.textContent === ${JSON.stringify(expectedName)}`,
      "Edit did not save",
    );
    await screenshot("saved-edit");
    await click("Back");
  }
  const edited = await exportSnapshot("edited");
  validateEdited(edited);
  await detach();
  adb("shell", "am", "force-stop", appId);
  await startup();
  const relaunched = await exportSnapshot("relaunched");
  assert.equal(
    canonicalSnapshot(relaunched),
    canonicalSnapshot(edited),
    "Process termination lost authored records",
  );
  await detach();
  const beforeVersion = adb("shell", "dumpsys", "package", appId).match(
    /versionCode=(\d+)/,
  )?.[1];
  adb("install", "-r", resolve(updateApk));
  const afterVersion = adb("shell", "dumpsys", "package", appId).match(
    /versionCode=(\d+)/,
  )?.[1];
  assert.ok(
    Number(afterVersion) > Number(beforeVersion),
    "Proof requires an actual versionCode upgrade",
  );
  adb("shell", "am", "force-stop", appId);
  await startup();
  const upgraded = await exportSnapshot("upgraded");
  assert.equal(
    canonicalSnapshot(upgraded),
    canonicalSnapshot(edited),
    "Same-identity binary upgrade lost authored records",
  );
  const settings = await evaluate(
    `window.Capacitor.nativePromise('CapacitorSQLite', 'query', { database: ${JSON.stringify(database)}, readonly: false, statement: 'PRAGMA journal_mode', values: [] })`,
  );
  assert.equal(settings.values[0].journal_mode, "wal");
  const sync = await evaluate(
    `window.Capacitor.nativePromise('CapacitorSQLite', 'query', { database: ${JSON.stringify(database)}, readonly: false, statement: 'PRAGMA synchronous', values: [] })`,
  );
  assert.equal(sync.values[0].synchronous, 2);
  assert.ok(
    adb("shell", "run-as", appId, "ls", "databases").includes(
      "cruxcontrol-librarySQLite.db",
    ),
  );
  await screenshot("upgraded");
  writeFileSync(
    resolve(evidence, "result.json"),
    JSON.stringify(
      {
        platform: "Android",
        api: adb("shell", "getprop", "ro.build.version.sdk"),
        beforeVersion,
        afterVersion,
        resumedAfterEdit,
        climbs: edited.drafts.length,
        playlists: edited.playlists.length,
        canonicalComparisons: [
          "fixture restore",
          "only intentional edit",
          "process relaunch",
          "same-identity upgrade",
        ],
        journalMode: "wal",
        synchronization: "FULL",
        browserLibraryDatabases: [],
        offlineAssets: true,
      },
      null,
      2,
    ),
  );
  console.log(`Android native preservation passed. Evidence: ${evidence}`);
} finally {
  await detach();
  if (originalAirplaneMode !== "1")
    adb("shell", "cmd", "connectivity", "airplane-mode", "disable");
}

// Operator-driven native sign-in checks; never runs against a physical device.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { decodeLibraryBackup } from "../../../web/src/library-backup/codec.ts";

const [serial, method, output, slot, backupFile] = process.argv.slice(2);
assert(/^emulator-\d+$/.test(serial ?? "") &&
  ["status", "signIn", "verifySession", "signOut", "vaultList", "vaultPut", "vaultGet"].includes(method) && output,
  "Usage: node android-auth-proof.mjs emulator-N METHOD PRIVATE_EVIDENCE_FILE [SLOT [BACKUP_FILE]]");
const vault = method.startsWith("vault");
const options = vault ? { operation: method.slice(5).toLowerCase() } : {};
if (vault && method !== "vaultList") {
  assert(/^([0-2][0-9]|3[01])$/.test(slot ?? ""), "Expected proof slot 00–31");
  options.slot = slot;
}
if (method === "vaultPut") {
  assert(backupFile, "A validated synthetic whole-library backup file is required");
  options.text = await readFile(backupFile, "utf8");
  decodeLibraryBackup(options.text);
}
const adbPath = process.env.ADB ?? `${process.env.ANDROID_HOME}/platform-tools/adb`;
const appId = "io.github.andromedus1.cruxcontrol.prototype";
const adb = (...args) => execFileSync(adbPath, ["-s", serial, ...args], {
  encoding: "utf8", timeout: 30000,
}).trim();
assert.equal(adb("shell", "getprop", "ro.kernel.qemu"), "1", "Emulator required");
const evidence = resolve(output);
const repository = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
if (evidence.startsWith(`${repository}/`)) {
  execFileSync("git", ["check-ignore", "--quiet", evidence]);
}
const pid = adb("shell", "pidof", appId);
assert(/^\d+$/.test(pid), "Start AuthProofActivity first");
let socket;
const port = adb("forward", "tcp:0", `localabstract:webview_devtools_remote_${pid}`);
try {
  let target;
  for (let attempt = 0; attempt < 60 && !target; attempt += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`, {
        signal: AbortSignal.timeout(1000),
      })).json();
      target = targets.find(entry => entry.url === "https://localhost/");
    } catch { /* The WebView starts after the native activity. */ }
    if (!target) await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert(target, "Native app WebView missing");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let messageId = 0;
  const evaluate = (expression, timeoutMs) => new Promise((resolve, reject) => {
    const id = ++messageId;
    const timer = setTimeout(() => {
      socket.removeEventListener("message", onMessage);
      reject(new Error("Native auth proof timed out"));
    }, timeoutMs);
    function onMessage(event) {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      clearTimeout(timer);
      socket.removeEventListener("message", onMessage);
      if (message.error || message.result?.exceptionDetails) reject(new Error("Native bridge invocation failed"));
      else resolve(message.result.result.value);
    }
    socket.addEventListener("message", onMessage);
    socket.send(JSON.stringify({ id, method: "Runtime.evaluate", params: {
      expression, awaitPromise: true, returnByValue: true,
    } }));
  });
  // The WebView target can exist before Capacitor injects its native bridge.
  let bridgeReady = false;
  for (let attempt = 0; attempt < 60 && !bridgeReady; attempt += 1) {
    bridgeReady = await evaluate("typeof window.Capacitor?.nativePromise === 'function'", 5000);
    if (!bridgeReady) await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert(bridgeReady, "Native bridge did not finish starting");
  const result = await evaluate(
    `window.Capacitor.nativePromise('NativeAuthProof', ${JSON.stringify(vault ? "vaultRequest" : method)}, ${JSON.stringify(options)}).then(value => ({ok:true,value}), error => ({ok:false,code:error.code ?? 'UNKNOWN'}))`,
    10 * 60 * 1000,
  );
  await mkdir(dirname(evidence), { recursive: true, mode: 0o700 });
  await writeFile(evidence, JSON.stringify({ at: new Date().toISOString(), method, ...result }, null, 2) + "\n", { mode: 0o600 });
  const value = result.value;
  console.log(JSON.stringify({ method, ok: result.ok, code: result.code,
    signedIn: value?.signedIn,
    uidSha256: value?.uid ? createHash("sha256").update(value.uid).digest("hex") : undefined,
    issuedAt: value?.issuedAt, expiresAt: value?.expiresAt,
    httpStatus: value?.httpStatus,
    responseSha256: value?.responseText ? createHash("sha256").update(value.responseText).digest("hex") : undefined,
  }));
  if (!result.ok) process.exitCode = 1;
} finally {
  socket?.close();
  adb("forward", "--remove", `tcp:${port}`);
}

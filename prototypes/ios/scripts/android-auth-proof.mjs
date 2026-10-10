// Operator-driven native sign-in checks; never runs against a physical device.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const [serial, method, output] = process.argv.slice(2);
assert(/^emulator-\d+$/.test(serial ?? "") &&
  ["status", "signIn", "verifySession", "signOut"].includes(method) && output,
  "Usage: node android-auth-proof.mjs emulator-N status|signIn|verifySession|signOut PRIVATE_EVIDENCE_FILE");
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
  const response = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Native auth proof timed out")), 10 * 60 * 1000);
    socket.addEventListener("message", event => {
      const message = JSON.parse(event.data);
      if (message.id !== 1) return;
      clearTimeout(timer);
      if (message.error || message.result?.exceptionDetails) reject(new Error("Native bridge invocation failed"));
      else resolve(message.result.result.value);
    });
  });
  socket.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: {
    expression: `window.Capacitor.nativePromise('NativeAuthProof', ${JSON.stringify(method)}, {}).then(value => ({ok:true,value}), error => ({ok:false,code:error.code ?? 'UNKNOWN'}))`,
    awaitPromise: true, returnByValue: true,
  } }));
  const result = await response;
  await mkdir(dirname(evidence), { recursive: true, mode: 0o700 });
  await writeFile(evidence, JSON.stringify({ at: new Date().toISOString(), method, ...result }, null, 2) + "\n", { mode: 0o600 });
  const value = result.value;
  console.log(JSON.stringify({ method, ok: result.ok, code: result.code,
    signedIn: value?.signedIn,
    uidSha256: value?.uid ? createHash("sha256").update(value.uid).digest("hex") : undefined,
    issuedAt: value?.issuedAt, expiresAt: value?.expiresAt,
  }));
  if (!result.ok) process.exitCode = 1;
} finally {
  socket?.close();
  adb("forward", "--remove", `tcp:${port}`);
}

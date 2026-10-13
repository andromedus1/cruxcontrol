import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { decodeStoredDraft } from '../../../web/src/drafts/codec.ts';
import { decodeStoredPlaylist } from '../../../web/src/playlists/codec.ts';

export const appId = 'io.github.andromedus1.cruxcontrol.prototype';
export const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export async function catalogLibrarySnapshot(device) {
  // One read-only statement captures both authored tables coherently.
  const rows = await device.evaluate(`window.Capacitor.Plugins.CapacitorSQLite.query({ database: 'cruxcontrol-library', statement: "SELECT 'draft' AS kind, payload FROM climbs UNION ALL SELECT 'playlist' AS kind, payload FROM playlists", values: [], readonly: false }).then(result => result.values)`);
  return {
    drafts: rows.filter(row => row.kind === 'draft').map(row => decodeStoredDraft(JSON.parse(row.payload))),
    playlists: rows.filter(row => row.kind === 'playlist').map(row => decodeStoredPlaylist(JSON.parse(row.payload))),
  };
}

export async function verifyColdCatalogLists(device, library) {
  const playlist = library.playlists.find(row => row.entries.some(entry => entry.kind === 'provider'));
  assert.ok(playlist, 'Expected a synthetic playlist with a catalog reference');
  const index = playlist.entries.findIndex(entry => entry.kind === 'provider');
  await device.click('Lists', true);
  await device.click(playlist.name, true);
  const row = `document.querySelectorAll('.playlist-entries ol > li')[${index}]`;
  await device.waitFor(`${row}?.querySelector('.playlist-availability')?.innerText === 'Available'`, 'Cold Lists entry did not resolve its catalog provider');
  const name = await device.evaluate(`${row}.querySelector('strong').innerText`);
  await device.click('Play list');
  for (let position = 0; position < index; position += 1) await device.click('Next');
  await device.waitFor(`document.querySelector('.playlist-play-through')?.innerText.includes(${JSON.stringify(name)}) && !!document.querySelector('.playlist-play-through [aria-label="Board preview"]')`, 'Cold Lists provider did not play through');
  // Catalog text stays transient; result evidence contains provider identity only.
  return { reference: playlist.entries[index], position: index + 1 };
}

export function catalogDevice(serial) {
  assert.match(serial ?? '', /^emulator-\d+$/, 'Catalog smoke accepts an explicit emulator only');
  const adbPath = process.env.ADB ?? `${process.env.ANDROID_HOME}/platform-tools/adb`;
  const adbBytes = (...args) => execFileSync(adbPath, ['-s', serial, ...args], { timeout: 30000 });
  const adb = (...args) => adbBytes(...args).toString('utf8').trim();
  assert.equal(adb('shell', 'getprop', 'ro.kernel.qemu'), '1');
  let socket;
  let port;
  let sequence = 0;
  const pending = new Map();
  async function detach() {
    socket?.close(); socket = undefined;
    for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(new Error('WebView detached')); }
    pending.clear();
    if (port) { adb('forward', '--remove', `tcp:${port}`); port = undefined; }
  }
  async function attach() {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        const pid = adb('shell', 'pidof', appId);
        if (!/^\d+$/.test(pid)) throw new Error('App not running');
        port = adb('forward', 'tcp:0', `localabstract:webview_devtools_remote_${pid}`);
        const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) })).json();
        const target = targets.find(entry => entry.url === 'https://localhost/');
        if (!target) throw new Error('Bundled page not ready');
        socket = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
        socket.addEventListener('message', event => {
          const message = JSON.parse(event.data);
          if (message.id && pending.has(message.id)) {
            const { resolve, reject, timer } = pending.get(message.id);
            pending.delete(message.id); clearTimeout(timer);
            if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
          }
        });
        return;
      } catch {
        await detach(); await pause(250);
      }
    }
    throw new Error('Cannot attach to bundled Android WebView');
  }
  function cdp(method, params = {}) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  }
  async function waitFor(expression, label, attempts = 120) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (await evaluate(expression)) return;
      await pause(250);
    }
    throw new Error(`${label}\n${await evaluate('document.body.innerText')}`);
  }
  async function click(text, includes = false) {
    const name = `(button.getAttribute('aria-label') ?? button.innerText.trim())`;
    const match = includes ? `${name}.includes(${JSON.stringify(text)})` : `${name} === ${JSON.stringify(text)}`;
    const buttons = `[...document.querySelectorAll('button')].filter(button => !button.disabled && button.getClientRects().length && ${match})`;
    await waitFor(`${buttons}.length === 1`, `Expected one enabled button ${text}`);
    await evaluate(`${buttons}[0].click()`);
  }
  async function setValue(selector, value) {
    await evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element) throw new Error('Input not found'); Object.getOwnPropertyDescriptor(element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set.call(element, ${JSON.stringify(value)}); element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', {bubbles:true})); })()`);
  }
  async function start() {
    adb('shell', 'am', 'start', '-n', `${appId}/.MainActivity`);
    await attach();
    await waitFor("!!document.querySelector('nav[aria-label=\"Workspace destinations\"]')", 'Startup failed');
    assert.equal(await evaluate('window.Capacitor.getPlatform()'), 'android');
  }
  async function restart() { await detach(); adb('shell', 'am', 'force-stop', appId); await start(); }
  return { adb, adbBytes, evaluate, waitFor, click, setValue, start, restart, detach };
}

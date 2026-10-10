import assert from 'node:assert/strict';

export function androidUi(device) {
  function read() {
    try { device.adb('shell', 'uiautomator', 'dump', '/sdcard/window.xml'); } catch (cause) {
      if (!cause.stdout?.toString().includes('UI hierchary dumped to:')) throw cause;
    }
    const xml = device.adb('shell', 'cat', '/sdcard/window.xml');
    const nodes = [...xml.matchAll(/<node\b[^>]*>/g)].map(match => Object.fromEntries(
      [...match[0].matchAll(/([a-zA-Z0-9:_-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2].replaceAll('&amp;', '&')]),
    ));
    return { xml, nodes };
  }
  async function tap(matches, label, { long = false } = {}) {
    for (let attempt = 0; attempt < 15; attempt += 1) {
      const found = read().nodes.find(node => matches(node) && node.bounds && node.enabled !== 'false');
      if (found) {
        const bounds = found.bounds.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/);
        assert.ok(bounds, `Invalid bounds for ${label}`);
        const x = String(Math.floor((Number(bounds[1]) + Number(bounds[3])) / 2));
        const y = String(Math.floor((Number(bounds[2]) + Number(bounds[4])) / 2));
        if (long) device.adb('shell', 'input', 'swipe', x, y, x, y, '700');
        else device.adb('shell', 'input', 'tap', x, y);
        await new Promise(resolve => setTimeout(resolve, 400));
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error(`Android UI did not expose ${label}`);
  }
  return { read, tap };
}

export async function chooseDownloadedFile(device, filename) {
  const ui = androidUi(device);
  let state = ui.read();
  assert.ok(state.nodes.some(node => node.package === 'com.google.android.documentsui'), 'Expected the Android system document chooser');
  if (!state.nodes.some(node => node.text === filename)) {
    await ui.tap(node => /show roots|open navigation|navigation drawer/i.test(node['content-desc'] ?? ''), 'document locations');
    await ui.tap(node => node.text === 'Downloads' || node.text === 'Download', 'Downloads');
    state = ui.read();
  }
  assert.ok(state.nodes.some(node => node.text === filename), 'Expected supplied synthetic file in Downloads');
  await ui.tap(node => node.text === filename, 'supplied synthetic file');
  return state.xml;
}

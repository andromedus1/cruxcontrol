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
  let state = await waitForDocumentPicker(device);
  if (!state.nodes.some(node => node.text === filename)) {
    await ui.tap(node => /show roots|open navigation|navigation drawer/i.test(node['content-desc'] ?? ''), 'document locations');
    await ui.tap(node => node.text === 'Downloads' || node.text === 'Download', 'Downloads');
    state = ui.read();
  }
  assert.ok(state.nodes.some(node => node.text === filename), 'Expected supplied synthetic file in Downloads');
  await ui.tap(node => node.text === filename, 'supplied synthetic file');
  return state.xml;
}

export async function waitForDocumentPicker(device) {
  const ui = androidUi(device);
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const state = ui.read();
    if (state.nodes.some(node => node.package === 'com.google.android.documentsui')) return state;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Expected the actual Android system document chooser');
}

export async function tapWebFileInput(device, selector) {
  const point = await device.evaluate(`(async () => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element) throw new Error('File input unavailable'); element.scrollIntoView({block:'center'}); await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))); const rect = element.getBoundingClientRect(), viewport = visualViewport; return { x:(rect.x+Math.min(30,rect.width/2)-viewport.offsetLeft)*devicePixelRatio*viewport.scale, y:(rect.y+rect.height/2-viewport.offsetTop)*devicePixelRatio*viewport.scale, width:rect.width, height:rect.height }; })()`);
  assert.ok(point.width > 0 && point.height > 0, 'File input must be visible');
  const ui = androidUi(device), state = ui.read();
  const fileButtons = state.nodes.filter(node => node.class === 'android.widget.Button' && node.text === 'No file chosen');
  if (fileButtons.length === 1) {
    await ui.tap(node => node === fileButtons[0] || (node.class === 'android.widget.Button' && node.text === 'No file chosen'), 'native file input');
    return;
  }
  const webview = state.nodes.find(node => node.class === 'android.webkit.WebView');
  const bounds = webview?.bounds.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/);
  assert.ok(bounds, 'Expected native WebView bounds');
  // Real Android input event, including density and native content inset.
  device.adb('shell', 'input', 'tap', String(Math.round(point.x + Number(bounds[1]))), String(Math.round(point.y + Number(bounds[2]))));
  await new Promise(resolve => setTimeout(resolve, 500));
}

export async function chooseDownloadedImages(device, filenames) {
  assert.equal(filenames.length, 2, 'This bounded proof selects two fictional PNGs');
  const ui = androidUi(device);
  const picker = ui.read();
  if (picker.nodes.some(node => node.package === 'com.google.android.photopicker')) {
    // API36 routes GET_CONTENT images through Photo Picker. Its Browse option
    // is the real OS route to local files, without injecting a FileList.
    if (!picker.nodes.some(node => /^browse/i.test(node.text))) await ui.tap(node => node['content-desc'] === 'More', 'Photo Picker menu');
    await ui.tap(node => /^browse/i.test(node.text), 'Photo Picker Browse files');
  }
  const state = await waitForDocumentPicker(device);
  const fileNode = (node, filename) => node.text === filename || node['content-desc']?.startsWith(`${filename}, `);
  if (!state.nodes.some(node => fileNode(node, filenames[0]))) {
    await ui.tap(node => /show roots|open navigation|navigation drawer/i.test(node['content-desc'] ?? ''), 'document locations');
    await ui.tap(node => node.text === 'Downloads' || node.text === 'Download', 'Downloads');
  }
  await ui.tap(node => fileNode(node, filenames[0]), 'first fictional PNG', { long: true });
  await ui.tap(node => fileNode(node, filenames[1]), 'second fictional PNG');
  const selected = ui.read().xml;
  await ui.tap(node => /^(open|select)$/i.test(node.text || node['content-desc'] || ''), 'confirm selected PNGs');
  return selected;
}

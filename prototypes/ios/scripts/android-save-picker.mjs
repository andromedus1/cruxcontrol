function parseAttributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([a-zA-Z0-9:_-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]),
  );
}

function nodes(xml) {
  return [...xml.matchAll(/<node\b[^>]*>/g)].map((match) => parseAttributes(match[0]));
}

export function downloadNames(adb) {
  try {
    return new Set(adb("shell", "ls", "/sdcard/Download").split("\n").filter((name) => name.endsWith(".json")));
  } catch {
    return new Set();
  }
}

export function readDownload(adbBytes, filename) {
  if (!/^cruxcontrol-library-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z(?:-(?:[2-9]|[1-9][0-9]+))?\.json$/.test(filename)) {
    throw new Error("The selected Android backup has an unexpected filename");
  }
  return adbBytes("exec-out", "cat", `/sdcard/Download/${filename}`).toString("utf8");
}

export async function chooseDownloadsAndSave({ adb, pause }) {
  const readUi = () => {
    adb("shell", "uiautomator", "dump", "/sdcard/window.xml");
    return adb("shell", "cat", "/sdcard/window.xml");
  };
  const tap = async (matches, label) => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      let visible;
      try {
        visible = nodes(readUi()).find((node) => matches(node) && node.bounds);
      } catch {
        await pause(250);
        continue;
      }
      if (visible) {
        const bounds = visible.bounds.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/);
        if (!bounds) throw new Error(`Android picker node has invalid bounds: ${label}`);
        const x = Math.floor((Number(bounds[1]) + Number(bounds[3])) / 2);
        const y = Math.floor((Number(bounds[2]) + Number(bounds[4])) / 2);
        adb("shell", "input", "tap", String(x), String(y));
        await pause(400);
        return;
      }
      await pause(250);
    }
    throw new Error(`Could not find ${label} in the Android document picker`);
  };

  // ACTION_CREATE_DOCUMENT may reopen at the previous location or at Recents.
  // Navigate to Downloads so the proof can read the actual provider-written file.
  try {
    await tap(
      (node) => node.text === "Downloads" || node.text === "Download" || node["content-desc"] === "Downloads",
      "Downloads location",
    );
  } catch {
    await tap(
      (node) => /show roots|open navigation|navigation drawer/i.test(node["content-desc"] ?? ""),
      "document locations menu",
    );
    await tap(
      (node) => node.text === "Downloads" || node.text === "Download" || node["content-desc"] === "Downloads",
      "Downloads location",
    );
  }

  await tap(
    (node) => /^save$/i.test(node.text.trim()) || /^save$/i.test(node["content-desc"] ?? ""),
    "Save button",
  );
}

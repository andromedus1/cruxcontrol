import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@capacitor/app";
import { NativeBleByteTransport } from "./native-ble-transport.ts";
import { bindNativeLifecycle, createPrototypeRuntime } from "./runtime.ts";

const native = vi.hoisted(() => ({
  platform: vi.fn(() => "ios"),
  disableQueue: vi.fn(),
  initialize: vi.fn(),
  addListener: vi.fn(),
  writeFile: vi.fn(),
  rmdir: vi.fn(),
  share: vi.fn(),
  saveFile: vi.fn(),
  openLibrary: vi.fn(),
}));
vi.mock("./open-native-library.ts", () => ({
  openNativeLibrary: native.openLibrary,
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: native.platform },
}));
vi.mock("@capacitor-community/bluetooth-le", () => ({
  BleClient: {
    disableQueue: native.disableQueue,
    initialize: native.initialize,
  },
}));
vi.mock("@capacitor/app", () => ({ App: { addListener: native.addListener } }));
vi.mock("@capacitor/filesystem", () => ({
  Directory: { Cache: "CACHE" },
  Encoding: { UTF8: "utf8" },
  Filesystem: { writeFile: native.writeFile, rmdir: native.rmdir },
}));
vi.mock("@capacitor/share", () => ({ Share: { share: native.share } }));
vi.mock("./library-backup-file-plugin.ts", () => ({
  LibraryBackupFile: { save: native.saveFile },
}));

const callbacks = new Map<string, (...args: unknown[]) => void>();
const removals: ReturnType<typeof vi.fn>[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  native.platform.mockReturnValue("ios");
  callbacks.clear();
  removals.length = 0;
  native.addListener.mockImplementation(
    async (event: string, callback: (...args: unknown[]) => void) => {
      callbacks.set(event, callback);
      const remove = vi.fn().mockResolvedValue(undefined);
      removals.push(remove);
      return { remove };
    },
  );
  native.writeFile.mockResolvedValue({ uri: "file:///tmp/backup.json" });
  native.rmdir.mockResolvedValue(undefined);
  native.share.mockResolvedValue({ activityType: "" });
  native.saveFile.mockResolvedValue({ uri: "content://example/document/backup.json" });
});

describe("prototype runtime composition and lifetime", () => {
  it("uses only the Android native library, keeps plugins lazy, and closes once", async () => {
    native.platform.mockReturnValue("android");
    const library = {
      drafts: {},
      playlists: {},
      backupStore: {},
      close: vi.fn(),
    };
    native.openLibrary.mockResolvedValueOnce(library);
    const browserOpen = vi.spyOn(indexedDB, "open");
    const runtime = await createPrototypeRuntime();
    expect(native.openLibrary).toHaveBeenCalledOnce();
    expect(runtime.drafts).toBe(library.drafts);
    expect(runtime.playlists).toBe(library.playlists);
    expect(runtime.backupDelivery?.kind).toBe("save");
    expect(runtime.playlistSharing?.baseUrl).toBeNull();
    expect(runtime.playlistSharing?.deliverFile.kind).toBe("save");
    expect(native.initialize).not.toHaveBeenCalled();
    expect(native.saveFile).not.toHaveBeenCalled();
    expect(browserOpen).not.toHaveBeenCalled();
    runtime.close();
    runtime.close();
    expect(library.close).toHaveBeenCalledOnce();
    browserOpen.mockRestore();
  });

  it("retains only failed LibraryBackupFile save results from Android app restoration", async () => {
    native.platform.mockReturnValue("android");
    native.openLibrary.mockResolvedValueOnce({ drafts: {}, playlists: {}, backupStore: {}, close: vi.fn() });
    const runtime = await createPrototypeRuntime();
    const notice = runtime.restoredFileSaveFailure;
    expect(notice).toBeDefined();
    const listener = vi.fn();
    const unsubscribe = notice!.subscribe(listener);
    const restored = callbacks.get("appRestoredResult")!;

    restored({ pluginId: "Camera", methodName: "save", success: false, error: { message: "ignored" } });
    restored({ pluginId: "LibraryBackupFile", methodName: "other", success: false, error: { message: "ignored" } });
    restored({ pluginId: "LibraryBackupFile", methodName: "save", success: true });
    expect(listener).not.toHaveBeenCalled();
    expect(notice!.take()).toBeNull();

    const failure = "The file save was interrupted. Your library is unchanged; an empty or partial file may remain in the chosen location. Please try saving again.";
    restored({ pluginId: "LibraryBackupFile", methodName: "save", success: false, error: { message: failure } });
    expect(listener).toHaveBeenCalledOnce();
    expect(notice!.take()).toBe(failure);
    expect(notice!.take()).toBeNull();
    unsubscribe();
    runtime.close();
    expect([...callbacks.keys()]).toEqual(["pause", "resume", "appRestoredResult", "backButton"]);
    for (const remove of removals) expect(remove).toHaveBeenCalledOnce();
  });

  it("propagates Android native storage failure and disposes lifecycle without browser fallback", async () => {
    native.platform.mockReturnValue("android");
    const error = new Error("native disk failed");
    native.openLibrary.mockRejectedValueOnce(error);
    const browserOpen = vi.spyOn(indexedDB, "open");
    await expect(createPrototypeRuntime()).rejects.toBe(error);
    expect(browserOpen).not.toHaveBeenCalled();
    for (const remove of removals) expect(remove).toHaveBeenCalledOnce();
    browserOpen.mockRestore();
  });
  it("opens the real library without initializing Bluetooth and releases native listeners on close", async () => {
    const runtime = await createPrototypeRuntime();
    expect(runtime.controller?.getState().transport.status).toBe(
      "disconnected",
    );
    expect(runtime.backup).toBeDefined();
    expect(runtime.backupDelivery?.kind).toBe("share");
    expect(native.disableQueue).toHaveBeenCalledOnce();
    expect(native.initialize).not.toHaveBeenCalled();
    expect(native.writeFile).not.toHaveBeenCalled();
    expect(native.rmdir).not.toHaveBeenCalled();
    expect(native.share).not.toHaveBeenCalled();
    expect(native.saveFile).not.toHaveBeenCalled();
    expect([...callbacks.keys()]).toEqual(["pause", "resume"]);
    runtime.close();
    for (const remove of removals) expect(remove).toHaveBeenCalledOnce();
  });

  it("uses unsupported native capability for browser inspection without initializing plugins", async () => {
    native.platform.mockReturnValue("web");
    const runtime = await createPrototypeRuntime();
    expect(runtime.controller?.getState().transport.status).toBe("unsupported");
    expect(runtime.backupDelivery?.kind).toBe("download");
    expect(native.disableQueue).not.toHaveBeenCalled();
    expect(native.initialize).not.toHaveBeenCalled();
    expect(native.writeFile).not.toHaveBeenCalled();
    expect(native.rmdir).not.toHaveBeenCalled();
    expect(native.share).not.toHaveBeenCalled();
    expect(native.saveFile).not.toHaveBeenCalled();
    expect(native.addListener).not.toHaveBeenCalled();
    runtime.close();
  });

  it("forwards only background/foreground events and ignores callbacks after disposal", async () => {
    const transport = new NativeBleByteTransport(null);
    const foreground = vi.spyOn(transport, "setForeground");
    const dispose = await bindNativeLifecycle(transport, App);
    expect(foreground).not.toHaveBeenCalled();
    callbacks.get("pause")!();
    callbacks.get("resume")!();
    expect(foreground.mock.calls).toEqual([[false], [true]]);
    // Failed asynchronous listener removal must not revive a closed runtime.
    removals[0]!.mockRejectedValueOnce(new Error("listener removal failed"));
    dispose();
    callbacks.get("resume")!();
    expect(foreground.mock.calls).toEqual([[false], [true], [false]]);
    await Promise.resolve();
  });

  it("cleans up partial registration while preserving its original failure", async () => {
    const transport = new NativeBleByteTransport(null);
    const foreground = vi.spyOn(transport, "setForeground");
    const remove = vi.fn().mockRejectedValue(new Error("cleanup failed"));
    const failure = new Error("resume registration failed");
    native.addListener
      .mockResolvedValueOnce({ remove })
      .mockRejectedValueOnce(failure);
    await expect(bindNativeLifecycle(transport, App)).rejects.toBe(failure);
    expect(remove).toHaveBeenCalledOnce();
    expect(foreground).toHaveBeenCalledWith(false);
  });
});

import { Capacitor } from "@capacitor/core";
import { BleClient } from "@capacitor-community/bluetooth-le";
import { App, type AppPlugin, type RestoredListenerEvent } from "@capacitor/app";
import { Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type { PluginListenerHandle } from "@capacitor/core";
import { createCruxControlRuntime } from "../../../web/src/app/create-runtime.ts";
import {
  activeInstallationId,
  createAppInstallationRegistry,
} from "../../../web/src/app/installations.ts";
import { NativeBleByteTransport } from "./native-ble-transport.ts";
import { createAndroidBackupDelivery } from "./android-backup-delivery.ts";
import { LibraryBackupFile } from "./library-backup-file-plugin.ts";
import { createNativeBackupDelivery } from "./native-backup-delivery.ts";
import { openNativeLibrary } from "./open-native-library.ts";
import { createNativePlaylistDelivery } from "./native-playlist-delivery.ts";
import { createBackNavigation } from "../../../web/src/app/back-navigation.ts";
import { bindAndroidBack } from "./native-back-navigation.ts";

const interruptedFileSaveMessage =
  "The file save was interrupted. Your library is unchanged; an empty or partial file may remain in the chosen location. Please try saving again.";

function createRestoredFileSaveFailureNotice() {
  let message: string | null = null;
  const listeners = new Set<() => void>();
  return {
    notice: {
      subscribe(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      take() {
        const current = message;
        message = null;
        return current;
      },
    },
    publish(event: RestoredListenerEvent) {
      if (
        event.pluginId !== "LibraryBackupFile" ||
        event.methodName !== "save" ||
        event.success
      ) return;
      message = event.error?.message || interruptedFileSaveMessage;
      for (const listener of [...listeners]) listener();
    },
  };
}

export async function bindNativeLifecycle(
  transport: NativeBleByteTransport,
  app: Pick<AppPlugin, "addListener">,
  onRestoredFileSaveFailure?: (event: RestoredListenerEvent) => void,
): Promise<() => void> {
  const handles: PluginListenerHandle[] = [];
  let disposed = false;
  const removeListeners = () =>
    Promise.allSettled(handles.map((handle) => handle.remove()));
  try {
    handles.push(
      await app.addListener("pause", () => {
        if (!disposed) transport.setForeground(false);
      }),
    );
    handles.push(
      await app.addListener("resume", () => {
        if (!disposed) transport.setForeground(true);
      }),
    );
    if (onRestoredFileSaveFailure) {
      handles.push(
        await app.addListener("appRestoredResult", (event) => {
          if (!disposed) onRestoredFileSaveFailure(event);
        }),
      );
    }
  } catch (cause) {
    disposed = true;
    transport.setForeground(false);
    await removeListeners();
    throw cause;
  }
  return () => {
    disposed = true;
    transport.setForeground(false);
    void removeListeners();
  };
}

export async function createPrototypeRuntime() {
  const platform = Capacitor.getPlatform();
  const native = platform === "ios" || platform === "android";
  const restoredFileSaveFailure = platform === "android"
    ? createRestoredFileSaveFailureNotice()
    : undefined;
  if (native) BleClient.disableQueue(); // adapter owns FIFO; emergency disconnect bypasses it
  const transport = new NativeBleByteTransport(native ? BleClient : null);
  const dispose = native
    ? await bindNativeLifecycle(transport, App, restoredFileSaveFailure?.publish)
    : () => transport.forceDisconnect();
  const backNavigation = platform === "android" ? createBackNavigation() : undefined;
  let disposeBack = () => {};
  try {
    if (backNavigation) disposeBack = await bindAndroidBack(backNavigation, App);
    const runtime = await createCruxControlRuntime({
      backNavigation,
      ...(platform === "android" ? { openLibrary: openNativeLibrary } : {}),
      ...(restoredFileSaveFailure
        ? { restoredFileSaveFailure: restoredFileSaveFailure.notice }
        : {}),
      getInstallation: () =>
        createAppInstallationRegistry({
          createTransport: () => transport,
        }).require(activeInstallationId),
      ...(platform === "android"
        ? {
            backupDelivery: createAndroidBackupDelivery({ filePicker: LibraryBackupFile }),
            playlistSharing: { baseUrl: null, deliverFile: createNativePlaylistDelivery({ filePicker: LibraryBackupFile }) },
          }
        : platform === "ios"
          ? {
              backupDelivery: createNativeBackupDelivery({
                filesystem: Filesystem,
                share: Share,
              }),
            }
          : {}),
    });
    let closed = false;
    return {
      ...runtime,
      close: () => {
        if (closed) return;
        closed = true;
        dispose();
        disposeBack();
        runtime.close();
      },
    };
  } catch (cause) {
    dispose();
    disposeBack();
    throw cause;
  }
}

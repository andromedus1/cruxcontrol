import { Capacitor } from "@capacitor/core";
import { BleClient } from "@capacitor-community/bluetooth-le";
import { App, type AppPlugin } from "@capacitor/app";
import { Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type { PluginListenerHandle } from "@capacitor/core";
import { createCruxControlRuntime } from "../../../web/src/app/create-runtime.ts";
import {
  activeInstallationId,
  createAppInstallationRegistry,
} from "../../../web/src/app/installations.ts";
import { NativeBleByteTransport } from "./native-ble-transport.ts";
import { createNativeBackupDelivery } from "./native-backup-delivery.ts";
import { openNativeLibrary } from "./open-native-library.ts";

export async function bindNativeLifecycle(
  transport: NativeBleByteTransport,
  app: Pick<AppPlugin, "addListener">,
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
  if (native) BleClient.disableQueue(); // adapter owns FIFO; emergency disconnect bypasses it
  const transport = new NativeBleByteTransport(native ? BleClient : null);
  const dispose = native
    ? await bindNativeLifecycle(transport, App)
    : () => transport.forceDisconnect();
  try {
    const runtime = await createCruxControlRuntime({
      ...(platform === "android" ? { openLibrary: openNativeLibrary } : {}),
      getInstallation: () =>
        createAppInstallationRegistry({
          createTransport: () => transport,
        }).require(activeInstallationId),
      ...(native
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
        runtime.close();
      },
    };
  } catch (cause) {
    dispose();
    throw cause;
  }
}

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
import { createAutomaticBackup } from "../../../web/src/automatic-backup/coordinator.ts";
import type { AutomaticBackup } from "../../../web/src/automatic-backup/coordinator.ts";
import { createNativePrivateVault } from "./native-private-vault.ts";
import { createNativePrivateCatalog } from "./native-private-catalog.ts";
import type { CatalogService } from "../../../web/src/catalog/service.ts";

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
  automaticBackup?: Pick<AutomaticBackup, "setForeground" | "retry">,
  catalog?: Pick<CatalogService, "checkForUpdate">,
): Promise<() => void> {
  const handles: PluginListenerHandle[] = [];
  let disposed = false;
  const removeListeners = () =>
    Promise.allSettled(handles.map((handle) => handle.remove()));
  try {
    handles.push(
      await app.addListener("pause", () => {
        if (!disposed) {
          transport.setForeground(false);
          automaticBackup?.setForeground(false);
        }
      }),
    );
    handles.push(
      await app.addListener("resume", () => {
        if (!disposed) {
          transport.setForeground(true);
          automaticBackup?.setForeground(true);
          // Cadence-gated (3.5 days); a catalog that was never opened stays unopened.
          void catalog?.checkForUpdate().catch(() => undefined);
        }
      }),
    );
    if (onRestoredFileSaveFailure) {
      handles.push(
        await app.addListener("appRestoredResult", (event) => {
          if (!disposed) onRestoredFileSaveFailure(event);
        }),
      );
    }
    if (automaticBackup && typeof window !== "undefined") {
      const online = () => { void automaticBackup.retry(); };
      const offline = () => { void automaticBackup.retry(); };
      window.addEventListener("online", online);
      window.addEventListener("offline", offline);
      handles.push({
        remove: async () => {
          window.removeEventListener("online", online);
          window.removeEventListener("offline", offline);
        },
      });
    }
  } catch (cause) {
    disposed = true;
    transport.setForeground(false);
    automaticBackup?.setForeground(false);
    await removeListeners();
    throw cause;
  }
  return () => {
    disposed = true;
    transport.setForeground(false);
    automaticBackup?.setForeground(false);
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
  const backNavigation = platform === "android" ? createBackNavigation() : undefined;
  let disposeLifecycle = () => {};
  let disposeBack = () => {};
  let createdRuntime: Awaited<ReturnType<typeof createCruxControlRuntime>> | null = null;
  try {
    const runtime = await createCruxControlRuntime({
      backNavigation,
      ...(platform === "android" ? { openLibrary: openNativeLibrary } : {}),
      // Signed-in catalog updates use the native Firebase session; iOS and web stay unconfigured.
      ...(platform === "android" ? { catalogUpdates: createNativePrivateCatalog() } : {}),
      ...(platform === "android" ? {
        createAutomaticBackup: ({ preservation, backupService }) => createAutomaticBackup({
          preservation,
          backupService,
          vault: createNativePrivateVault(),
        }),
      } : {}),
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
    createdRuntime = runtime;
    if (native) {
      disposeLifecycle = await bindNativeLifecycle(
        transport, App, restoredFileSaveFailure?.publish, runtime.automaticBackup,
        platform === "android" ? runtime.catalog : undefined,
      );
    }
    if (backNavigation) disposeBack = await bindAndroidBack(backNavigation, App);
    let closed = false;
    return {
      ...runtime,
      close: () => {
        if (closed) return;
        closed = true;
        disposeLifecycle();
        disposeBack();
        runtime.close();
      },
    };
  } catch (cause) {
    disposeLifecycle();
    disposeBack();
    createdRuntime?.close();
    if (!native) transport.forceDisconnect();
    throw cause;
  }
}

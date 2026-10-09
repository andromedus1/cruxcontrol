/**
 * Capability detection for the OPFS sync-access-handle path.
 *
 * The main thread checks for OPFS root access and Web Locks before spawning a
 * Worker. Sync-access-handle capability is checked inside that Worker, where
 * the browser exposes the worker-only API.
 */

/**
 * True only when the environment can run the OPFS sync-access-handle VFS.
 *
 * Checks the main-thread prerequisites. This deliberately does not probe
 * `createSyncAccessHandle`, whose exposure is worker-specific.
 *
 * Returns `false` under jsdom/Node (no OPFS) and on browsers lacking sync
 * access handles (e.g. older Safari/Firefox) — callers fail fast with a clear
 * unsupported-environment error rather than crashing inside the Worker.
 */
export function isOpfsSyncAccessSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.storage?.getDirectory === 'function' &&
    typeof navigator.locks?.request === 'function'
  );
}

/** True only when the OPFS synchronous access-handle API exists in a Worker. */
export function isWorkerOpfsSyncAccessSupported(): boolean {
  return typeof navigator !== 'undefined'
    && typeof navigator.storage?.getDirectory === 'function'
    && typeof FileSystemFileHandle !== 'undefined'
    && typeof FileSystemFileHandle.prototype?.createSyncAccessHandle === 'function';
}

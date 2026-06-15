/**
 * Capability detection for the OPFS sync-access-handle path.
 *
 * The browser catalog read path runs wa-sqlite over an OPFS VFS that depends on
 * `FileSystemSyncAccessHandle` (synchronous OPFS handles), which are only
 * *callable* inside a dedicated Worker — but their presence is detectable from
 * the main thread, which is enough for a pre-flight gate before spawning the
 * Worker.
 */

/**
 * True only when the environment can run the OPFS sync-access-handle VFS.
 *
 * Checks for `navigator.storage.getDirectory` (OPFS root access) and
 * `FileSystemFileHandle.prototype.createSyncAccessHandle` (synchronous access
 * handles). Pure and synchronous with no side effects.
 *
 * Returns `false` under jsdom/Node (no OPFS) and on browsers lacking sync
 * access handles (e.g. older Safari/Firefox) — callers fail fast with a clear
 * unsupported-environment error rather than crashing inside the Worker.
 */
export function isOpfsSyncAccessSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.storage?.getDirectory === 'function' &&
    typeof FileSystemFileHandle !== 'undefined' &&
    typeof FileSystemFileHandle.prototype?.createSyncAccessHandle === 'function'
  );
}

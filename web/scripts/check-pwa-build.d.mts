/**
 * Validate the PWA build artifacts and app-reachable catalog worker/WASM in
 * `distDir`. Throws on the first failed prerequisite (or if the build
 * directory is missing).
 * See `check-pwa-build.mjs` for the authoritative implementation.
 */
export function checkPwaBuild(distDir?: string): {
  iconCount: number;
  precacheReferencesDb: boolean;
  precacheReferencesPrivateArtwork: boolean;
  catalogWorkerAsset: string;
  catalogWasmAsset: string;
};

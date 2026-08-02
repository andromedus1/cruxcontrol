/**
 * Validate the PWA build artifacts in `distDir`. Throws on the first failed
 * installability prerequisite (or if the build directory is missing).
 * See `check-pwa-build.mjs` for the authoritative implementation.
 */
export function checkPwaBuild(distDir?: string): {
  iconCount: number;
  precacheReferencesDb: boolean;
  precacheReferencesPrivateArtwork: boolean;
};

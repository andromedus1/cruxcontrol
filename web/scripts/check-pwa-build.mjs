// PWA build-artifact assertion.
//
// Lighthouse is NOT run in CI, so instead of faking a Lighthouse "installable"
// pass we assert the concrete installability PREREQUISITES against a real
// production build:
//   1. dist/manifest.webmanifest exists and declares name/start_url/icons.
//   2. The declared icon files exist in dist/.
//   3. A generated service worker (dist/sw.js) exists.
//   4. The SW precache manifest EXCLUDES the catalog DB (*.db / *.db.gz) — the
//      multi-MB DB lives in OPFS, never in the SW cache.
//
// Run after `vite build`:  node scripts/check-pwa-build.mjs
// (The companion vitest at src/pwa/check-pwa-build.test.ts runs this same
// `checkPwaBuild` against an existing dist/ so it is exercised in CI.)
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIST = join(__dirname, '..', 'dist');

/**
 * Validate the PWA build artifacts in `distDir`. Returns nothing on success;
 * throws an Error describing the first failed prerequisite. Throws a distinct
 * "build not found" error if `distDir` is absent so callers can tell the
 * difference between "not built" and "built but broken".
 */
export function checkPwaBuild(distDir = DEFAULT_DIST) {
  if (!existsSync(distDir)) {
    throw new Error(
      `PWA build check: ${distDir} not found. Run \`npm run build -w @cruxcontrol/web\` first.`,
    );
  }

  // 1. Manifest exists and is well-formed.
  const manifestPath = join(distDir, 'manifest.webmanifest');
  if (!existsSync(manifestPath)) {
    throw new Error('PWA build check: dist/manifest.webmanifest is missing.');
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!manifest.name) {
    throw new Error('PWA build check: manifest is missing `name`.');
  }
  if (!manifest.start_url) {
    throw new Error('PWA build check: manifest is missing `start_url`.');
  }
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    throw new Error('PWA build check: manifest declares no icons.');
  }
  const hasMaskable = manifest.icons.some((icon) =>
    /(^|\s)maskable(\s|$)/.test(icon.purpose ?? ''),
  );
  if (!hasMaskable) {
    throw new Error('PWA build check: manifest has no maskable icon.');
  }

  // 2. Every declared icon file exists in dist/.
  for (const icon of manifest.icons) {
    const iconPath = join(distDir, icon.src);
    if (!existsSync(iconPath)) {
      throw new Error(`PWA build check: manifest icon "${icon.src}" not found in dist/.`);
    }
  }

  // 3. The generated service worker exists.
  const swPath = join(distDir, 'sw.js');
  if (!existsSync(swPath)) {
    throw new Error('PWA build check: dist/sw.js (generated service worker) is missing.');
  }

  // 4. The SW precache manifest must NOT reference any catalog DB. The DB lives
  //    in OPFS; precaching a multi-MB file in the SW would be wrong. There is
  //    no .db in the build yet, but this guard protects against a future
  //    Workbox glob regression once catalog-bootstrap ships the DB.
  const sw = readFileSync(swPath, 'utf8');
  const dbMatch = sw.match(/["'][^"']*\.db(\.gz)?["']/);
  if (dbMatch) {
    throw new Error(
      `PWA build check: service worker precache references a catalog DB (${dbMatch[0]}); it must never be precached.`,
    );
  }

  return {
    iconCount: manifest.icons.length,
    precacheReferencesDb: false,
  };
}

// When run directly (not imported), execute the check and report.
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = checkPwaBuild();
    console.log(
      `PWA build check passed: manifest + ${result.iconCount} icons + sw.js present, no .db precached.`,
    );
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { checkPwaBuild } from '../../scripts/check-pwa-build.mjs';

// Build-artifact assertion for the PWA shell. Lighthouse is not run in CI, so
// rather than fake an "installable" pass we assert the concrete installability
// prerequisites against a REAL production build: manifest + icons + generated
// service worker, and that the SW precache never includes the catalog *.db.
//
// We build into a throwaway dist dir if a production build is not already
// present, so the assertion is genuinely exercised in CI (not skipped). The
// build is slow, hence the extended timeout.
const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(__dirname, '..', '..');
const DIST = join(WEB_ROOT, 'dist');

describe('PWA build artifacts', () => {
  beforeAll(() => {
    if (!existsSync(join(DIST, 'sw.js'))) {
      // Produce the artifacts the check needs. `vite build` alone (skip the
      // typecheck step that `npm run build` prepends — typecheck is its own
      // gate and would double the cost here).
      execFileSync('npx', ['vite', 'build'], { cwd: WEB_ROOT, stdio: 'inherit' });
    }
  }, 120_000);

  it('emits manifest + icons + sw.js and never precaches a catalog .db', () => {
    const result = checkPwaBuild(DIST);
    expect(result.precacheReferencesDb).toBe(false);
    expect(result.iconCount).toBeGreaterThanOrEqual(3);
  });
});

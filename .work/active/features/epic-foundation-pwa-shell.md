---
id: epic-foundation-pwa-shell
kind: feature
stage: implementing
tags: []
parent: epic-foundation
depends_on: [epic-foundation-scaffold]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-14
---

# Offline-First PWA Shell

## Brief

Make the app an installable, offline-first PWA. After this feature the app shell loads
instantly offline and can be installed to the home screen / desktop.

Covers: `vite-plugin-pwa` (Workbox) setup, the web app manifest (name, icons, `start_url`,
`display: standalone`, theme/background), a service worker that precaches the app shell
(cache-first, versioned) and uses network-first for any API calls, an install prompt hook
(`beforeinstallprompt`) with a manual-instructions fallback, and a Lighthouse-installability
check. Explicitly does NOT route the multi-MB `kilter.db` through the SW cache — that lives
in OPFS (catalog-bootstrap). Independent of the SQLite read path; can be built in parallel.

## Epic context
- Parent epic: `epic-foundation`
- Position: independent capability — depends only on the scaffold; parallel to sqlite-readpath and ci-deploy.

## Inherited design decisions
- `vite-plugin-pwa` for manifest + service worker.
- Do NOT cache `kilter.db` in the service worker (OPFS owns it).
- Offline-first: app shell works with no network.

## Research briefs
- [foundation-pwa-sqlite.md](../../../docs/briefs/foundation-pwa-sqlite.md) — §4 (PWA + hosting strategy).

## Foundation references
- `docs/ARCHITECTURE.md` — Conventions (offline-first; static backendless distribution).
- `docs/SPEC.md` — Constraints (Distributable PWA, offline-first).

## Design decisions

Captured during `feature-design --only-questions` (2026-06-14):

1. **Service-worker updates = auto-update (silent).** Use vite-plugin-pwa
   `registerType: 'autoUpdate'`; a new SW activates and the app picks up the new
   version on next load, with no reload prompt. Friend-friendly and needs no UI
   (the design system doesn't exist until `epic-climb-browser`). Accepted tradeoff:
   a user mid-session keeps the old version until they reload.

## Architectural choice

Use **`vite-plugin-pwa`** (Workbox under the hood) in `generateSW` mode with
`registerType: 'autoUpdate'` — the inherited decision. generateSW (vs injectManifest)
because we have no custom service-worker logic yet; Workbox's generated SW precaches the
built app shell and that's all this feature needs. The catalog DB is deliberately kept
OUT of Workbox: it lives in OPFS (readpath/catalog-bootstrap), so we scope
`globPatterns` to shell assets and add a `navigateFallbackDenylist` / runtime rule so the
snapshot fetch is never SW-cached. Registration uses the plugin's `virtual:pwa-register`
module (auto-update variant) called once at app entry.

## Implementation Units

### Unit 1: PWA plugin + manifest config
**File**: `web/vite.config.ts` (extend; already has `worker: {format:'es'}` from readpath)
```ts
// add VitePWA({ registerType: 'autoUpdate', manifest, workbox }) to plugins
// manifest: name 'CruxControl', short_name 'CruxControl', description,
//   start_url '/', scope '/', display 'standalone',
//   theme_color + background_color, icons [192, 512, 512-maskable]
// workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'],  // NOT *.db / *.wasm-as-data
//   navigateFallback: 'index.html', cleanupOutdatedCaches: true }
// devOptions: { enabled: false }  // keep dev simple
```
**Notes**: do NOT add the catalog snapshot glob; `kilter.db`/`.gz` must never precache.
The wa-sqlite `.wasm` is a worker chunk asset — fine to precache as a static asset (it's
small, ~ tens of KB), but confirm it isn't double-handled. Keep `globIgnores` for any
`*.db`/`*.db.gz`.
**Acceptance**:
- [ ] `npm run build -w @cruxcontrol/web` emits `dist/sw.js` (or `dist/service-worker.js`) and `dist/manifest.webmanifest`.
- [ ] The generated SW precache manifest contains the app-shell JS/CSS/HTML and does NOT list any `*.db`/`*.db.gz`.

### Unit 2: Placeholder app icons
**Files**: `web/public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `web/public/favicon.svg`
**Notes**: brand/design system lands at `epic-climb-browser` — these are PLACEHOLDERS (a
simple solid-background "CC" glyph). Generate deterministically (e.g. a small Node/script
using a minimal PNG encoder, or commit hand-made minimal PNGs). They must be valid PNGs at
the declared sizes so installability passes. Note "placeholder — replace at climb-browser"
in the file/dir.
**Acceptance**:
- [ ] Three PNG icons exist at the declared sizes and are referenced by the manifest.

### Unit 3: SW registration + install affordance
**Files**: `web/src/pwa/register-sw.ts`, `web/src/pwa/use-install-prompt.ts`, wire into `web/src/main.tsx`
```ts
// register-sw.ts: import { registerSW } from 'virtual:pwa-register';
//   export function registerServiceWorker() { registerSW({ immediate: true }); }
// use-install-prompt.ts: React hook capturing 'beforeinstallprompt'
//   export function useInstallPrompt(): { canInstall: boolean; promptInstall: () => Promise<void>; }
//   — stashes the deferred event, exposes canInstall, calls .prompt() on demand.
```
**Notes**: `virtual:pwa-register` needs the `vite-plugin-pwa/client` types in
`web/src/vite-env.d.ts` (add the triple-slash reference). The install hook has a
manual-instructions fallback when `beforeinstallprompt` never fires (iOS/desktop Safari):
expose `canInstall=false` and let the (future) UI show manual steps. App entry calls
`registerServiceWorker()`; App may render a minimal "Install" button when `canInstall`.
**Acceptance**:
- [ ] `registerServiceWorker()` is called once at app entry.
- [ ] `useInstallPrompt` returns `canInstall:true` after a synthesized `beforeinstallprompt` and `false` before (unit-tested with a mocked event).

## Implementation Order
1. Unit 1 (plugin/manifest) — the core; verifies build emits SW+manifest.
2. Unit 2 (icons) — needed for a valid installable manifest.
3. Unit 3 (registration + install hook) — wires it into the app.

## Testing
- `web/src/pwa/use-install-prompt.test.ts` — hook returns canInstall false→true on a
  mocked `beforeinstallprompt`; `promptInstall` calls the deferred event's `.prompt()`.
- **Build-artifact assertion** (vitest or a small script): after `vite build`, assert
  `dist/manifest.webmanifest` exists and the generated SW precache list excludes `*.db`.
  (Lighthouse itself isn't run in CI — assert the installability prerequisites instead:
  manifest + icons + SW. Note this explicitly; don't fake a Lighthouse pass.)
- Existing tests stay green.

## Risks
- **Icon generation** without a design system — **Fallback**: minimal generated placeholder
  PNGs; replace at `epic-climb-browser`. Don't block installability on real branding.
- **`virtual:pwa-register` typing** in tests/build — **Fallback**: add the client types
  ref; mock the virtual module in unit tests so they don't need a real SW.
- **Workbox accidentally precaching large assets** — **Fallback**: explicit `globPatterns`
  allowlist + `globIgnores` for `*.db*`; assert in the build test.

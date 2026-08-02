# CruxControl

## In plain terms

A **Kilter Board** is an interactive climbing wall: a grid of plastic holds with LEDs
behind them. You pick a climb, the right holds light up, and you try to get to the top
using only those holds. Normally you drive the board with Kilter's official phone app.

That app is slow, hard to get your data out of, and not very smart. **CruxControl is a
replacement for it** — a web app (it runs in your browser, nothing to install from an
app store) that talks to a home Kilter Board over Bluetooth.

The completed first local milestone can:

- **Create and edit climbs in any state**, including empty or unconventional routes,
  and autosave them in this browser.
- **Show all 305 controllable Fullride holds** in an accessible, responsive board
  diagram with the four normal climb roles or any of the board's 256 light colors.
- **Light or clear the wall from Android or desktop Chromium** through the browser's
  Web Bluetooth support, with an optional live preview while setting.

Community-catalog browsing and sharing, a local logbook, ML grade prediction, and
personalized training remain later milestones.

It's built for one specific board — a home **Kilter Board Fullride 7x10** — and shared
with a small circle of friends. Each person runs their own copy against their own board,
with their own local data. There's no central server, no accounts, and no sign-up.

For the full picture, see [docs/VISION.md](docs/VISION.md).

---

## For developers

A distributable, offline-first, installable **PWA** that replaces the official Kilter
app and adds intelligence (ML grade prediction, personalized training). Client-only —
no backend, no accounts; each user runs their own client with local data.

### Layout (monorepo)

```
/web      — TypeScript PWA (React + Vite). The client app. The only deployed artifact.
/ml       — Python ML training pipeline (grade prediction). Exports artifacts to /web/public.
/docs     — foundation docs (VISION/SPEC/ARCHITECTURE), research briefs, knowledge index.
/.research— research corpus: domain briefs + source attestations (the citation chain).
/.work    — agile-workflow substrate (epics/features/stories). Source of truth for work.
/.github  — CI workflow (lint/typecheck/test/build + gated Cloudflare Workers deploy).
```

`/web` is an npm workspace; `/ml` is a standalone Python project (not an npm workspace).

### Develop (web)

```bash
npm install          # installs the web workspace
npm run dev          # vite dev server
npm run build        # static production build → web/dist
npm test             # vitest contract and integration suite
npm run typecheck    # tsc --noEmit (strict)
npm run lint         # eslint
npm run format       # prettier --write
npm -w web run test:e2e  # Playwright Chromium smoke tests (build first)
```

Requires Node ≥ 20 (see `.nvmrc`). Run scripts from the repo root with
`-w @cruxcontrol/web`, or from inside `web/`.

### Architecture highlights (foundation)

- **Immutable Fullride board domain** — a reproducible catalog projection generates
  the validated Fullride 7x10 definition: 305 controllable placements, geometry,
  source identities, LED positions, supported angles, and semantic role presets.
- **Independently authored schematic SVG renderer** — definition-driven hold artwork,
  role shapes, custom colors, pan/scale behavior, and roving keyboard interaction are
  shared by the climb viewer and route editor.
- **Local drafts and editor** — unrestricted, schema-versioned drafts live in a
  dedicated native IndexedDB store with optimistic revisions. The responsive editor
  supports semantic roles, all 256 packed 3/3/2-bit colors, coalesced autosave,
  reload/retry/save-copy recovery, explicit lighting, and opt-in live preview.
- **Board control** — the API-level-3 codec, Web Bluetooth session, and light-scene
  controller are isolated behind typed ports and covered with deterministic transport
  fakes. A powered-board Android Chrome verification is still required.
- **Local catalog read path** — the Kilter catalog is an in-browser SQLite database
  (`wa-sqlite`, `AccessHandlePoolVFS`) running in a Web Worker, behind the `CatalogPort`
  interface ([web/src/data/](web/src/data/)). All climb/hold/stats queries go through it.
- **Offline-first PWA** — `vite-plugin-pwa` (Workbox, silent auto-update); installable,
  app shell precached, catalog DB deliberately kept in OPFS (never the SW cache).
- **Catalog snapshot** — `web/scripts/build-catalog-snapshot.py` runs BoardLib and prunes
  the full catalog to the Fullride 7x10 (~5 MB gzipped), shipped as a same-origin static
  asset. See [web/public/catalog/manifest.json](web/public/catalog/manifest.json).

### Deploy

Ships as static assets to **Cloudflare Workers (Static Assets)** via GitHub Actions
(`cloudflare/wrangler-action`), with the deploy gated behind a green CI run. The deploy
is inert until the one-time setup (Cloudflare token + account ID, `ENABLE_DEPLOY=true`,
branch protection) is done — see **[docs/DEPLOY.md](docs/DEPLOY.md)**. Rationale for
Workers-over-Pages is in [.research/briefs/cloudflare-deploy/parent.md](.research/briefs/cloudflare-deploy/parent.md).

### Status

The **Fullride local create-save-light milestone is implemented**. The application now
composes the generated 305-placement board definition, independently authored
schematic SVG renderer, local climb viewer, unrestricted IndexedDB draft library,
responsive route editor, and API-level-3 Web Bluetooth controller. The automated
snapshot is green across 218 Vitest tests, strict typecheck, lint, production build,
and two Chromium end-to-end smokes covering autosave/reload/reopen and phone/desktop
interaction.

Automated tests validate protocol bytes and the controller lifecycle through fakes;
they do **not** prove behavior on a powered board. Fullride 7x10 + Android Chrome
physical verification remains an explicit pending checkpoint.

Community-catalog first-run installation is still blocked on the VFS-import decision
in `epic-foundation-catalog-bootstrap`. Catalog browsing/filtering and provider
publication, iOS direct control, other boards, ML grade prediction, logbook,
playlists, sharing, and recommendations remain future work. Query current work with
`.work/bin/work-view --ready`.

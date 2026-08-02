# CruxControl

## In plain terms

A **Kilter Board** is an interactive climbing wall: a grid of plastic holds with LEDs
behind them. You pick a climb, the right holds light up, and you try to get to the top
using only those holds. Normally you drive the board with Kilter's official phone app.

That app is slow, hard to get your data out of, and not very smart. **CruxControl is a
replacement for it** — a web app (it runs in your browser, nothing to install from an
app store) that talks to a home Kilter Board over Bluetooth and does the same job, but
faster and with extra features the official app doesn't have:

- **Browse and filter climbs instantly**, even offline.
- **Light up a climb on the wall** straight from the browser.
- **Predict the difficulty (grade)** of a climb using machine learning — including
  climbs nobody has rated yet, and spotting "sandbags" (climbs harder than their label).
- **Keep your own logbook** of what you've climbed, stored on *your* device — not locked
  inside someone else's app.
- **Share a climb with a friend** by sending them a link.

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
npm test             # vitest (24 tests)
npm run typecheck    # tsc --noEmit (strict)
npm run lint         # eslint
npm run format       # prettier --write
```

Requires Node ≥ 20 (see `.nvmrc`). Run scripts from the repo root with
`-w @cruxcontrol/web`, or from inside `web/`.

### Architecture highlights (foundation)

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

The **foundation epic is nearly complete**. Done: monorepo scaffold, the in-browser
SQLite read path, the offline PWA shell, and CI + the gated Workers deploy. In progress:
**catalog bootstrap** — snapshot generation is proven (the script + manifest are in), but
the client-side first-run install is blocked on a VFS-import decision (see the
`epic-foundation-catalog-bootstrap` item).

Everything past the foundation — board control over Bluetooth, the climb browser, ML
grade prediction, logbook, playlists, recommendations, route creation — is planned and
blocked on it. Work is tracked in `.work/`; query with `.work/bin/work-view --ready`
(or `--parent epic-foundation` for the foundation's status).

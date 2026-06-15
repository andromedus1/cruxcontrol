# CruxControl

## In plain terms

**CruxControl is a
replacement for a board control app** — a web app (it runs in your browser, nothing to install from an
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
/web   — TypeScript PWA (React + Vite). The client app. The only deployed artifact.
/ml    — Python ML training pipeline (grade prediction). Exports model artifacts to /web/public.
/docs  — foundation docs (VISION/SPEC/ARCHITECTURE), research briefs, knowledge index.
/.work — agile-workflow substrate (epics/features/stories). Source of truth for work.
```

`/web` is an npm workspace; `/ml` is a standalone Python project (not an npm workspace).

### Develop (web)

```bash
npm install          # installs the web workspace
npm run dev          # vite dev server
npm run build        # static production build → web/dist
npm test             # vitest
npm run typecheck    # tsc --noEmit (strict)
npm run lint         # eslint
npm run format       # prettier --write
```

Requires Node ≥ 20 (see `.nvmrc`).

### Status

Early scaffold. Work is tracked in `.work/` — query with `.work/bin/work-view --ready`.
The build pipeline (CI + Cloudflare Pages deploy), in-browser SQLite catalog, PWA shell,
and catalog bootstrap are the in-progress `epic-foundation` features. Everything past
the foundation (board control over Bluetooth, the climb browser, grade prediction,
logbook, recommendations) is planned and blocked on it — see the epic graph in `.work/`.

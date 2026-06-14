# CruxControl

A custom, distributable web app to control a home **Kilter Board Fullride 7x10** — a fast,
data-owning, installable PWA that replaces the official Kilter app and adds intelligence
(ML grade prediction, personalized training). See [docs/VISION.md](docs/VISION.md).

## Layout (monorepo)

```
/web   — TypeScript PWA (React + Vite). The client app. The only deployed artifact.
/ml    — Python ML training pipeline (grade prediction). Exports model artifacts to /web/public.
/docs  — foundation docs (VISION/SPEC/ARCHITECTURE), research briefs, knowledge index.
/.work — agile-workflow substrate (epics/features/stories). Source of truth for work.
```

`/web` is an npm workspace; `/ml` is a standalone Python project (not an npm workspace).

## Develop (web)

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

## Status

Early scaffold. Work is tracked in `.work/` — query with `.work/bin/work-view --ready`.
The build pipeline (CI + Cloudflare Pages deploy), in-browser SQLite catalog, PWA shell,
and catalog bootstrap are the in-progress `epic-foundation` features.

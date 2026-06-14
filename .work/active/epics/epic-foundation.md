---
id: epic-foundation
kind: epic
stage: drafting
tags: [data]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
---

# Foundation: Web App Scaffolding + Local Catalog

## Brief

The substrate every other epic builds on: a working web-app skeleton and a local,
queryable Kilter catalog. This epic stands up the build tooling and framework, the
in-browser SQLite read path (the single source of truth for all climb/hold/stats
queries), the one-time bootstrap of the catalog from BoardLib, and the **distribution
spine** — packaging the client as a static, installable PWA that friends can open
from a URL with no setup and no backend.

When this epic is done, the app loads instantly offline, can run schema-faithful
queries against the full Kilter catalog locally, and is deployable as a hosted,
installable PWA. It does NOT cover browsing UI, rendering, BLE, ongoing sync, or any
intelligence — those are downstream epics that consume this read path.

## Research briefs

- `docs/briefs/data-model.md` — SQLite schema, frames encoding, BoardLib bootstrap
  (`boardlib database kilter kilter.db`). Grounds the catalog shape.
- **[brief written]** [foundation-pwa-sqlite.md](../../../docs/briefs/foundation-pwa-sqlite.md)
  — *Distributable offline-first PWA with in-browser SQLite.* Recommends a client-only
  React + Vite SPA, wa-sqlite OPFSCoopSyncVFS in a Web Worker, and vite-plugin-pwa →
  Cloudflare Pages static deploy. Covers three linked threads: (1) in-browser SQLite —
  `sql.js` vs OPFS-backed SQLite (wa-sqlite / absurd-sql), query performance over tens
  of thousands of climbs, persistence/versioning of the local DB; (2) offline-first
  PWA — service-worker strategy, installability, app-shell caching; (3) **distribution
  robustness** — framework selection (React/Vite, SvelteKit, etc.) judged on stable
  static-PWA distribution to friends, ecosystem support for Web Bluetooth + in-browser
  SQLite + ONNX/TF.js, and trivially-hostable static deploy (Cloudflare Pages /
  Netlify / Vercel). Run `/research-pipeline:brief` before `/epic-design`.

## Foundation references

- `docs/ARCHITECTURE.md` — Module Map §1 (Data Layer); Conventions (offline-first,
  single source of truth); Key Dependencies (`sql.js`/OPFS, BoardLib).
- `docs/SPEC.md` — Capability 6 (Data Acquisition), Constraints (offline-first,
  browser support).

## Anticipated child features

Provisional — `/epic-design` decides the real decomposition:
- App skeleton + build tooling + framework selection (distribution-robust)
- Local SQLite read path (load DB, run schema queries)
- Catalog bootstrap from a BoardLib-produced `kilter.db`
- Offline-first PWA shell (service worker, installability, instant load)
- Static hosting + deploy (CI/CD to a static PWA host) — the distribution spine

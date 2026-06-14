---
id: epic-foundation
kind: epic
stage: drafting
tags: [data, needs-brief]
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
queries), and the one-time bootstrap of the catalog from BoardLib.

When this epic is done, the app loads instantly offline and can run schema-faithful
queries against the full Kilter catalog locally. It does NOT cover browsing UI,
rendering, BLE, ongoing sync, or any intelligence — those are downstream epics that
consume this read path.

## Research briefs

- `docs/briefs/data-model.md` — SQLite schema, frames encoding, BoardLib bootstrap
  (`boardlib database kilter kilter.db`). Grounds the catalog shape.
- **[needs-brief]** — *In-browser SQLite & offline-first architecture.* Thin and
  load-bearing: `sql.js` vs OPFS-backed SQLite (e.g. wa-sqlite / absurd-sql), query
  performance over tens of thousands of climbs, persistence/versioning of the local
  DB, service-worker/PWA offline strategy. Run `/research-pipeline:brief` on this
  before `/epic-design`. (Web framework choice — React vs SvelteKit — is a
  feature-design architectural-options decision, not a research topic.)

## Foundation references

- `docs/ARCHITECTURE.md` — Module Map §1 (Data Layer); Conventions (offline-first,
  single source of truth); Key Dependencies (`sql.js`/OPFS, BoardLib).
- `docs/SPEC.md` — Capability 6 (Data Acquisition), Constraints (offline-first,
  browser support).

## Anticipated child features

Provisional — `/epic-design` decides the real decomposition:
- App skeleton + build tooling + framework selection
- Local SQLite read path (load DB, run schema queries)
- Catalog bootstrap from a BoardLib-produced `kilter.db`
- Offline-first shell (service worker, instant load)

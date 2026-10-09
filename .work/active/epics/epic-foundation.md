---
id: epic-foundation
kind: epic
stage: implementing
tags: [data]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-10-09
---

# Foundation: Web App Scaffolding + Local Catalog

## Brief

The substrate every other epic builds on: a working web-app skeleton and a local,
queryable Kilter catalog. This epic owns build tooling, the worker-backed SQLite
catalog read path, explicit installation of an older Fullride snapshot, and static
PWA packaging. Authored climbs and playlists remain in independent IndexedDB
repositories. Distribution infrastructure exists, while public deployment and
catalog-source distribution remain separately gated.

The current milestone provides offline app-shell and installed-catalog reads on
Android/desktop Chromium. It does not establish current official Kilter coverage.
The standalone community-browser feature owns its user-facing installation and
browsing surfaces; rendering, BLE, live sync and intelligence remain separate.
The deferred browser-storage fallback remains an unfinished child, so completion
of the current Chromium slice does not close the whole epic.

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

## Design decisions

Captured via `epic-design --only-questions` (2026-06-13). Fixed inputs for the
feature-design pass — do not re-ask.

- **Framework / SQLite / PWA / host**: React + Vite client-only SPA; wa-sqlite
  `AccessHandlePoolVFS` in a dedicated Web Worker; `vite-plugin-pwa`. The catalog
  IndexedDB fallback remains deferred. This updates the original VFS recommendation
  to the implemented storage adapter (2026-10-09).
- **Catalog delivery (2026-10-09)**: lazy, explicit setup in the approved Legacy
  Kilter Manage dialog. Opening local work performs no catalog I/O; metadata and
  exact binary download follow the documented consent flow. An existing receipt
  reopens offline without fetching an offer. The restored older snapshot is not
  a current-source or public-redistribution proof, and CI does not refresh it.
- **Deploy target**: Cloudflare Workers (Static Assets) — Cloudflare's recommended path
  for new static SPAs; custom-header-capable (`_headers`) so the official-SQLite-build
  option stays open. Deploy via GitHub Actions + `cloudflare/wrangler-action`, CI-gated.
  Revised from Cloudflare Pages by the [cloudflare-deploy brief](../../../.research/briefs/cloudflare-deploy/parent.md).
- **Repo structure**: Monorepo — `/web` (TypeScript PWA) + `/ml` (Python training);
  model artifacts export to `/web/public`. Foundation establishes this layout; CI has
  web + ml jobs. — one place for everything; epic-grade-prediction's `/ml` lives here.
- **Language**: TypeScript throughout `/web` (robustness for distribution).
- **CI/remote**: repo is `andromedus1/cruxcontrol`; foundation includes a GitHub Actions
  CI (build/test/lint) + branch protection so all subsequent features merge via PR.
- **First-milestone browser support**: Android and desktop Chromium only. The drafted
  IndexedDB fallback remains deferred; Safari/Firefox/iOS browse support is not part of
  the first autopilot scope. — confirmed 2026-08-02.
- **Catalog setup UI**: show older-source provenance, unknown freshness, download
  and storage sizes, then install only the explicitly accepted offer. The user
  selected compact status plus Manage in `kilter-community-browser` on 2026-10-09.

## UI alignment

`epic-foundation` owns infrastructure. The approved `kilter-community-browser`
feature composes its installation/status UI with the existing responsive climb
browser; its committed Option 2 mock owns the surface contract.

## Foundation references

- `docs/ARCHITECTURE.md` — Module Map §1 (Data Layer); Conventions (offline-first,
  catalog/local-library separation); Key Dependencies (`wa-sqlite`/OPFS).
- `docs/SPEC.md` — Capability 6 (Data Acquisition), Constraints (offline-first,
  browser support).

## Decomposition

Split by capability, not layer. `scaffold` is the gate (monorepo + app skeleton +
the data-layer port everything depends on); once it lands, `ci-deploy`, `sqlite-readpath`,
and `pwa-shell` parallelize off it; `catalog-bootstrap` completes the read path last. The
trickiest, most load-bearing feature is `sqlite-readpath` (the wa-sqlite Worker), which is
why it's isolated and on the critical path to the catalog.

### Child features
- `epic-foundation-scaffold` — monorepo `/web`+`/ml`, React+Vite+TS skeleton, Vitest/lint, data-layer port stub — depends on: `[]`
- `epic-foundation-ci-deploy` — GitHub Actions CI + Cloudflare Workers (Static Assets) deploy + branch protection — depends on: `[epic-foundation-scaffold]`
- `epic-foundation-sqlite-readpath` — wa-sqlite AccessHandlePoolVFS worker and data-layer port — depends on: `[epic-foundation-scaffold]`
- `epic-foundation-pwa-shell` — vite-plugin-pwa, manifest, service worker, install, offline shell — depends on: `[epic-foundation-scaffold]`
- `epic-foundation-catalog-bootstrap` — bounded acquisition, validation, two-slot OPFS activation and durable receipt — depends on: `[epic-foundation-sqlite-readpath]`
- `epic-foundation-verify-worker-build` — app-rooted worker/WASM graph and precache verification — depends on: `[kilter-community-browser]`
- Deferred backlog: `epic-foundation-sqlite-idb-fallback` — `IDBBatchAtomicVFS`
  fallback for browse-only Safari/Firefox; explicitly outside the first Android/desktop
  Chromium milestone.

### Decomposition risks
- **wa-sqlite Worker (sqlite-readpath) is the riskiest unit** — OPFS sync-access-handle behavior varies by browser; the IDB fallback and a fixture-DB test suite mitigate. Build it before catalog-bootstrap commits to a load path.
- **Cloudflare Workers deploy needs an external account + API token** (ci-deploy) — the workflow is authored/validated without the secret; the deploy step is gated until the user provides it (`Edit Cloudflare Workers` token + account ID). Not a code blocker.

### UI alignment
The community-browser feature owns the approved UI. Bootstrap and artifact checks
remain infrastructure, with synthetic worker tests and no separate product surface.

## Delivery reconciliation (2026-10-09)

Scaffold, CI/deploy configuration, SQLite read path, PWA shell and catalog bootstrap
are done. The community browser has passed production-browser acceptance and its
standard review corrections are being verified. The worker/WASM artifact assertion
is implemented and independently approved, pending final CI. These
updates reflect already approved feature designs; no epic split, new dependency
edge, feature reparenting or expansion of browser support was introduced. Keep this
epic implementing while the deferred storage fallback remains a drafting child.

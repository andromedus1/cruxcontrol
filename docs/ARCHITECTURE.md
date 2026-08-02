---
description: CruxControl high-level architecture — modules, data flow, conventions, dependencies, risks
type: planning
kind: planning
updated: 2026-08-02
nav_priority: high
summary: >
  High-level architecture for a Kilter-first climbing-board platform: typed board
  definitions and namespaced identities, independent catalog providers and
  controller profiles, on-demand local catalogs, and a Fullride 7x10 first slice.
decisions:
  - "Offline-first React + Vite SPA (TypeScript) with local SQLite (wa-sqlite AccessHandlePoolVFS in a Web Worker, IndexedDB fallback) as the read path."
  - "BLE isolated behind a Web Bluetooth adapter implementing the API-level-3 packet protocol."
  - "Sync engine is a separate module wrapping POST /sync with incremental shared_syncs cursors."
  - "ML training is offline (Python); inference runs in-browser via ONNX Runtime Web (WASM)."
  - "Distributed to friends as a static, backendless, installable PWA (no app server/accounts); React + Vite chosen for distribution robustness."
  - "This doc stays high-level; detailed module design lives in epic/feature item bodies."
  - "Board definition, catalog provider, and controller profile are independent boundaries connected by an installation registry."
  - "Provider-native records and provenance are retained beside the normalized read model."
  - "Catalogs are installed per provider/layout; a universal bundled database is rejected."
  - "A native iOS shell, if prioritized, exposes a narrow CoreBluetooth transport bridge to the shared application core."
---

# CruxControl — Architecture

High-level only. This document owns module boundaries, data flow, cross-cutting
conventions, and dependencies. Detailed per-module design lives in epic and
feature item bodies in `.work/`, not here. Capabilities are in
[SPEC.md](SPEC.md); rationale is in [VISION.md](VISION.md).

## Module Map

1. **Board Domain & Installation Registry** — provider-neutral identities for
   board definitions, immutable layout revisions, installations, climbs, roles,
   grades, and capabilities. It binds a local installation to compatible catalog
   and controller adapters.
2. **Data Layer** — on-demand local SQLite catalogs via `wa-sqlite`
   (`AccessHandlePoolVFS`) in a Web Worker (IndexedDB fallback), behind domain query
   ports. Native records and provenance sit beside a normalized read model.
3. **Catalog Providers** — source-specific import/sync adapters. Kilter is first;
   later Aurora-family and MoonBoard providers are separately researched. Network,
   auth, reconciliation, and policy metadata remain outside domain and UI code.
4. **Controller Profiles & Transports** — profiles own discovery and command
   encoding; transports own platform I/O. The first pair is Aurora API-level-3 over
   Web Bluetooth. A future iOS shell may supply CoreBluetooth behind the same port.
5. **Board Renderer** — definition-driven geometry, role colors, and selection.
   Fullride 7x10 is the first validated definition, not a renderer constant.
6. **Climb Browser** — fast filtered browsing + shareable-URL routing over the
   Data Layer; drives the renderer and the BLE Adapter to play a climb.
7. **Route Editor** — tap-to-place visual editor producing a normalized climb;
   provider adapters own source-native encoding and optional publication.
8. **Logbook & Sessions** — local store of ascents/attempts/sessions with
   analytics; optional push to the Kilter API via the Sync Engine.
9. **Playlists** — local store of user-curated, ordered namespaced climb references;
   reuses the renderer + shareable-URL routing, and drives the BLE Adapter for
   board play-through. A CruxControl-local construct (no Kilter counterpart).
10. **ML Pipeline** — offline (Python): feature extraction from the catalog →
   training dataset → grade-prediction model. Exports a model for in-browser
   inference (ONNX Runtime Web / WASM); feeds prediction + recommendation features back
   into the app.

## Data Flow

```
Provider source ──▶ Catalog adapter ──▶ native + normalized local catalog
                                                │
Board definition ──▶ Installation registry ─────┼──▶ Browser / Editor / Logbook
         │                                      │              │
         └──────────────────────────────▶ Renderer              ▼
                                                   controller command
                                                           │
                               Controller profile ◀────────┘
                                         │
                             Web Bluetooth transport ──▶ Physical board
                             (future: native iOS bridge)
```

Catalog reads are fully offline. Only provider adapters and controller transports
cross network/device boundaries, so domain, rendering, browsing, editing, and
logging remain testable without hardware or network.

## Conventions

- **Ports & adapters at real edges.** Provider APIs, catalog storage, and controller
  transports sit behind typed interfaces; UI/domain never call Web Bluetooth,
  `fetch`, `wa-sqlite`, or provider-native SQL directly.
- **Three-axis composition.** Board definitions, catalog providers, and controller
  profiles vary independently and meet only through an explicit installation.
- **Namespaced immutable identity.** Links and user data reference provider + source
  ID + layout revision, never a bare climb ID or mutable display name.
- **Preserve source truth.** Normalized tables are query projections. Native payloads,
  grades, versions, attribution, and provenance remain available for reconciliation.
- **Single source of truth.** The local SQLite catalog is the read model; the
  logbook store is the source of truth for personal data.
- **Generated over hand-written.** Catalog data, feature tables, and the model
  come from pipelines, not manual curation.
- **Offline-first.** Every read works without network; sync is a background
  reconciliation, not a precondition.
- **Static-first distribution.** The initial app is client-side and ships as a
  static, installable PWA hosted on Cloudflare Workers (Static Assets). No application server, no
  accounts, no shared database — each friend's client is fully independent with
  browser-local storage. The only "backends" the client talks to are the Kilter sync
  API (over the network) and the board (over BLE). A narrowly scoped service is
  allowed later only for a provider or collaboration constraint demonstrated by research.

## Key Dependencies

The architecture's intended dependency set. React, Vite, wa-sqlite, Comlink, and
vite-plugin-pwa are installed; ONNX Runtime Web arrives with its ML feature.

| Dependency | Role |
|---|---|
| React 19 + Vite 6 (TypeScript) | Client-only SPA framework + build tooling |
| `wa-sqlite` (`AccessHandlePoolVFS`) | In-browser SQLite read path (in a Web Worker; IndexedDB fallback) |
| `vite-plugin-pwa` (Workbox) | Service worker + manifest — offline shell, installability |
| Web Bluetooth API | Browser → board BLE (Chromium only) |
| BoardLib (Python) | Bootstrap the SQLite catalog; sync-protocol reference |
| Kilter sync API | Incremental catalog + optional logbook sync |
| ONNX Runtime Web (WASM) | In-browser grade-prediction inference (GBT→ONNX export) |
| Cloudflare Workers (Static Assets) | Distribute the installable PWA to friends; no app server. Deployed via GitHub Actions + `cloudflare/wrangler-action`, CI-gated. See [cloudflare-deploy brief](../.research/briefs/cloudflare-deploy/parent.md) |
| Climbdex / Grip Connect / fake_kilter_board | Reference implementations (search, BLE, protocol) |

**Framework: React 19 + Vite 6, TypeScript, client-only SPA** — chosen for
distribution robustness (static bundle, no server runtime, deepest ecosystem for
Web Bluetooth + in-browser SQLite + ONNX inference). No SSR is used (Web Bluetooth
requires a client context). See [briefs/foundation-pwa-sqlite.md](briefs/foundation-pwa-sqlite.md).

## Biggest Risks

- **Web Bluetooth reliability** across OS/browser versions — the board-control
  path is hardware-coupled and hard to test in CI; needs a mock BLE adapter.
- **Sync API drift / auth.** The Kilter API is undocumented and may change;
  personal data (ascents/bids) is auth-gated.
- **ML signal quality.** Whether hold-placement features predict consensus grade
  well enough to be useful is an open empirical question — validate early.
- **Layout specificity.** Hard-coding to the Fullride 7x10 trades generality for
  speed; definitions must carry geometry and revisions before browser/editor work
  spreads those assumptions.
- **Provider access and rights.** APIs and exports are unstable, and technical access
  does not establish redistribution permission. Every provider needs explicit policy,
  provenance, refresh, and deletion handling.
- **False universality.** Aurora-family controllers share machinery, but layouts,
  firmware generations, and MoonBoard protocols differ. Compatibility is declared
  and tested per controller profile.
- **Catalog scale.** Multiple community catalogs can exceed practical bundle/browser
  limits, so catalogs are partitioned and installed per provider/layout.
- **iOS control.** WebKit does not expose Web Bluetooth. Direct iPhone control needs
  a native CoreBluetooth bridge; the web client remains useful in browse-only mode.

## History

- [Original north-star ideation doc (superseded)](architecture/history/north-star.md).

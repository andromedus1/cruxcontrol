---
description: CruxControl high-level architecture — modules, data flow, conventions, dependencies, risks
type: planning
kind: planning
updated: 2026-06-13
nav_priority: high
summary: >
  High-level architecture for CruxControl: an offline-first web app over a local
  SQLite catalog (synced from the Kilter API), a Web Bluetooth BLE layer driving
  the board, a climb browser + 2D renderer, a route editor, a logbook/session
  store, and a Python-side ML pipeline serving in-browser inference. This is the
  high-level shape; module-level designs are produced per-epic in the substrate.
decisions:
  - "Offline-first SPA with local SQLite (sql.js or OPFS-backed) as the read path."
  - "BLE isolated behind a Web Bluetooth adapter implementing the API-level-3 packet protocol."
  - "Sync engine is a separate module wrapping POST /sync with incremental shared_syncs cursors."
  - "ML training is offline (Python); inference runs in-browser via ONNX.js / TF.js."
  - "This doc stays high-level; detailed module design lives in epic/feature item bodies."
---

# CruxControl — Architecture

High-level only. This document owns module boundaries, data flow, cross-cutting
conventions, and dependencies. Detailed per-module design lives in epic and
feature item bodies in `.work/`, not here. Capabilities are in
[SPEC.md](SPEC.md); rationale is in [VISION.md](VISION.md).

## Module Map

1. **Data Layer** — local SQLite catalog (`sql.js` or OPFS-backed), the read
   path for all climb/hold/stats queries. Schema mirrors the official Kilter DB.
2. **Sync Engine** — wraps `POST kilterboardapp.com/sync`, drives incremental
   updates via `shared_syncs` cursors, and bootstraps from a BoardLib-downloaded
   DB. Owns all network I/O against the Kilter API.
3. **BLE Adapter** — Web Bluetooth layer. Encapsulates scan/connect and encodes
   LED commands per the API-level-3 packet protocol (framing, checksums,
   multi-packet splitting). The only module that talks to the board.
4. **Board Renderer** — 2D visual board for the Fullride 7x10 layout: hold
   positions, role colors, selection. Shared by browser, editor, and player.
5. **Climb Browser** — fast filtered browsing + shareable-URL routing over the
   Data Layer; drives the renderer and the BLE Adapter to play a climb.
6. **Route Editor** — tap-to-place visual editor producing `frames` strings;
   local drafts + publish via the Sync Engine.
7. **Logbook & Sessions** — local store of ascents/attempts/sessions with
   analytics; optional push to the Kilter API via the Sync Engine.
8. **Playlists** — local store of user-curated, ordered climb-reference lists;
   reuses the renderer + shareable-URL routing, and drives the BLE Adapter for
   board play-through. A CruxControl-local construct (no Kilter counterpart).
9. **ML Pipeline** — offline (Python): feature extraction from the catalog →
   training dataset → grade-prediction model. Exports a model for in-browser
   inference (ONNX.js / TF.js); feeds prediction + recommendation features back
   into the app.

## Data Flow

```
Kilter API ──POST /sync──▶ Sync Engine ──▶ Local SQLite (Data Layer)
                                              │
                  ┌───────────────────────────┼───────────────────────┐
                  ▼                            ▼                        ▼
            Climb Browser              Route Editor              ML Pipeline
                  │                            │                  (offline, Python)
                  ▼                            ▼                        │
            Board Renderer ◀───────────────────┘                        ▼
                  │                                            exported model
                  ▼                                                     │
             BLE Adapter ──Web Bluetooth──▶ Physical Board               ▼
                                                          in-browser inference
  Logbook & Sessions ◀── user logs ──▶ (optional) Sync Engine ──▶ Kilter API
```

The catalog read path (SQLite) is fully offline. Only the Sync Engine and BLE
Adapter cross a boundary (network and Bluetooth respectively); both are isolated
so the rest of the app is testable without hardware or network.

## Conventions

- **Ports & adapters at the edges.** BLE and the Kilter API sit behind adapter
  interfaces; the UI and domain never call Web Bluetooth or `fetch` directly.
- **Single source of truth.** The local SQLite catalog is the read model; the
  logbook store is the source of truth for personal data.
- **Generated over hand-written.** Catalog data, feature tables, and the model
  come from pipelines, not manual curation.
- **Offline-first.** Every read works without network; sync is a background
  reconciliation, not a precondition.

## Key Dependencies

| Dependency | Role |
|---|---|
| Web Bluetooth API | Browser → board BLE (Chromium only) |
| `sql.js` / OPFS | In-browser SQLite read path |
| BoardLib (Python) | Bootstrap the SQLite catalog; sync-protocol reference |
| Kilter sync API | Incremental catalog + optional logbook sync |
| ONNX.js / TensorFlow.js | In-browser grade-prediction inference |
| Climbdex / Grip Connect / fake_kilter_board | Reference implementations (search, BLE, protocol) |

Web app framework (React / SvelteKit / etc.) is **not yet chosen** — it is a
design decision deferred to the foundation epic.

## Biggest Risks

- **Web Bluetooth reliability** across OS/browser versions — the board-control
  path is hardware-coupled and hard to test in CI; needs a mock BLE adapter.
- **Sync API drift / auth.** The Kilter API is undocumented and may change;
  personal data (ascents/bids) is auth-gated.
- **ML signal quality.** Whether hold-placement features predict consensus grade
  well enough to be useful is an open empirical question — validate early.
- **Layout specificity.** Hard-coding to the Fullride 7x10 trades generality for
  speed; revisit only if multi-board support is ever scoped in.

## History

- [history/north-star.md](architecture/history/north-star.md) — original combined ideation doc (superseded).

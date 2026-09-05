---
description: CruxControl high-level architecture — modules, data flow, conventions, dependencies, risks
type: planning
kind: planning
updated: 2026-09-05
nav_priority: high
summary: >
  High-level architecture for a Kilter-first climbing-board platform: typed board
  definitions and namespaced identities, independent catalog providers and
  controller profiles, on-demand local catalogs, and a Fullride 7x10 first slice.
decisions:
  - "CruxControl is an offline-first React + Vite SPA distributed as a static, backendless, installable PWA; local SQLite through wa-sqlite AccessHandlePoolVFS in a Web Worker is the catalog read path."
  - "Board definition, catalog provider, and controller profile are independent boundaries connected by an installation registry."
  - "Provider-native records and provenance are retained beside the normalized read model; catalogs install per provider/layout rather than as one universal bundled database."
  - "BLE is isolated behind a Web Bluetooth adapter with API-level-2 and API-level-3 Aurora codecs selected from the connected controller identity."
  - "A native iOS shell, if prioritized, exposes a narrow CoreBluetooth transport bridge to the shared application core."
  - "The generated immutable Fullride definition is the shared geometry, placement identity, role, and LED-mapping authority; private builds may resolve exact-ID/revision calibrated raster artwork while schematics remain the distributable fallback."
  - "Locally authored climbs and playlists use independent versioned IndexedDB repositories; climb storage owns unrestricted Draft/Finished and recoverable-Trash lifecycle outside provider catalogs."
  - "Playlist portability uses a strict versioned snapshot envelope in URL fragments or JSON files; imports preview before creating fresh local records and compensate partial failures."
  - "Whole-library backup uses a bounded local JSON file and missing-only, identity-preserving restore with conflict blocking and one transaction per IndexedDB store; the two stores are never treated as one atomic snapshot."
  - "Kilter Android Fullride screenshot import analyzes transient pixels on-device, reviews definition-mapped holds locally, and writes ordinary 40-degree drafts while skipping exact duplicates across active climbs and Trash."
  - "Provider sync remains a separate incremental shared_syncs module; ML trains offline in Python and runs browser inference through ONNX Runtime Web."
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
   and controller adapters. The first generated definition contains all 305
   controllable Fullride 7x10 placements, source geometry, semantic role presets,
   supported angles, and placement-to-LED identities.
2. **Data Layer** — on-demand local SQLite catalogs via `wa-sqlite`
   (`AccessHandlePoolVFS`) in a Web Worker, behind domain query ports. Native records
   and provenance sit beside a normalized read model. A catalog-storage IndexedDB
   fallback is deferred. Small locally authored climb and playlist aggregates use
   independent native IndexedDB repositories with versioned codecs and atomic
   optimistic updates; climb storage additionally owns explicit lifecycle commands.
   Library backup reads both stores through their codecs and restores saved records with
   stable IDs in separate per-store transactions; it is a bounded local file workflow,
   not a schema migration or cloud service. Catalog bootstrap remains a separate
   incomplete boundary.
3. **Catalog Providers** — source-specific import/sync adapters. Kilter is first;
   later Aurora-family and MoonBoard providers are separately researched. Network,
   auth, reconciliation, and policy metadata remain outside domain and UI code.
4. **Controller Profiles & Transports** — profiles own discovery and command
   encoding; transports own platform I/O. The first pair is Aurora API level 2/3 over
   Web Bluetooth: deterministic framing/checksum/multi-packet encoding, serialized
   Nordic UART writes, explicit connection lifecycle, light/clear operations, and
   bounded latest-frame-wins preview. A collapsed, local-only capacity diagnostic uses
   the same queue with bounded cases, optional inter-write pacing, sanitized timing
   traces, hard timeout/disconnect, and explicit clear/reconnect recovery; it does not
   infer hardware limits from encoder speed. The existing API-2 policy shares that queue:
   normal writes use 20 ms pacing, static scenes are bounded to one 127-light packet,
   and the editor's absolute-time animation scheduler sends complete scenes of at most
   20 lights at up to 2 FPS with one frame in flight and stale deadlines coalesced. Since
   omitted lights replace rather than preserve the previous scene, sparse delta frames
   are forbidden. Refused playback never rewrites saved assignments. A future iOS shell
   may supply CoreBluetooth behind the same port.
5. **Board Renderer** — definition-driven geometry, role colors, and selection.
   For the exact Fullride ID and revision, the private/local prototype resolves one
   immutable, affinely calibrated reference-image underlay beneath 305 semantic
   placement groups. A renderer-only dark-background color treatment keeps bright LED
   rings legible without changing the immutable source or calibration. The shared
   independently authored schematic SVG artwork remains
   mounted until the raster loads and is the complete error, other-definition, and
   distributable fallback. Coordinates, hit testing, focus, overlays, and LED mapping
   always come from the generated definition; pixels never become domain geometry.
6. **Climb Browser** — the implemented source-neutral My Climbs/Drafts/Trash
   list/detail surface drives the renderer and controller for browser-local climbs.
   Fast community-catalog filtering and shareable provider URLs remain downstream of
   catalog bootstrap.
7. **Route Editor** — a reducer-driven responsive workspace edits unrestricted local
   climbs, coalesces lifecycle-aware autosaves, exposes conflict/failure recovery, and
   composes the renderer with explicit Light Draft and opt-in Live Preview. Provider
   adapters own future source-native encoding and optional publication. Versioned effect
   groups share one two-pass pure frame engine: assignment effects render first, procedural
   spatial layers target definition geometry without fake assignments, and semantic roles
   are reasserted last. Version 1 dispatch preserves existing saved recipes; version-2
   spatial presets default to 90–150-second closed themed trajectories, and explicit
   upgrades preserve authored settings except the version and max(old period, new default).
   Prepared geometry and bounded per-group held-frame/path reuse avoid repeated spatial work.
   The ten established backgrounds plus Curious Bumblebee are v2 presets; the bee uses a
   seeded six-stop hover/flight/dart tour and independent body/wing palette slots. Stable
   tide/spiral samples carry their target bands through loop joins, reverse paths retain
   actor ordering, and Pong plans each paddle to its own wall contact.
   API-2 decorative colors avoid exact encoded role colors and black after quantization; this
   protects encoded bytes rather than promising perceptual contrast. Saved recipe snapshots,
   dynamic target masks, deterministic footprints, and a conservative reserve plan feed the
   existing complete-scene BLE scheduler. Empty spatial scenes are valid animation frames;
   only explicit stop/clear/disconnect/visibility cancellation ends playback. The
   snapshot-backed spatial registry contains Ocean Tide, Tie-dye Spiral, Matrix Rain,
   Snake, Beach Ball, Pac-Man, Pong, Bird Flock, Frogger, and a fading circled inverted
   pentagram and Curious Bumblebee. Browser playback is foreground-only; an empty spatial
   scene is a valid animation frame, while direct clear, stop, disconnect, visibility loss,
   or leaving the relevant view cancels scheduling rather than relying on suspended timers.
8. **Screenshot Import** — a local-only Kilter Android Fullride adapter hashes and
   analyzes selected PNGs sequentially, maps detected role rings through the immutable
   board definition, and presents an editable review before using the existing climb
   repository. Source bitmaps, canvas pixels, and object URLs are transient and never
   persisted or uploaded. A built-in 16-climb migration carries only checksum-linked
   titles and role/placement facts. Confirmed climbs are ordinary 40° drafts; exact
   content duplicates in active storage or Trash are skipped.
9. **Future: Logbook & Sessions** — local store of ascents/attempts/sessions with
   analytics; optional push to the Kilter API via the Sync Engine.
10. **Playlists** — an implemented separate native IndexedDB repository, responsive
   management surface, and exact-order board play-through for named, annotated,
   manually ordered local/provider climb references. Runtime resolution preserves
   unavailable Trash, missing, or incompatible-board entries without cross-database
   writes. Play-through keeps position ephemeral and delegates preview, connection,
   and explicit serialized lighting to the existing climb-detail/controller boundary.
   Portable export snapshots resolvable local climb content without sender-local IDs
   and preserves namespaced provider references in a strict independently versioned
   envelope. Fragment URLs are used only below the bounded URL limit; lossless JSON
   files remain available for every valid export. Import performs a write-free
   compatibility preview, then creates fresh climbs in order and the fresh playlist
   last, with reverse-order compensation for partial failure. A CruxControl-local
   construct (no Kilter counterpart).
11. **Library Backup & Recovery** — the library workspace exports a versioned, bounded
   local JSON file containing all saved climb rows across installations (including orphan
   and Trash rows) and all playlist rows with ordered shared references, IDs, revisions,
   timestamps, metadata, and effect recipes. Export reads both independent stores twice
   with a bounded stability check and asks users to finish other-tab edits; it cannot
   provide a cross-database atomic snapshot. Restore validates the whole file, then adds
   missing IDs, skips identical records, and blocks differing IDs without overwrite or
   replacement IDs. Draft and playlist stores commit independently in their own
   transactions, so a playlist failure after a committed climb batch is reported as a
   partial outcome for retry; no compensating deletion is used. Bounds are 25 MiB UTF-8,
   10,000 climbs, 1,000 playlists, and 100,000 references. The workflow operates on
   saved contents in the existing origin and does not rewrite schemas or upload data.
12. **Future: ML Pipeline** — offline (Python): feature extraction from the catalog →
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

Editor ──▶ Local climb repository ──▶ native IndexedDB
  │               (versioned + optimistic)       (browser-local authority)
  ├──▶ Renderer ──▶ SVG board surface
  ├──▶ Saved effect snapshots ──▶ two-pass frame engine ──▶ role-protected scene
  └──▶ Light controller ──▶ existing capacity policy ──▶ controller profile / transport

Kilter screenshot PNG ──▶ transient local analysis ──▶ editable definition-mapped review
                                                        └──▶ deduplicated 40° draft ──▶ Local climb repository
Supplied 16-climb facts (no pixels) ────────────────────┘

Lists ──▶ Local playlist repository ──▶ separate native IndexedDB
  └──▶ read-time climb resolver ──▶ available / Trash / missing entry view
  │                                └──▶ ephemeral play-through ──▶ Renderer / controller
  ├──▶ portable snapshot envelope ──▶ fragment URL / JSON file
  └──◀ preview + compatibility gate ── imported envelope
                 └──▶ fresh climb copies, then fresh playlist (compensated on failure)

Library workspace ──▶ backup service ──▶ bounded local JSON file
  └──◀ imported file ──▶ full review/conflict gate ──▶ per-store missing-only restore
```

Local climb reads and writes are fully offline. Installed catalog reads are likewise
designed to stay local once catalog bootstrap ships. Only provider adapters and
controller transports cross network/device boundaries, so domain, rendering,
browsing, editing, and logging remain testable without hardware or network.

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
- **Single source of truth.** The local SQLite catalog is the community read model;
  the native IndexedDB climb store is authoritative for locally authored climbs; the
  independent native IndexedDB playlist store is authoritative for list metadata and
  ordered references. The future logbook store owns personal activity.
- **Local backup semantics.** Backup captures saved records from the existing climb and
  playlist stores, including Trash, orphan rows, other installations, shared references,
  revisions, and recipes. Export stability checks are bounded because the stores cannot
  share one transaction. Restore validates before writes, preserves IDs, and treats a
  playlist failure after a committed climb batch as a reportable partial result for retry.
- **Generated over hand-written.** Catalog data, feature tables, and the model
  come from pipelines, not manual curation.
- **Offline-first.** Every read works without network; sync is a background
  reconciliation, not a precondition.
- **Image-minimizing imports.** Screenshot recognition runs entirely in the client;
  decoded bitmap/canvas resources are released after analysis, while selected File
  references and object-URL evidence remain only through review. None enter durable
  storage or network I/O; only the confirmed climb aggregate reaches IndexedDB.
- **Static-first distribution.** The initial app is a client-side, installable PWA
  configured for future static hosting on Cloudflare Workers (Static Assets); live
  deployment still requires operator setup and acceptance. There is no application
  server, account system, or shared database, and each friend's client is independent
  with browser-local storage. The current hardware edge is the board over BLE. A
  future provider adapter may connect to the Kilter sync API, and a narrowly scoped
  service is allowed later only for a provider or collaboration constraint
  demonstrated by research.

## Key Dependencies

The architecture's intended dependency set. React, Vite, wa-sqlite, Comlink, and
vite-plugin-pwa are installed; ONNX Runtime Web arrives with its ML feature.

| Dependency                                  | Role                                                                                                                                                                                                           |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React 19 + Vite 6 (TypeScript)              | Client-only SPA framework + build tooling                                                                                                                                                                      |
| `wa-sqlite` (`AccessHandlePoolVFS`)         | In-browser SQLite catalog read path in a Web Worker; catalog IndexedDB fallback is deferred                                                                                                                    |
| Native IndexedDB                            | Independent versioned, atomic, browser-local authorities for climbs (Draft/Finished/Trash lifecycle) and playlist aggregates                                                                                   |
| `vite-plugin-pwa` (Workbox)                 | Service worker + manifest — offline shell, installability                                                                                                                                                      |
| Web Bluetooth API                           | Explicit Android/desktop Chromium session and Nordic UART writes to the board                                                                                                                                  |
| Playwright                                  | Production-build Chromium smoke for climb lifecycle persistence and responsive editor behavior                                                                                                                 |
| BoardLib (Python)                           | Bootstrap the SQLite catalog; sync-protocol reference                                                                                                                                                          |
| Kilter sync API                             | Incremental catalog + optional logbook sync                                                                                                                                                                    |
| ONNX Runtime Web (WASM)                     | In-browser grade-prediction inference (GBT→ONNX export)                                                                                                                                                        |
| Cloudflare Workers (Static Assets)          | Distribute the installable PWA to friends; no app server. Deployed via GitHub Actions + `cloudflare/wrangler-action`, CI-gated. See [cloudflare-deploy brief](../.research/briefs/cloudflare-deploy/parent.md) |
| Climbdex / Grip Connect / fake_kilter_board | Reference implementations (search, BLE, protocol)                                                                                                                                                              |

**Framework: React 19 + Vite 6, TypeScript, client-only SPA** — chosen for
distribution robustness (static bundle, no server runtime, deepest ecosystem for
Web Bluetooth + in-browser SQLite + ONNX inference). No SSR is used (Web Bluetooth
requires a client context). See [briefs/foundation-pwa-sqlite.md](briefs/foundation-pwa-sqlite.md).

## Biggest Risks

- **Web Bluetooth reliability** across OS/browser versions — deterministic transport and
  renderer coverage exercises mapping, light/clear, animation, and the existing API-2
  envelope. The 127-light static and 20-light/2-FPS animation profile remains unchanged
   and applies only to that configured controller path; device-level acceptance for other
   firmware, browsers, and API levels still requires its own evidence.
- **Sync API drift / auth.** The Kilter API is undocumented and may change;
  personal data (ascents/bids) is auth-gated.
- **ML signal quality.** Whether hold-placement features predict consensus grade
  well enough to be useful is an open empirical question — validate early.
- **Layout specificity.** The Fullride definition is now generated, immutable, and
  validated with 305 controllable placements; renderer/editor/controller seams consume
  it through typed contracts. Every future board still needs its own sourced,
  revisioned definition and compatibility declaration.
- **Provider access and rights.** APIs and exports are unstable, and technical access
  does not establish redistribution permission. Every provider needs explicit policy,
  provenance, refresh, and deletion handling. The private Fullride renderer currently
  bundles a supplied Kilter reference image for local use only; public distribution is
  gated on permission or replacement. Removing its exact-ID/revision resolver restores
  the self-contained schematic path without a data migration.
- **False universality.** Aurora-family controllers share machinery, but layouts,
  firmware generations, and MoonBoard protocols differ. Compatibility is declared
  and tested per controller profile.
- **Catalog scale.** Multiple community catalogs can exceed practical bundle/browser
  limits, so catalogs are partitioned and installed per provider/layout.
- **iOS control.** WebKit does not expose Web Bluetooth. Direct iPhone control needs
  a native CoreBluetooth bridge; the web client remains useful in browse-only mode.

## History

- [Original north-star ideation doc (superseded)](architecture/history/north-star.md).

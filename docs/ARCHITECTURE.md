---
description: CruxControl high-level architecture — modules, data flow, conventions, dependencies, risks
type: planning
kind: planning
updated: 2026-10-09
nav_priority: high
summary: >
  High-level architecture for a Kilter-first climbing-board platform: typed board
  definitions and namespaced identities, independent catalog providers and
  controller profiles, on-demand local catalogs, and a Fullride 7x10 first slice.
  The first consented Kilter community catalog browser is integrated for an older
  offline snapshot; its implementation and release acceptance remain in progress.
  Current-source coverage, freshness, and public binary distribution remain unproven.
  Catalog work advances on Android/web independently of native iPhone acceptance.
  An invited contribution library is intended; approved journeys and a verified
  access/storage comparison guide its bounded collaboration service and retained local copies.
  An iPhone client proof now precedes further shared-service implementation.
  An isolated experimental Capacitor shell injects native BLE into the shared screens
  and controller; it compiles, starts, and has passed synthetic-data preservation and
  whole-library backup/restore round trips in an iPhone 17 simulator. Physical-device
  acceptance remains pending.
decisions:
  - "CruxControl is an offline-first React + Vite SPA distributed as a static, backendless, installable PWA; an optional lazy runtime service opens the local SQLite catalog through a serialized wa-sqlite AccessHandlePoolVFS worker."
  - "Board definition, catalog provider, and controller profile are independent boundaries connected by an installation registry."
  - "Provider-native records and provenance are retained beside the normalized read model; catalogs install per provider/layout rather than as one universal bundled database."
  - "BLE byte I/O is isolated behind Web Bluetooth in the PWA and an experimental native adapter in the iOS shell; both reuse API-level-2 and API-level-3 Aurora codecs selected from the connected controller identity."
  - "The required iPhone path reuses the controller transport boundary; simulator backup round-trip is proven, while real-board BLE, real-device storage pressure and native authentication remain unverified before service implementation resumes."
  - "Catalog acquisition and local browsing compose existing provider, storage, renderer and controller boundaries without depending on invited access or native iPhone proof."
  - "The first browser explicitly installs and reads an older Fullride snapshot; two OPFS slots and IndexedDB receipt metadata provide bounded recovery, with no automatic source refresh or claim of current coverage."
  - "The generated immutable Fullride definition is the shared geometry, placement identity, role, and LED-mapping authority; private builds may resolve exact-ID/revision calibrated raster artwork while schematics remain the distributable fallback."
  - "Locally authored climbs and playlists use independent versioned IndexedDB repositories; climb storage owns unrestricted Draft/Finished and recoverable-Trash lifecycle outside provider catalogs."
  - "Playlist portability uses a strict versioned snapshot envelope in URL fragments or JSON files; imports preview before creating fresh local records and compensate partial failures."
  - "Whole-library backup uses a bounded local JSON file and missing-only, identity-preserving restore with conflict blocking and one transaction per IndexedDB store; the two stores are never treated as one atomic snapshot."
  - "Kilter Android Fullride screenshot import analyzes transient pixels on-device, reviews definition-mapped holds locally, and writes ordinary 40-degree drafts while skipping exact duplicates across active climbs and Trash."
  - "PWA updates use an app-owned prompt-mode Workbox registration, shared Web Locks admission, and explicit safe activation gated by local workspace, mutation, play-through, and BLE session lifetimes."
  - "Provider sync remains a separate incremental shared_syncs module; ML trains offline in Python and runs browser inference through ONNX Runtime Web."
  - "The intended invited library separates authenticated publication and immutable source revisions from retained browser-local copies; production service selection remains conditional on a hosting/session proof."
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
   (`AccessHandlePoolVFS`) in a runtime-owned Web Worker, behind domain query ports.
   The app does no catalog storage I/O at ordinary startup; first catalog entry opens
   the service. A serialized worker owns the pool across navigation, and an origin
   Web Lock coordinates access. Installation stages a validated candidate in one of
   two OPFS slots, then commits IndexedDB receipt metadata as the slot authority. The
   previous slot remains available for bounded recovery; OPFS and IndexedDB do not
   share an atomic transaction. Unsupported OPFS/worker environments report the
   catalog unavailable. Native records and provenance sit beside a normalized read
   model. Small locally authored climb and playlist aggregates use
   independent native IndexedDB repositories with versioned codecs and atomic
   optimistic updates; climb storage additionally owns explicit lifecycle commands.
   Library backup reads both stores through their codecs and restores saved records with
   stable IDs in separate per-store transactions; it is a bounded local file workflow,
   not a schema migration or cloud service.
3. **Catalog Providers** — source-specific import/sync adapters. Kilter is first;
   later Aurora-family and MoonBoard providers are separately researched. Network,
   auth, reconciliation, and policy metadata remain outside domain and UI code.
   The browser currently consumes the approved older offline Fullride snapshot with
   explicit download consent; the catalog binary remains private and public
   distribution approval is unresolved. Source freshness is unknown, there is no live
   refresh, and the adapter's supported query surface does not establish current or
   complete official-app coverage. Kilter catalog work proceeds independently of the
   invited contribution service and native iPhone proof.
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
   are forbidden. Refused playback never rewrites saved assignments. The isolated
   iOS prototype supplies `NativeBleByteTransport` behind the same port. Its own
   composition root injects native I/O into the shared controller and library runtime;
   browser inspection of prototype assets exposes unsupported control. A storyboard-
   backed scene delegate forwards cold and warm URLs through Capacitor's existing
   application delegate proxy. Device
   selection is explicit and session-only. Native backgrounding disconnects and
   invalidates pending work; return requires explicit reconnect before effects resume.
   Copied buffers, FIFO batches, generation checks, discovered write modes, and native
   operation timeouts enforce the transport contract. Real iPhone delivery remains unverified.
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
   `CruxControlWorkspace` groups `BoardControlBar` and `ScreenAwakeControl` in a
   persistent header above navigation and editing. The connection bar owns explicit
   Connect/Reconnect actions. Mobile climb detail retains a connection row within its
   modal; desktop detail and playlist play-through use the workspace header without a
   duplicate row. Climb detail and editing share automatic scene lighting
   through `useEditorLighting`; view changes never request a Bluetooth chooser.
   The in-progress Kilter catalog surface opens its runtime service on first entry,
   shows explicit Manage/download consent, and filters complete Fullride-compatible
   snapshot rows by name, exact grade and angle in bounded 25-row cursor pages.
   Catalog results reuse read-only detail and lighting. The broader quality, ascent,
   setter, hold-count and grade-consensus filter set and provider-climb URLs remain
   future capabilities; this first slice has neither auto-refresh nor total-result
   claims.
7. **Route Editor** — a reducer-driven responsive workspace edits unrestricted local
   climbs, coalesces lifecycle-aware autosaves, exposes conflict/failure recovery, and
   composes the renderer with `useEditorLighting`. Connected-board scene changes are
   debounced for 180 ms and sent through the controller's latest-frame-wins preview
   queue; a connected transition also schedules the current scene. Scene-content keys
   prevent metadata edits or repository refreshes from restarting unchanged scenes.
   Effects preflight capacity before their initial queued frame and start scheduling
   only after that frame is applied. Retry lighting is shown only for blocked or failed
   lighting while animation is not running. Automatic lighting never initiates
   connection. Provider adapters own future
   source-native encoding and optional publication. Versioned effect
   groups share one two-pass pure frame engine: assignment effects render first, procedural
   spatial layers target definition geometry without fake assignments, and semantic role
   holds are reasserted last when a spatial background exists. Assignment-only effects
   intentionally animate explicitly assigned role holds. Version 1 dispatch preserves
   existing saved recipes; version-2
   spatial presets default to 90–150-second closed themed trajectories, and explicit
   upgrades preserve authored settings except the version and max(old period, new default).
   Prepared geometry and bounded per-group held-frame/path reuse avoid repeated spatial work.
   The Add a preset picker offers fourteen v2 backgrounds, including Curious Bumblebee; the bee uses a
   seeded six-stop hover/flight/dart tour and independent body/wing palette slots. Stable
   tide/spiral samples carry their target bands through loop joins, reverse paths retain
   actor ordering, and Pong plans each paddle to its own wall contact.
   API-2 decorative colors avoid exact encoded role colors and black after quantization; this
   protects encoded bytes rather than promising perceptual contrast. Saved recipe snapshots,
   dynamic target masks, deterministic footprints, and a conservative reserve plan feed the
   existing complete-scene BLE scheduler. Empty spatial scenes are valid animation frames.
   The snapshot-backed spatial registry supports fifteen kinds, including the v2-only
   Fireflies, Shooting Stars, Jellyfish, and Embers. These four recipes carry only
   their kind; shared group fields own palette, period, intensity, reserve, seed, and
   targets. Their default reserves are 8/6/9/10 lights and their default periods are
   120 seconds. Strict draft and portable-playlist codecs reject v1 snapshots of
   v2-only kinds. The sparse renderer prepares Matrix lanes from full board geometry
   and masks intended cells without relocating them. Saved columns define its lane
   pool, with at most three simultaneous trails sharing the ten-light default as
   4/3/3; new Matrix groups use three columns and a 90-second period. The v2 Matrix
   renderer changes without migrating saved records or rewriting authored settings;
   original v1 rendering remains intact. Frogger is excluded from the picker; its registry entry,
   editor controls, codecs, and version-1/version-2 renderers remain available for saved
   recipes and imports. Browser playback is foreground-only. Direct clear, disconnect,
   visibility loss, leaving the relevant view, and capacity diagnostics cancel scheduling.
   On return to foreground visibility, the hook reapplies the selected scene through
   the same guarded `lightDraft` path, retaining connection, capacity, and applied-frame
   checks before animation resumes. Hidden pages never schedule background animation.
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
   writes. Play-through keeps position ephemeral and delegates preview and automatic
   lighting to the shared climb-detail/controller boundary. Management and unavailable
   play-through views retain connection access through the workspace header. Available local
   entries expose Edit through the existing route editor; the workspace retains the
   source playlist ID and optional entry key in memory so Back resumes that list or
   play-through entry without changing persisted membership or navigation schemas.
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
12. **PWA Update Admission** — the app owns the native service-worker registration and
   observes waiting/installing workers from the Workbox-generated prompt-mode output.
   `skipWaiting` and `clientsClaim` remain false and registration injection is disabled so
   no unmanaged helper can reload another tab. Each admitted tab holds a shared Web Lock;
   explicit apply releases it and requests the same lock exclusively with `ifAvailable`.
   Apply is gated by editor, modal/import/backup, pending mutation, dirty-list,
   play-through, visibility, and BLE session/operation state. A competing tab leaves the
   requester protected until it can reacquire shared admission. Unsupported Web Locks
   retain the waiting worker and direct the user to close and reopen. Controller identity
   is captured across admission; a changed controller blocks the workspace and requires an
   explicit reload. After activation is posted, timeout keeps editing disabled and the
   exclusive lease held until reload or close; only the requesting tab reloads when its
   captured worker controls it.
13. **Future: ML Pipeline** — offline (Python): feature extraction from the catalog →
    training dataset → grade-prediction model. Exports a model for in-browser
    inference (ONNX Runtime Web / WASM); feeds prediction + recommendation features back
    into the app.

## Data Flow

### Intended shared-library boundary

The shared contribution library is not implemented. Its design must distinguish
explicit publication and group updates from browser-local authoring and personal
playlists. It should reuse existing versioned snapshot validation, board-definition
compatibility, renderer/controller composition, and local recovery mechanisms.
The verified [invited-library comparison](../.research/analysis/briefs/invited-offline-library.md)
conditionally recommends an Access-protected Worker API with D1 and retains Supabase
as an alternative. The first access capability must validate the actual account,
hostname, mobile session, and protected API routes before production selection.
The [iOS client comparison](../.research/analysis/briefs/ios-shared-client.md)
recommends proving a Capacitor shell before considering a native-view UI migration.
An isolated [experimental Capacitor shell](../prototypes/ios/README.md) packages the
existing screens under a separate app identity. Its dedicated entry point composes
native BLE and lifecycle plugins, disables PWA generation, and omits service-worker
registration and the update coordinator. The normal browser entry retains update admission.
No production framework is selected. Native compilation and startup are verified on
the iPhone 17 / iOS 27.0 simulator. Synthetic-data startup, scene/lifecycle, safe-area,
focus, and application-update preservation checks passed. A complete backup was
exported through Save to Files, restored from an empty simulator library, and re-exported
to a canonically equal snapshot after relaunch. Real-board BLE, real-device storage
pressure, and authentication remain unverified. The observed startup screenshot showed
status-bar and app-control safe areas without overlap.
Access design
must account for the native origin and session return path; its existing same-origin
web units are held for revision. Native backup delivery encodes UTF-8 JSON into the
app cache and passes a Filesystem URI to Share. Successful sharing removes the cache
copy; cancellation or rejection retains it until the next export preflight because
a nested OS destination may still need the file. Native bootstrap/update integration
still requires explicit adapters or proof, rather than assuming all browser facilities carry over.
The intended boundary uses current membership authorization, explicit retry-safe
publication, stable contribution identities, and immutable source revisions.
Locally retained copies record source provenance without surrendering local ownership;
source updates require explicit acceptance, and withdrawal never deletes personal data.
The static PWA and local repositories remain the client foundation. Existing portable
file imports do not establish ongoing shared identity. No collaboration service is
implemented or provisioned yet.

### Current and established module flows

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
                             Byte transport ──▶ Physical board
                             ├─ Web Bluetooth (PWA)
                             └─ Native BLE (isolated iOS prototype; device proof pending)

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

App runtime ──▶ update coordinator ──▶ prompt-mode Workbox registration
  └──▶ shared admission lock ──▶ workspace safety gates ──▶ exclusive apply ──▶ requester reload
```

Local climb reads and writes are fully offline. Installed catalog reads are local;
manifest metadata and snapshot download require network only after opening Manage and
choosing the explicit download action. No background or automatic source refresh runs.
Only provider adapters and controller transports cross network/device boundaries, so
domain, rendering, browsing, editing, and logging remain testable without hardware
or network.

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
- **Safe update admission.** A waiting worker never activates or reloads a tab on arrival.
  The coordinator protects the lifetime of editing, dialogs, imports, backups, repository
  mutations, list play-through, and BLE sessions/operations, then uses shared Web Locks
  for normal tabs and an exclusive `ifAvailable` lease for explicit apply. Admission and
  controller identity are checked at the version boundary; activation timeout remains
  protected until the user reloads or closes the tab. Browsers without Web Locks use the
  natural waiting lifecycle with close-and-reopen recovery.
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
  service is allowed for the intended invited contribution library or a provider
  constraint demonstrated by research. Any collaboration service owns explicit
  group contributions and necessary access data, not private drafts or playlists.

## Key Dependencies

The architecture's intended dependency set. React, Vite, wa-sqlite, Comlink, and
vite-plugin-pwa are installed; ONNX Runtime Web arrives with its ML feature.

| Dependency                                  | Role                                                                                                                                                                                                           |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React 19 + Vite 6 (TypeScript)              | Client-only SPA framework + build tooling                                                                                                                                                                      |
| `wa-sqlite` (`AccessHandlePoolVFS`)         | In-browser SQLite catalog read path in a Web Worker; catalog IndexedDB fallback is deferred                                                                                                                    |
| Native IndexedDB                            | Independent versioned, atomic, browser-local authorities for climbs (Draft/Finished/Trash lifecycle) and playlist aggregates                                                                                   |
| `vite-plugin-pwa` (Workbox)                 | Service worker + manifest — offline shell and installability; prompt-mode waiting worker consumed by the app-owned update coordinator                                                                        |
| Web Locks API                               | Shared per-tab admission and exclusive, `ifAvailable` update apply coordination                                                                                                                               |
| Web Bluetooth API                           | Explicit Android/desktop Chromium session and Nordic UART writes to the board                                                                                                                                  |
| Capacitor 8.4.3 + BLE 8.3.0 + App 8.1.1      | Isolated iOS prototype only: bundled shared UI, native byte transport, foreground lifecycle; no background BLE mode                                                                                             |
| Playwright                                  | Production-build Chromium smoke for climb lifecycle persistence and responsive editor behavior                                                                                                                 |
| BoardLib (Python)                           | Legacy bootstrap and sync-protocol reference; not a verified current catalog source                                                                                                                            |
| Kilter sync API                             | Legacy protocol reference; current availability and coverage are unverified                                                                                                                                   |
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
- **iOS control and preservation.** The required iPhone client needs proven native
  BLE, local persistence and authentication. Framework documentation does not establish
  board compatibility or storage survival. Retain shared protocol/domain behavior;
  test native lifecycle, export/restore and origin migration without altering the
  existing personal library. Web-only browse mode does not fulfill iPhone control.

## History

- [Original north-star ideation doc (superseded)](architecture/history/north-star.md).

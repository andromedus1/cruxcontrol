---
description: CruxControl capabilities, domain model, constraints, and non-functional requirements
type: planning
kind: planning
updated: 2026-09-05
nav_priority: high
summary: >
  The capability contract for a Kilter-first, multi-board-capable CruxControl:
  local board inventory, provider-aware catalogs, BLE control, climb browsing and
  editing, logbook/session tracking, grade prediction, and recommendations in an
  offline-first client.
decisions:
  - "Capabilities are grouped into nine areas; board control + browser are the MVP surface."
  - "The domain model mirrors the official Kilter SQLite schema (climbs, holes/placements, climb_stats)."
  - "Web Bluetooth constrains the client to Chromium browsers — an accepted constraint, not a defect."
  - "Grade-prediction target is community consensus difficulty_average from climb_stats."
  - "Playlists are a CruxControl-local construct (no Kilter playlist API): local-first, climb-ID-referenced, shareable, board-playable."
  - "Every climb and layout identity is namespaced by provider and immutable board/layout revision; bare vendor IDs never cross domain boundaries."
  - "The Fullride 7x10 is the acceptance board for the first milestone; additional providers are installed on demand."
  - "Android/desktop Chromium provide Web Bluetooth control; iOS direct control is a later native-bridge capability."
  - "Locally authored climbs are unrestricted, browser-authoritative aggregates with Draft/Finished status and recoverable Trash; provider publication validation is a separate future boundary."
  - "Kilter Android Fullride screenshots are analyzed and reviewed locally, then imported as ordinary 40-degree drafts without persisting or uploading source images; exact duplicates, including Trash, are skipped."
  - "Whole-library backup is a bounded local file of saved records; restore is missing-only, identity-preserving, conflict-blocking, and transactional per IndexedDB store."
  - "PWA updates use a waiting Workbox worker and explicit safe apply; shared Web Locks coordinate tabs, and workspace, mutation, play-through, and BLE session gates protect local work before activation."
---

# CruxControl — Specification

This document owns the capability contract: what the system does, the domain it
operates over, and the constraints it must satisfy. The _why_ lives in
[VISION.md](VISION.md); the _how_ lives in [ARCHITECTURE.md](ARCHITECTURE.md).

## Capabilities

### 0. Board Inventory & Setup

- Browse the board models and layout revisions supported by installed providers.
- Configure one or more local board installations: board/layout, supported angle,
  installed hold sets, catalog source, and compatible controller profile.
- Make the active installation explicit throughout browsing, editing, playlists,
  and board control.
- Install or remove provider/layout catalogs independently and show capability
  availability: browse, control, create, publish, import, and sync.

### 1. Board Control (BLE)

- Connect to the active board through a capability-selected controller adapter.
- The first adapter controls the Kilter Fullride 7x10 via Web Bluetooth.
- Light holds for any selected climb through the Nordic UART protocol, selecting API
  level 2 or 3 from the connected controller identity. The existing API-2 controller
  policy is the accepted control profile for the Fullride path.
- Run explicit, bounded Fullride capacity cases from the editor with exact packet/write
  estimates, stop/timeout recovery, operator observations, and private local JSON trace
  export. No diagnostic runs automatically and no trace is uploaded.
- Enforce the accepted Android/API-2 physical profile without changing saved designs:
  static scenes use 20 ms write pacing and stop at 127 total lights; animations resend
  complete scenes, use at most 20 total lights at 2 FPS, and slow or stop when recent
  frame latency exceeds that cadence. Omitted lights never act as persistent sparse
  deltas on this controller path. The editor reports scene packet/write cost and warns
  instead of truncating route, decoration, or effect assignments.
- Support the four user-facing Kilter role colors: Start (green), Middle (blue),
  Finish (red/pink), and Foot-only (gold/yellow), plus all 256 packed 3/3/2-bit
  hardware colors. Provider/source protocol RGB values remain preserved separately.
- Handle framing, checksums, 16-bit LED positions, multi-packet scenes, and bounded
  20-byte writes for climbs with many holds.
- Keep connection, reconnect, disconnect, light, clear, and latest-frame-wins preview
  behavior behind a typed controller/transport boundary.

### 2. Climb Browser

- Fast, responsive browsing of the active board's installed community catalog.
- Filtering: grade range, angle, quality, ascent count, setter, hold count,
  grade-consensus accuracy.
- Add shareable URLs for individual/provider climbs with future catalog browsing;
  current portable sharing is implemented for playlists through fragments or files.
- Visual 2D board renderer showing recognizable hold artwork, positions, semantic role
  shapes, and custom colors with pointer and roving-keyboard interaction. The private
  Fullride prototype uses one immutable calibrated Kilter reference-image underlay;
  independently authored schematic SVG holds remain the complete loading/error,
  non-matching-definition, and distributable fallback.
- The generated immutable Fullride 7x10 definition contains 305 controllable Mainline
  and Auxiliary placements. Renderers consume its geometry and identities rather than
  hard-coded vendor coordinates.

### 3. Route Creation & Editing

- Visual editor: create climbs by tapping holds on the board diagram.
- Assign roles (start / middle / finish / foot-only), erase holds, or select any exact
  packed hardware color per hold.
- Save empty, incomplete, unconventional, semantic, or custom-color drafts locally;
  no provider role-count or metadata validity rule gates local saving or lighting.
- Autosave coalesces edits behind optimistic revisions. Storage failures remain dirty
  and retryable; conflicts offer reload-stored or save-a-copy recovery without silent
  overwrites.
- Explicit Light Draft and opt-in, default-off Live Preview reuse the board controller.
- Add editable assignment effects and independent spatial background presets: Ocean Tide,
  Tie-dye Spiral, Matrix Rain, Snake, Beach Ball, Pac-Man, Pong, Bird Flock,
  a fading circled inverted pentagram, Curious Bumblebee, Fireflies, Shooting Stars,
  Jellyfish, and Embers. All fourteen available presets use version-2, closed themed
  trajectories with 90–150-second defaults. Fireflies, Shooting Stars, Jellyfish, and
  Embers default to 120 seconds and reserve 8, 6, 9, and 10 lights respectively. These
  four presets are v2-only and use the shared palette, period, intensity, light reserve,
  and target controls without additional shape settings. Bumblebee is also v2-only:
  it provides a seeded six-stop, 120-second tour with hover, flight, and dart phases plus
  independently editable Body and Wings palette slots; malformed or version-1 bee recipes
  are rejected by the strict codecs. Frogger is retired from the Add a preset picker;
  existing version-1 and version-2 Frogger recipes remain editable, playable, and importable.
  Version-1 saved recipes remain on their
  original renderer until the user explicitly upgrades them; an upgrade preserves the
  authored settings and changes only the recipe version and period to the maximum of
  the old period and the new preset default. Presets default to unused holds, can target
  the board background or a painted selection, persist complete recipe snapshots, and
  always keep semantic climb roles exact and static.
- Matrix Rain v2 uses aligned vertical trails with bright heads, fading tails, and
  staggered falls separated by dark gaps. Its ten-light default supports up to three
  simultaneous trails, sharing the reserve as 4/3/3. The Columns setting defines the
  pool of fall lanes; new Matrix groups default to three columns and 90 seconds.
  Saved v2 Matrix groups use this renderer without migration or changes to stored
  palettes, periods, identities, reserves, targets, or other authored settings.
  Version-1 Matrix rendering remains unchanged.
- Version-2 spatial rendering prepares geometry per board definition and reuses the
  latest held frame and prepared paths per effect group. Decorative colors are adjusted
  after API-2 quantization to avoid exact encoded role colors and encoded black; this is
  an encoded-byte invariant, not a perceptual color-distinction guarantee. Zero-intensity
  spatial groups emit dark/empty scenes, and intentionally empty animation frames remain
  part of playback until an explicit stop, clear, disconnect, or visibility cancellation.
  Stable tide and spiral target samples carry color bands and geometry through loop joins;
  actor ordering remains coherent in reverse paths, and Pong plans each paddle to its own
  wall contact. A direct clear explicitly cancels playback, while an empty animated frame
  is sent as preview and does not cancel the animation.
- Physical animation preflights route/static lights plus every spatial layer's declared
  worst-case reserve before the first write. API-2 playback refuses plans above 20 lights
  with a breakdown; it never thins a saved design. Screen preview and saving remain unrestricted.
  Browser animation playback is foreground-only and stops when the page becomes hidden.
- Import Kilter Android Fullride screenshots through an on-device detection and review
  flow. Users can correct detected holds and roles before confirmation; confirmed
  climbs enter the existing local lifecycle as ordinary drafts at 40°.
- Screenshot pixels remain transient and are never persisted or uploaded. The supplied
  16-climb migration is built from checksum-linked titles and definition-derived
  role/placement facts, without bundling source pixels. Imports skip exact hold/role
  duplicates already present in either active storage or Trash.
- Publishing to the Kilter community is deferred until its current authentication and
  API contract are freshly researched; it is not part of local draft validity.

### 4. Logbook & Session Tracking

- Log ascents and attempts with grade votes and quality ratings.
- Session mode: track attempts across a session with real-time stats.
- Full logbook history with search and analytics.
- Logbook stored locally; optional sync to the Kilter API.

### 5. Grade Prediction (ML)

- Predict climb difficulty from hold placements, roles, and board angle.
- Features: hold positions (x, y), roles, hold count, wall angle, spacing/distances.
- Target: community consensus grade (`difficulty_average` from `climb_stats`).
- Use cases: grade unclimbed routes, flag sandbagged/soft routes (predicted vs
  actual divergence), recommend routes at a target difficulty.

### 6. Data Acquisition & Training Pipeline

- Sync the Kilter catalog via the documented sync API (`POST /sync`),
  bootstrapped with BoardLib (`boardlib database kilter kilter.db`).
- Collect climbs + frames, `climb_stats` per angle, hold coordinates
  (`holes`), and placement→hole→LED mappings.
- Incremental sync via `shared_syncs` timestamps.
- Pipeline: SQLite → feature extraction → training dataset → model.
- Add providers independently through import/sync adapters. Each import records
  source, retrieval time, provider-native identity, layout revision, and policy
  metadata; user data requires an explicit export or authorization flow.
- Preserve source-native payloads and grades alongside normalized query fields.
- Install catalogs per provider/layout on demand rather than bundling a universal DB.

### 7. Personalized Training & Recommendations

- Recommend climbs by grade range, preferred style, and progression.
- Circuit generation: auto-build a session of N climbs at target grades.
- Weakness detection: which hold types/positions the user struggles with.
- Progressive overload: suggest slightly harder versions of sent climbs.

### 8. Playlists (Curated Climb Lists)

- Create named, hand-picked, **manually reorderable** lists of climbs.
- A playlist is a CruxControl-local construct (Kilter has no playlist concept);
  it stores ordered, unique references to either stable browser-local climb IDs or
  namespaced provider + layout revision + source climb IDs.
- Draft and Finished climbs may belong to multiple lists. Trash, catalog absence,
  or permanent climb deletion leaves an explicit unavailable reference in place
  until the user removes it; restoring a local climb resolves the same membership.
- Export a playlist through a bounded shareable URL fragment when it fits and through
  a complete JSON file for every valid list. Resolvable browser-local memberships are
  immutable climb snapshots without local IDs, revisions, installation identity, or
  Trash state; provider memberships remain namespaced references.
- Import URL and file payloads through the same strict compatibility preview with no
  writes before confirmation. Confirmation creates a fresh list and fresh local climb
  copies in exact order, never overwrites existing records, and retains unresolved
  provider references with an explicit warning.
- **Play-through on the board:** when connected, step through the playlist
  climb-by-climb, lighting each in turn. Without a board connection the playlist
  is still fully usable for browsing/sharing.
- Distinct from auto-generated circuits (Capability 7, algorithmic) and from
  session tracking (Capability 4, logging attempts).

## Domain Model

The model mirrors the official Kilter SQLite schema (see
[briefs/data-model.md](briefs/data-model.md)):

- **Climb** — a problem/route; holds + roles encoded as a `frames` string.
- **Hold / Placement / Hole** — a physical hold position; `holes` carries (x, y)
  coordinates; placements map holds to LEDs per layout.
- **Role** — start / middle / finish / foot-only, with display colors.
- **Layout / Product / Size** — the Fullride 7x10 layout and its hold sets.
- **ClimbStats** — per-angle community stats: `difficulty_average`,
  `benchmark_difficulty`, `ascensionist_count`, `quality_average`.
- **Ascent / Bid** — logged sends and attempts (auth-gated for personal data).
- **Session** — a grouping of attempts/ascents over a single board session.
- **Playlist** — a CruxControl-local, user-named, ordered list of climb
  references (by stable browser-local ID or namespaced provider + layout revision +
  source climb ID), with notes and optimistic revision identity; shareable and
  board-playable. Not a Kilter schema entity.

- **BoardDefinition** — vendor/model/layout revision, geometry, placements, roles,
  angle rules, grade systems, and controller-compatible LED mapping.
- **BoardInstallation** — a user's configured physical board bound to one immutable
  definition and zero or more compatible provider/controller adapters.
- **ProviderClimbId** — provider namespace + source climb ID + layout revision; the
  stable cross-module identity for climbs, links, logbook entries, and playlists.
- **CatalogProvenance** — source, retrieval time, native payload/version, and usage
  constraints retained with imported data.
- **LocalClimbDraft** — a schema-versioned, installation- and layout-revision-bound
  browser aggregate with stable local identity, optimistic revision, unrestricted
  metadata and hold assignments, Draft/Finished status, recoverable deletion metadata,
  and an exact semantic/custom appearance distinction.

## Current Fullride Local Milestone

- The application composes one configured Fullride 7x10 installation with the
  generated 305-placement definition, one calibrated private reference-image artwork
  layer with a dark high-contrast LED backdrop and definition-driven schematic fallback,
  My Climbs/Drafts/Trash/Lists
  workspace, route editor, and Web Bluetooth controller. The private artwork does not
  imply redistribution permission: public distribution requires Kilter's permission
  or replacement with redistributable imagery.
- Locally authored climbs are authoritative in a dedicated native IndexedDB database,
  survive reload/reopen, move between Draft and Finished without content validation,
  and remain in Trash until the user explicitly chooses Delete forever. Definition/layout/
  angle/placement incompatibility is surfaced while retaining the stored record unchanged. Drafts remain
  in their dedicated workspace rather than appearing in the finished My Climbs library.
- The Drafts workspace can import selected Kilter Android Fullride PNGs sequentially,
  review and correct each detected climb, and save confirmed results as ordinary 40°
  drafts. It also exposes the pixel-free built-in migration for the supplied 16 climbs.
  Decoded bitmap/canvas resources are released after local analysis; selected File
  references and object-URL title evidence are released when review closes. None are
  persisted or uploaded, and exact duplicates are skipped across active climbs and Trash.
- Flexible lists are authoritative in a separate versioned native IndexedDB database.
  Their ordered references survive reload, allow one climb in multiple lists, and
  resolve Trash or missing climbs without rewriting membership rows. Exact-order
  play-through keeps navigation position ephemeral, remains browsable while
  disconnected, and lights only through the existing explicit controller action.
  Portable sharing uses a versioned local-snapshot/provider-reference envelope with
  bounded fragment links and lossless files. Import previews compatibility before any
  write, creates fresh identities, and compensates created climb copies if list
  creation fails.
- Whole-library backup and restore are available from the library workspace for saved
  contents only. A version-1 local JSON file includes every climb across installations,
  including orphan records and Trash, plus every playlist, ordered shared membership,
  stable ID, revision, lifecycle timestamp, metadata, and saved effect recipe. Its limits
  are 25 MiB UTF-8, 10,000 climbs, 1,000 playlists, and 100,000 playlist references.
  Export performs a bounded stability check across the independent stores and asks users
  to finish edits in other tabs; it is not a cross-database atomic snapshot. Restore
  reviews the complete file first, adds missing IDs, skips canonically identical IDs, and
  blocks any differing ID without overwriting or allocating replacement IDs. Each store
  commits in its own transaction and aborts that store on error; a playlist failure can
  therefore follow a committed climb batch and is reported for honest retry with the
  retained file. The workflow uses the existing browser-local databases and origin for
  saved contents only; it does not rewrite schemas or upload to a cloud/account service.
  Trash remains until explicit Delete forever.
- The installable PWA precaches the app shell with Workbox and owns registration through an
  update coordinator configured for prompt-mode workers (`skipWaiting: false`,
  `clientsClaim: false`, and no injected registration helper). A waiting worker never
  reloads the app automatically. The persistent update surface offers Update and reload,
  Later, and status; Later hides the prominent prompt while retaining an accessible update
  entry. Explicit apply is admitted only when the editor and all list/import/backup/modal
  work are settled, no local mutation is pending, no list is dirty or playing through, and
  the board is not selecting, connecting, connected, disconnecting, or performing an
  operation. The app holds a shared Web Lock for each tab and uses an exclusive
  `ifAvailable` request for apply, so another tab blocks with a close-other-tabs message.
  If Web Locks are unavailable, the worker remains waiting and the user is told to close
  and reopen. A controller change while a tab is being admitted, or activation that does
  not complete after posting, leaves the workspace blocked with an explicit reload/close
  recovery action. Only the requesting tab reloads after its captured worker becomes the
  controller.
- The editor is responsive at Android-phone and desktop Chromium widths, autosaves edits,
  retains explicit lighting actions, and exposes named keyboard-operable controls and
  non-color-only role markers.
- Deterministic tests cover definition/renderer, climb and playlist
  persistence/concurrency/recovery and screenshot recognition/review/import,
  API-level-2/3 bytes, the existing API-2 capacity policy, Bluetooth lifecycle,
  lighting/preview, and the integrated
  create-save-light seams. Playwright Chromium covers autosave/reload/reopen,
  multi-list membership/order, Trash/restore resolution, ephemeral play-through, and
  portable list export/import with fresh identities and preserved content/order, plus
  compact/wide interaction. A real three-generation Workbox browser fixture verifies the
  same-origin A→B→C transition, including natural waiting with legacy A, explicit safe
  apply from B, and climb identity/content persistence across both updates.
- The existing local draft schema remains version 4 and the portable playlist envelope
  remains unchanged; embedded effect recipe versions carry this evolution without a
  storage or playlist migration. Deterministic tests cover v1 compatibility, v2 cycle
  closure, masks, role protection, color encoding, cache reuse, empty-frame playback,
  Bumblebee Body/Wings editing, reverse actor ordering, and Pong contacts.

## Constraints & Non-Functional Requirements

- **Browser support.** Direct Web Bluetooth control runs in supported Android and
  desktop Chromium browsers (Chrome/Edge); other browsers can browse but not drive
  the board.
- **Offline-first.** Local drafts already create, edit, and reopen without network.
  The catalog and logbook must likewise be usable from local storage when their
  milestones ship.
- **Kilter-first acceptance scope.** The Fullride 7x10 is the first end-to-end
  acceptance board. Core identities and ports support multiple boards, but other
  providers do not block that milestone.
- **Data ownership.** Locally authored climbs are browser-authoritative today. The logbook will
  likewise be locally authoritative; Kilter sync remains optional and reversible.
- **Protocol fidelity.** BLE packets implement framing, checksums, and packet splitting
  for the controller-selected API level 2 or 3 (see
  [briefs/hardware-and-protocol.md](briefs/hardware-and-protocol.md)).
- **Reproducible pipelines.** Catalog sync and model training must re-run as the
  catalog grows — not one-off scripts.
- **Distributable PWA.** The app is built for static, hosted, installable PWA
  distribution so a friend can open it from a URL after deployment is configured,
  with no per-user setup and no backend. Each user runs an
  independent client with browser-local data; there is no shared server or accounts.
  Distribution robustness — stable across mainstream Chromium browsers/devices,
  installable, trivially hostable on static infra (Cloudflare Workers Static Assets) — is a hard
  requirement; it was the criterion by which the framework (React + Vite) was chosen.
- **Per-user isolation.** One user's local data (logbook, playlists, drafts) is never
  visible to another. Current playlist sharing is explicit through bounded URL fragments
  or lossless files; individual/provider climb URLs arrive with future catalog browsing.
- **Provider policy.** Acquisition uses public or user-authorized sources and does
  not bypass access controls. Import capability and redistribution are separate
  decisions recorded per provider.
- **Mobile capability.** Responsive local browsing and editing work on modern phones;
  logging must do the same when its future milestone ships. Direct BLE control
  requires Web Bluetooth (Android Chromium) or a future native iOS CoreBluetooth
  bridge; unsupported transports degrade explicitly to browse-only.

---
description: CruxControl capabilities, domain model, constraints, and non-functional requirements
type: planning
kind: planning
updated: 2026-06-13
nav_priority: high
summary: >
  The capability contract for CruxControl: board control over BLE, a fast climb
  browser with shareable URLs, a visual route editor, a logbook with session
  tracking, ML grade prediction, a data-acquisition/training pipeline, and
  personalized recommendations — over a local SQLite catalog synced from the
  Kilter API, on a Web Bluetooth (Chrome/Edge) offline-first web app.
decisions:
  - "Capabilities are grouped into eight areas; board control + browser are the MVP surface."
  - "The domain model mirrors the official Kilter SQLite schema (climbs, holes/placements, climb_stats)."
  - "Web Bluetooth constrains the client to Chromium browsers — an accepted constraint, not a defect."
  - "Grade-prediction target is community consensus difficulty_average from climb_stats."
  - "Playlists are a CruxControl-local construct (no Kilter playlist API): local-first, climb-ID-referenced, shareable, board-playable."
---

# CruxControl — Specification

This document owns the capability contract: what the system does, the domain it
operates over, and the constraints it must satisfy. The *why* lives in
[VISION.md](VISION.md); the *how* lives in [ARCHITECTURE.md](ARCHITECTURE.md).

## Capabilities

### 1. Board Control (BLE)
- Connect to the Kilter Board via the Web Bluetooth API.
- Light up holds for any selected climb using the Nordic UART protocol (API level 3).
- Support the full color role system: Start (green), Middle (cyan), Finish
  (magenta), Foot-only (orange).
- Handle multi-packet messages for climbs with many holds.

### 2. Climb Browser
- Fast, responsive browsing of the full Kilter climb catalog.
- Filtering: grade range, angle, quality, ascent count, setter, hold count,
  grade-consensus accuracy.
- Shareable URLs for individual climbs (a major gap in the official app).
- Visual 2D board renderer showing hold positions and roles.
- Fullride 7x10 layout specifically (Mainline + Auxiliary sets).

### 3. Route Creation & Editing
- Visual editor: create climbs by tapping holds on the board diagram.
- Assign roles (start / middle / finish / foot-only) per hold.
- Publish climbs to the Kilter Board API; save drafts locally.

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

### 7. Personalized Training & Recommendations
- Recommend climbs by grade range, preferred style, and progression.
- Circuit generation: auto-build a session of N climbs at target grades.
- Weakness detection: which hold types/positions the user struggles with.
- Progressive overload: suggest slightly harder versions of sent climbs.

### 8. Playlists (Curated Climb Lists)
- Create named, hand-picked, **manually reorderable** lists of climbs.
- A playlist is a CruxControl-local construct (Kilter has no playlist concept);
  it references climbs by stable Kilter climb ID so a shared playlist resolves
  against any local catalog.
- Shareable URL per playlist (like shareable climb URLs).
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
  references (by stable Kilter climb ID); shareable and board-playable. Not a
  Kilter schema entity.

## Constraints & Non-Functional Requirements

- **Browser support.** Web Bluetooth limits the client to Chromium browsers
  (Chrome/Edge); other browsers can browse but not drive the board.
- **Offline-first.** The catalog and logbook must be usable without network;
  load must be instant from local storage.
- **Single-board scope.** The Fullride 7x10 layout is the target; the schema is
  general but the UI/renderer targets this layout.
- **Data ownership.** The logbook is the source of truth locally; Kilter sync is
  optional and reversible.
- **Protocol fidelity.** BLE packets must implement framing, checksums, and
  multi-packet splitting exactly per API level 3 (see
  [briefs/hardware-and-protocol.md](briefs/hardware-and-protocol.md)).
- **Reproducible pipelines.** Catalog sync and model training must re-run as the
  catalog grows — not one-off scripts.
- **Distributable PWA.** The app ships as a static, hosted, installable PWA that a
  friend can open from a URL with no setup and no backend. Each user runs an
  independent client with browser-local data; there is no shared server or accounts.
  Distribution robustness — stable across mainstream Chromium browsers/devices,
  installable, trivially hostable on static infra (Cloudflare Pages) — is a hard
  requirement; it was the criterion by which the framework (React + Vite) was chosen.
- **Per-user isolation.** One user's local data (logbook, playlists, drafts) is never
  visible to another; sharing is explicit and URL-based (climbs, playlists).

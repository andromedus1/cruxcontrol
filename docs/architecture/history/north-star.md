---
description: Original combined ideation doc for CruxControl — superseded by VISION/SPEC/ARCHITECTURE
type: historical
kind: historical
updated: 2026-06-13
superseded_by: [VISION.md, SPEC.md, ARCHITECTURE.md]
summary: >
  The original north-star document that combined vision, capabilities, proposed
  architecture, and a phased roadmap. Its content has been split into the
  rolling-foundation docs (VISION.md, SPEC.md, ARCHITECTURE.md) and its Phase 0–3
  roadmap migrated to epic items in .work/. Retained for provenance; do not edit.
---

# CruxControl -- North Star Document

## Vision

CruxControl is a custom app to control a home Kilter Board Fullride 7x10. It replaces the sluggish, feature-limited official Kilter Board app with a fast, extensible, web-based alternative that adds intelligent features like grade prediction and personalized training.

## Owner

Andrew Clark -- home Kilter Board Fullride 7x10 owner.

---

## Core Goals

### 1. Board Control (BLE)
- Connect to the Kilter Board via Web Bluetooth API (BLE)
- Light up holds for any selected climb using the documented Nordic UART protocol (API level 3)
- Support the full color role system: Start (green), Middle (cyan), Finish (magenta), Foot-only (orange)
- Handle multi-packet messages for climbs with many holds

### 2. Climb Browser
- Fast, responsive UI for browsing the full Kilter Board climb database
- Powerful filtering: grade range, angle, quality, ascent count, setter, hold count, grade consensus accuracy
- Shareable URLs for individual climbs (a major gap in the official app)
- Visual board renderer showing hold positions and roles on a 2D board representation
- Support for the Fullride 7x10 layout specifically (layout + sets: Mainline + Auxiliary)

### 3. Route Creation & Editing
- Visual editor to create new climbs by tapping holds on the board diagram
- Assign roles (start/middle/finish/foot-only) to each hold
- Publish climbs to the Kilter Board API
- Save drafts locally

### 4. Logbook & Session Tracking
- Log ascents and attempts with grade votes and quality ratings
- Session mode: track attempts across a session, see stats in real-time
- Full logbook history with search and analytics
- Data ownership: logbook stored locally, synced to Kilter API optionally

### 5. Grade Prediction (ML)
- **Train a model to predict climb difficulty** from hold placements, roles, and board angle
- Input features: hold positions (x, y coordinates), hold roles, number of holds, wall angle, hold spacing/distances
- Target: community consensus grade (difficulty_average from climb_stats)
- Potential approaches:
  - Graph neural network (holds as nodes, possible moves as edges)
  - CNN on a 2D board image representation
  - Sequence model on the ordered placement list
  - Gradient boosted trees on engineered features (move distances, hold density, average height, etc.)
- Use cases:
  - Predict grade for newly created routes before anyone climbs them
  - Identify "sandbagged" or "soft" routes (predicted vs actual grade divergence)
  - Recommend routes at a target difficulty
- Training data: the full climb database with climb_stats grades (tens of thousands of climbs with community consensus)

### 6. Data Acquisition & Training Pipeline
- **Scrape/sync the Kilter Board database** using the documented sync API (`POST kilterboardapp.com/sync`)
- Use BoardLib (Python) to bootstrap the SQLite database: `boardlib database kilter kilter.db`
- Key data to collect:
  - All climbs with frames strings (hold placements + roles)
  - climb_stats for all angles (difficulty_average, benchmark_difficulty, ascensionist_count, quality_average)
  - Hold coordinate data (holes table: x, y positions)
  - Placement-to-hole-to-LED mappings
  - Ascent/bid data (requires auth) for personalized features
- Incremental sync: use the shared_syncs timestamps to keep the local DB up to date
- Data pipeline: SQLite -> feature extraction -> training dataset -> model
- Consider HuggingFace datasets (Vilin97/KilterBoard, stfamod/Kilter-Board-Dataset) as starting points

### 7. Personalized Training & Recommendations
- Recommend climbs based on user's grade range, preferred style, and progression
- Circuit generation: auto-build a session of N climbs at target grades
- Weakness detection: analyze which hold types/positions the user struggles with
- Progressive overload: suggest slightly harder versions of climbs the user has sent

---

## Technical Architecture (Proposed)

### Platform: Web App
- **Why web**: Web Bluetooth API enables BLE from the browser, no native app install needed, shareable URLs, works on any device with Chrome/Edge
- Framework: TBD (React, SvelteKit, or similar)
- Offline-first: service worker + local SQLite (sql.js or OPFS-backed) for instant load

### Data Layer
- Local SQLite database synced from Kilter Board API
- Schema matches the official app's database (see primer-data-model.md)
- Sync engine using the documented `POST /sync` protocol

### BLE Layer
- Web Bluetooth API for board communication
- Implement the full packet protocol: framing (0x01/0x02/0x03), checksums, multi-packet splitting
- Target API level 3 (3 bytes per hold, 16-bit positions, 256 colors)
- Service UUID: `4488B571-7806-4DF6-BCFF-A2897E4953FF` (discovery)
- Write characteristic: `6E400002-B5A3-F393-E0A9-E50E24DCCA9E` (Nordic UART RX)

### ML Pipeline
- Python backend or standalone training pipeline
- Data from local SQLite database
- Model serving: ONNX.js or TensorFlow.js for in-browser inference, or a lightweight API

---

## Key Open-Source Resources

| Project | What We Get From It |
|---------|-------------------|
| **BoardLib** (Python) | Database download, sync protocol implementation, reference for API interactions |
| **Climbdex** (Python/web) | Search engine reference, SQL query patterns, board rendering approach |
| **fake_kilter_board** (ESP32) | BLE protocol documentation, packet format reference |
| **Grip Connect** (TypeScript) | BLE library reference, LED command API |
| **HuggingFace datasets** | Pre-processed ML training data |

---

## Development Phases

### Phase 0: Foundation
- [ ] Set up project scaffolding (web app framework, build tooling)
- [ ] Download and explore the Kilter Board SQLite database via BoardLib
- [ ] Verify database schema matches documentation in primer-data-model.md

### Phase 1: View & Connect
- [ ] Board renderer: display the Fullride 7x10 layout with all hold positions
- [ ] Climb browser: load climbs from local SQLite, filter by grade/angle
- [ ] BLE connection: scan, connect, and send LED commands to the board
- [ ] Light up a selected climb on the physical board

### Phase 2: Full App
- [ ] Route creation/editor
- [ ] Logbook and session tracking
- [ ] Shareable climb URLs
- [ ] Sync engine (incremental updates from Kilter API)

### Phase 3: Intelligence
- [ ] Data pipeline: extract features from climb database
- [ ] Grade prediction model: train, evaluate, iterate
- [ ] In-browser inference for grade prediction on new routes
- [ ] Personalized recommendations and circuit generation

---

## Reference Documents

- [primer-hardware-and-protocol.md](primer-hardware-and-protocol.md) -- Board hardware, BLE protocol, LED system, angle adjustment
- [primer-data-model.md](primer-data-model.md) -- Database schema, frames encoding, grading, sync API
- primer-open-source.md -- Open-source ecosystem (TBD, research in progress)

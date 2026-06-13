---
description: CruxControl vision, problem, audience, principles, and non-goals
type: planning
kind: planning
updated: 2026-06-13
nav_priority: high
summary: >
  CruxControl is a fast, data-owning, web-based replacement for the official
  Kilter Board app, targeting a home Fullride 7x10. It adds intelligence the
  official app lacks — ML grade prediction, personalized training, and
  shareable climbs — while keeping the climber's data local and portable.
decisions:
  - "Web app (not native) so Web Bluetooth, shareable URLs, and cross-device use come for free."
  - "Data ownership is a first principle: the logbook lives locally, sync to Kilter is optional."
  - "Scope is the Fullride 7x10 specifically — not a multi-board, multi-tenant product."
  - "ML grade prediction is the headline differentiator, not a nice-to-have."
---

# CruxControl — Vision

## Vision

CruxControl is a custom app to control a home Kilter Board Fullride 7x10. It
replaces the sluggish, feature-limited official Kilter Board app with a fast,
extensible, web-based alternative that adds intelligent features like grade
prediction and personalized training.

## The Problem

The official Kilter Board app is the only first-party way to drive the board,
and it has real gaps:

- **Slow.** Browsing and filtering the climb catalog is sluggish.
- **Fragile data ownership.** The 2025 app transition lost user data; there is
  no first-class export and no public API.
- **No shareable URLs.** There is no way to link a specific climb to a friend.
- **No intelligence.** No grade prediction for unclimbed routes, no sandbag
  detection, no personalized recommendations or circuit generation.

The board hardware and its data model are well understood by the community
(documented BLE protocol, a downloadable SQLite catalog, a sync API), so a
better client is buildable without first-party cooperation.

## Who It's For

Andrew Clark — owner of a home Kilter Board Fullride 7x10. The first and primary
user is the owner of a single home board. The design optimizes for that case
rather than a commercial, multi-tenant audience.

## Principles

- **Data ownership first.** The climber's logbook is local and portable; syncing
  to the Kilter API is optional, never required.
- **Fast by default.** Offline-first, instant load, responsive browsing — the
  official app's biggest weakness is the bar to clear.
- **Data-driven over hand-curated.** Where a data source exists (the Kilter
  catalog, sync API), build a pipeline rather than curate by hand.
- **Intelligence is core.** Grade prediction and personalized training are
  defining features, designed in from the architecture, not bolted on.
- **Web platform.** Web Bluetooth makes a no-install, shareable, cross-device
  client possible — lean into it.

## Non-Goals

- **Not a commercial / multi-tenant product.** No accounts system, billing, or
  hosting other people's boards (at least not initially).
- **Not multi-board at the start.** The Fullride 7x10 layout is the target;
  other Aurora boards (Tension, Decoy, etc.) share the platform but are out of
  initial scope.
- **Not a replacement for the Kilter social graph.** CruxControl reads the
  public catalog and optionally syncs; it does not try to reproduce Kilter's
  community/social features.
- **Not native mobile.** A web app on Chrome/Edge is the delivery vehicle; no
  iOS/Android native builds.

## Reference

- [SPEC.md](SPEC.md) — capabilities, domain model, constraints
- [ARCHITECTURE.md](ARCHITECTURE.md) — modules, data flow, dependencies, risks
- [briefs/hardware-and-protocol.md](briefs/hardware-and-protocol.md) — board + BLE protocol
- [briefs/data-model.md](briefs/data-model.md) — schema, frames encoding, sync API

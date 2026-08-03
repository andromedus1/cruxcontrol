---
description: CruxControl vision, problem, audience, principles, and non-goals
type: planning
kind: planning
updated: 2026-08-02
nav_priority: high
summary: >
  CruxControl is a Kilter-first, eventually universal climbing-board app. Its
  first complete vertical slice controls a home Fullride 7x10, while its domain,
  catalog, and controller boundaries allow other boards to be added without
  surrendering offline use, data ownership, or source fidelity.
decisions:
  - "Web app (not native) so Web Bluetooth, shareable URLs, and cross-device use come for free."
  - "Data ownership is a first principle: the logbook lives locally, sync to Kilter is optional."
  - "The Fullride 7x10 is the first complete milestone; one app for any supported climbing board is the long-term north star."
  - "Board definitions, catalog providers, and controller protocols are independent extension points."
  - "Imports may use public or user-authorized sources; access and redistribution constraints are enforced per provider."
  - "Static/backendless remains the default, with a narrow service allowed later only where a provider or collaboration capability requires it."
  - "ML grade prediction is the headline differentiator, not a nice-to-have."
  - "Distributed to friends as a static, installable PWA — no backend, no accounts; each user runs their own client with local data. Framework chosen for distribution robustness."
---

# CruxControl — Vision

## Vision

CruxControl is a data-owning climbing-board app whose first complete target is a
home Kilter Board Fullride 7x10. Its implemented first milestone creates, saves,
reopens, and lights unrestricted browser-local climbs through a fast, offline-first
client; organizes them into shareable lists; and supports locally reviewed screenshot
imports and editable light effects. Community-catalog browsing, logging results, grade
prediction, and personalized training extend that wall-session loop in later milestones.

The longer-term north star is one app for any supported Bluetooth climbing board,
with each board community's climbs available through source-aware catalog adapters.
Kilter-first is a delivery order, not a permanent architectural constraint.

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
(documented BLE protocol, downloadable catalogs, sync APIs, and open-source
clients), so a better client is buildable. The 2026 Kilter/Aurora transition and
the existence of multi-board clients also show why portable user data and
provider-independent contracts matter.

## Who It's For

Andrew Clark — owner of a home Kilter Board Fullride 7x10 — and a small circle of
**friends he intends to distribute the app to**. Each user runs their own client
against their own Kilter board and keeps their own local data. Local playlists are
already portable by bounded URL or lossless file; provider climb URLs remain future
catalog work. The design begins with this
"distribute to friends" case: an installable PWA built for static hosting once the
deployment setup and acceptance checks are complete. It is not initially a commercial,
server-backed, multi-tenant product. Supporting more board types broadens the
hardware and catalog surface, not the initial operating model.

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
- **Distributable by default.** The app is built as a hosted, installable PWA a
  friend can open from a URL once deployment is configured — no per-user setup, no backend. Robustness for
  distribution (stability across browsers/devices, easy install, no server to
  operate) is a first-class principle — and the criterion by which the framework
  (React + Vite) was chosen.
- **Kilter-first, not Kilter-bound.** Finish one excellent Fullride 7x10 path
  before widening implementation, while keeping identities and edge contracts
  safe for multiple boards from the start.
- **Source fidelity and provenance.** Preserve provider-native identifiers,
  grades, payloads, and attribution. Normalize for a consistent experience without
  pretending different board communities are interchangeable.
- **Authorized portability.** Import public catalogs and data the user is allowed
  to export or authorize. Do not bypass access controls or assume public access
  grants redistribution rights.

## Non-Goals

- **Not a server-backed / multi-tenant product.** The app is designed for
  distribution to friends as a static, hosted PWA, but there is no backend: no accounts, no
  billing, no server-side user data, no hosting of other people's boards. Each
  user's data stays in their own browser.
- **Not simultaneous board rollout.** The Fullride 7x10 remains the first complete
  product milestone. Other Aurora boards and MoonBoard follow through separately
  researched adapters rather than delaying the Kilter path.
- **Not a replacement for the Kilter social graph.** Future catalog adapters will read
  authorized public catalog data and may optionally sync; those capabilities are not
  implemented yet and will not reproduce Kilter's community/social features.
- **Not native mobile.** A web app on Chrome/Edge is the delivery vehicle; no
  native app is required for the first milestone. Android and desktop Chromium can
  control boards; iPhone/iPad are browse/edit capable but need a later native
  CoreBluetooth bridge for direct control.

## Reference

- [SPEC.md](SPEC.md) — capabilities, domain model, constraints
- [ARCHITECTURE.md](ARCHITECTURE.md) — modules, data flow, dependencies, risks
- [briefs/hardware-and-protocol.md](briefs/hardware-and-protocol.md) — board + BLE protocol
- [briefs/data-model.md](briefs/data-model.md) — schema, frames encoding, sync API

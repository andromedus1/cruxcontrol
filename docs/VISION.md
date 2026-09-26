---
description: CruxControl vision, problem, audience, principles, and non-goals
type: planning
kind: planning
updated: 2026-09-26
nav_priority: high
summary: >
  CruxControl is a Kilter-first, eventually universal climbing-board app. Its
  first complete vertical slice controls a home Fullride 7x10, while its domain,
  catalog, and controller boundaries allow other boards to be added without
  surrendering offline use, data ownership, or source fidelity. The next milestone
  shares explicitly contributed climbs within an invited circle.
decisions:
  - "Web app (not native) so Web Bluetooth, shareable URLs, and cross-device use come for free."
  - "Data ownership is a first principle: the logbook lives locally, sync to Kilter is optional."
  - "The Fullride 7x10 is the first complete milestone; one app for any supported climbing board is the long-term north star."
  - "Board definitions, catalog providers, and controller protocols are independent extension points."
  - "Imports may use public or user-authorized sources; access and redistribution constraints are enforced per provider."
  - "Static/backendless remains the default, with a narrow service allowed later only where a provider or collaboration capability requires it."
  - "Shared contributed climbs are the next major addition; community catalogs and a logbook precede longer-term grade prediction and personalized training."
  - "The installable PWA keeps private authoring and playlists local; an invited shared library may use a narrow, research-grounded collaboration service."
  - "Invited partner and friends can publish explicit submissions immediately to their group; Android board control is sufficient initially."
---

# CruxControl — Vision

## Vision

CruxControl is a data-owning climbing-board app whose first complete target is a
home Kilter Board Fullride 7x10. Its implemented first milestone creates, saves,
reopens, and lights unrestricted browser-local climbs through a fast, offline-first
client; organizes them into shareable lists; and supports locally reviewed screenshot
imports and editable light effects. The next addition lets invited partner and friends
contribute climbs to a shared library and receive updates independently of app releases.
Community-catalog browsing and logging follow; grade prediction and personalized
training extend the wall-session loop in longer-term milestones.

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
**invited partner and friends**. Each person keeps private authoring and playlists
in their own client and can control a compatible board. Explicitly submitted climbs
become available immediately within the invited group, without Andrew approving
each submission. Android board control is sufficient initially. Local playlists are
already portable by bounded URL or lossless file; provider climb URLs remain future
catalog work. The design begins with this
"distribute to friends" case: an installable PWA built for static hosting once the
deployment setup and acceptance checks are complete. The shared library permits a
narrow collaboration service where research establishes the need; it does not make
local authoring depend on a service. Supporting more board types broadens the
hardware and catalog surface without requiring public registration or commercial
multi-tenancy.

## Principles

- **Data ownership first.** The climber's logbook is local and portable; syncing
  to the Kilter API is optional, never required.
- **Fast by default.** Offline-first, instant load, responsive browsing — the
  official app's biggest weakness is the bar to clear.
- **Data-driven over hand-curated.** Where a data source exists (the Kilter
  catalog, sync API), build a pipeline rather than curate by hand.
- **Useful sessions first.** Shared climbs, reliable local ownership, and community
  browsing take priority. Grade prediction and personalized training remain
  longer-term capabilities supported by the architecture.
- **Web platform.** Web Bluetooth makes a no-install, shareable, cross-device
  client possible — lean into it.
- **Distributable by default.** The app is built as a hosted, installable PWA a
  friend can open from a URL once deployment is configured. Easy installation and
  stability across browsers/devices are first-class principles. Group access should
  require minimal setup, while local use remains independent of shared services.
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

- **Not a public social or commercial multi-tenant product.** The first shared
  library serves one invited circle. Billing, public discovery, and hosting or
  remotely controlling other people's boards are outside its scope. A collaboration
  service may hold explicit contributions and the access data needed for the group;
  private drafts, playlists, and future logbook data stay locally owned.
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

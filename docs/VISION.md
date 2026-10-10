---
description: CruxControl vision, problem, audience, principles, and non-goals
type: planning
kind: planning
updated: 2026-10-10
nav_priority: high
summary: >
  CruxControl is a Kilter-first, eventually universal climbing-board app. Its
  first complete vertical slice controls a home Fullride 7x10, while its domain,
  catalog, and controller boundaries allow other boards to be added without
  surrendering offline use, data ownership, or source fidelity. The first
  older-snapshot Kilter catalog browser is integrated with explicit consent and
  offline access while native iPhone preparation continues.
  Private library preservation now takes priority: independent online backups and
  portable owner-controlled files must complement offline local authoring. An
  experimental Android package now uses native SQLite for local authorship; its
  synthetic emulator persistence check passes, while physical and independent
  recovery proofs remain open. Invited contributions follow with Android and iPhone
  board control.
decisions:
  - "Share product logic across web, Android and iOS while retaining platform-specific storage and device adapters; preserve the working web client and keep native-device acceptance explicit."
  - "Data ownership is a first principle: the logbook lives locally, sync to Kilter is optional."
  - "The Fullride 7x10 is the first complete milestone; one app for any supported climbing board is the long-term north star."
  - "Board definitions, catalog providers, and controller protocols are independent extension points."
  - "Imports may use public or user-authorized sources; access and redistribution constraints are enforced per provider."
  - "Static delivery and offline local use remain the default; a narrow service may support independent private backups, provider access or invited collaboration."
  - "Kilter community catalog access precedes invited shared contributions; its first browser uses an explicitly older offline snapshot, and native iPhone preparation continues independently, with a logbook, broader providers, grade prediction and personalized training retained afterward."
  - "Private authoring and playlists stay locally usable; preservation requires automatic private online backups plus portable owner-controlled files, separate from invited sharing."
  - "Invited partner and friends need Android and iPhone board control; establish the iOS path before advancing shared-library implementation."
---

# CruxControl — Vision

## Vision

CruxControl is a data-owning climbing-board app whose first complete target is a
home Kilter Board Fullride 7x10. Its implemented first milestone creates, saves,
reopens, and lights unrestricted climbs through a fast, offline-first web client;
organizes them into shareable lists; and supports locally reviewed screenshot imports
and editable light effects. The web client and iOS prototype store their authored
library in IndexedDB. The experimental Android package injects the same library
interfaces over one native SQLite database and has passed synthetic emulator checks
for restore, edit/save, forced process termination, relaunch, and a same-signature
update. Physical-board behavior and full Android feature parity remain unverified.
Native local storage is not independent recovery. The immediate priority is independent
library preservation: automatic private online backups, retained versions, portable files,
and verified restoration after browser or device loss. These protections are intended
work, not shipped guarantees; current whole-library exports are manual, and no
off-device or online recovery path has been proven. Local saving and offline access
must remain available while backup is pending or unavailable.
The Kilter community catalog first slice is now
integrated in the running app: entry opens the older offline Fullride snapshot when
available, while explicit management consent controls metadata lookup and download.
The snapshot's source freshness is unknown and it receives no live updates; complete
current-app coverage and public distribution permission are not established. Catalog
work can advance on Android and the web while native iPhone work proceeds; unavailable
iPhone hardware does not block that work, but Android catalog support still needs its
own packaged proof. The isolated iOS prototype now compiles,
starts, and has passed synthetic-data library preservation and complete backup/restore
round trips in an iPhone 17 simulator; physical-device acceptance remains open.

Invited partner and friends can subsequently contribute climbs to a shared library
and receive updates independently of app releases. That milestone includes Android
and iPhone board control; the iOS client path must be established before shared-service
implementation advances. A local logbook follows these library milestones. Additional
providers, grade prediction, and personalized training extend the wall-session loop
in longer-term milestones.

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
each submission. Android and iPhone board control are required. Local playlists are
already portable by bounded URL or lossless file; provider climb URLs remain future
catalog work. The design begins with this
"distribute to friends" case: an installable PWA built for static hosting once the
deployment setup and acceptance checks are complete. Narrow private-backup and
collaboration services are permitted where research establishes the need; local
authoring does not depend on either service. Private backup is independent of
contributing a climb to the group. Supporting more board types broadens the
hardware and catalog surface without requiring public registration or commercial
multi-tenancy.

## Principles

- **Data ownership first.** Authored work stays local and portable, with independent
  recoverable copies. Local saving and independently verified backup are distinct
  states. Syncing to the Kilter API is optional, never required.
- **Fast by default.** Offline-first, instant load, responsive browsing — the
  official app's biggest weakness is the bar to clear.
- **Data-driven over hand-curated.** Build repeatable pipelines from verified,
  authorized data sources rather than hand-curating catalog records. The legacy
  Kilter sync protocol remains reference material until its current availability
  and coverage are established.
- **Useful sessions first.** Reliable local ownership and Kilter community browsing
  lead, followed by shared contributions. Grade prediction and personalized training
  remain longer-term capabilities supported by the architecture.
- **Shared product, platform adapters.** Retain the web client's reusable behavior
  and add native device access where needed. One product does not eliminate native
  builds, permissions, persistence or device-specific acceptance.
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
  private drafts, playlists, and future logbook data stay locally owned. Owner-private
  backups do not become group contributions or grant members access to that work.
- **Not simultaneous board rollout.** The Fullride 7x10 remains the first complete
  product milestone. Other Aurora boards and MoonBoard follow through separately
  researched adapters rather than delaying the Kilter path.
- **Not a replacement for the Kilter social graph.** Future catalog adapters will read
  authorized public catalog data and may optionally sync; those capabilities are not
  implemented yet and will not reproduce Kilter's community/social features.
- **No separate mobile product fork.** iPhone board control is intended through a
  researched mobile integration sharing the application core. The experimental
  Capacitor package currently supports an Android native-storage path and an iOS
  IndexedDB path; production mobile support still depends on device, parity, and
  recovery evidence. A separate iOS-only feature set or unsolicited interface redesign
  is outside the scope.

## Reference

- [SPEC.md](SPEC.md) — capabilities, domain model, constraints
- [ARCHITECTURE.md](ARCHITECTURE.md) — modules, data flow, dependencies, risks
- [briefs/hardware-and-protocol.md](briefs/hardware-and-protocol.md) — board + BLE protocol
- [briefs/data-model.md](briefs/data-model.md) — schema, frames encoding, sync API

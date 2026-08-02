---
description: Current prior-art landscape for universal climbing-board control, catalogs, and user-data portability
type: landscape
kind: research
provenance: agent-synthesis
updated: 2026-08-02
summary: |
  Multi-board control is technically demonstrated by Boardsesh and CruxCoach, while
  BoardLib already acquires public Aurora-family catalogs. The durable product seam is
  not a supposedly universal Bluetooth protocol but separate board-definition,
  catalog-provider, and controller-protocol adapters with provenance-preserving data.
decisions_informed:
  - Kilter-first versus universal product scope
  - Multi-board domain and adapter boundaries
  - Static catalog distribution and user-authorized import posture
---

# Climbing-board ecosystem landscape

## Decision relevance

This survey asks what already exists and which boundaries CruxControl must preserve
while expanding from one Kilter Fullride 7x10 into a Kilter-first, multi-board app.
It maps prior art; it does not authorize access to or redistribution of any provider's
data.

## Landscape

### Aurora-family boards

Aurora currently supplies separate apps for Tension, Decoy, Grasshopper, So iLL,
Touchstone, and Aurora-branded boards. Their common vendor platform makes shared
catalog and BLE machinery plausible, but their layouts, placement identifiers, and
communities remain distinct. Kilter now operates a separate first-party app and data
claim flow after its transition away from the old Aurora app.

- [Aurora Climbing board/app inventory](https://auroraclimbing.com/)
- [Kilter app and support](https://app.kiltergrips.com/)
- [Kilter data-claim support](https://app.kiltergrips.com/support)

### Existing universal clients

Boardsesh is the strongest current reference: an Apache-licensed, open-source system
supporting Kilter, Tension, MoonBoard, Decoy, Touchstone, Grasshopper, and So iLL,
with native iOS board control, catalog browsing, sessions, logbooks, and imports. It
also exposes a public API and uses a backend, showing both that multi-board control is
feasible and that it is no longer a unique product claim.

CruxCoach independently demonstrates interactive Android BLE support across seven
board systems. FlashLab demonstrates a Kilter-focused offline PWA with direct Web
Bluetooth control.

- [Boardsesh source and architecture surface](https://github.com/boardsesh/boardsesh)
- [Boardsesh iOS capability inventory](https://apps.apple.com/in/app/boardsesh/id6761350784)
- [CruxCoach supported boards](https://cruxcoach.org/)
- [FlashLab Kilter PWA](https://flashlab.app/)

### Catalog and logbook acquisition

BoardLib downloads and incrementally synchronizes the public SQLite catalogs for
Aurora-based boards and exports user logbooks for Aurora-family boards and MoonBoard.
Its documentation explicitly excludes personal data from public database sync and
notes that some MoonBoard web API variants are currently broken. This is useful prior
art, not a stability or redistribution guarantee.

Provider terms and user export mechanisms must be assessed independently. Aurora's
terms distinguish service-owned content from user-contributed routes and activity;
Kilter provides an explicit export-and-claim mechanism for legacy user data.

- [BoardLib](https://github.com/lemeryfertitta/BoardLib)
- [Aurora terms of use](https://kilterboardapp.com/terms-of-use)
- [Kilter data export/claim guidance](https://app.kiltergrips.com/support)

### Bluetooth and mobile delivery

The reverse-engineered Aurora protocol and existing multi-board clients show useful
protocol reuse, but compatibility should be represented as a device profile rather
than assumed from hardware appearance. MoonBoard is a separate controller family.

Chrome supports Web Bluetooth on Android and desktop Chromium. WebKit does not
implement it, so an iPhone can use the PWA's non-control surfaces but needs a native
CoreBluetooth bridge or third-party browser/extension for board control.

- [Chrome Web Bluetooth](https://developer.chrome.com/docs/capabilities/bluetooth)
- [WebKit position on Web Bluetooth](https://webkit.org/tracking-prevention/)
- [fake_kilter_board protocol reference](https://github.com/1-max-1/fake_kilter_board)

## Recurring architecture pattern

The evidence supports three independent axes:

1. **Board definition** — immutable vendor/model/layout revision, hold geometry,
   valid roles, native grading systems, angle rules, and LED placement mapping.
2. **Catalog provider** — source identities, public catalog import/sync, optional
   authenticated user import/export, provenance, deletion/tombstone semantics, and
   redistribution policy.
3. **Controller profile** — discovery, transport availability, protocol encoding,
   connection lifecycle, and supported device commands.

A board installation binds one definition to zero or more compatible catalog and
controller adapters. Catalogs should install per provider/layout on demand; a single
universal database would couple release size, browser storage, and provider failure.

## Product implications

- Ship the Fullride 7x10 as the first complete vertical slice.
- Generalize identities and contracts before route/browser features spread bare
  Kilter IDs and raw Kilter SQL through the app.
- Preserve native source payloads, identifiers, grades, and provenance alongside a
  normalized read model; normalization must not destroy round-trip fidelity.
- Treat import as user-authorized and source-specific. Public availability does not
  imply permission to republish.
- Keep static/backendless distribution as the default. Permit CI-generated catalog
  snapshots and reserve a narrowly scoped service adapter for providers that require
  protected credentials, browser-incompatible access, or live collaboration.
- Plan a native iOS controller bridge only when iPhone board control is prioritized;
  the browser app remains the shared domain and UI core.

## Research gaps before non-Kilter implementation

- Provider-by-provider API/export rights, rate limits, provenance requirements, and
  deletion/update behavior.
- Exact compatibility matrix for Aurora controller generations and MoonBoard LED
  generations.
- Grade normalization that retains native display and does not imply false precision.
- Whether a native shell can reuse the web UI economically or should expose only a
  narrow transport bridge.

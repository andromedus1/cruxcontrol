---
id: epic-universal-board-platform
kind: epic
stage: drafting
tags: [data]
parent: null
depends_on: [epic-foundation-sqlite-readpath, epic-foundation-pwa-shell]
release_binding: null
gate_origin: null
research_refs:
  - .research/analysis/landscapes/climbing-board-ecosystem.md
created: 2026-08-02
updated: 2026-08-02
---

# Universal Board Platform: Definitions, Identity, and Adapter Contracts

## Brief

Establish the irreversible contracts that let CruxControl finish Kilter first without
becoming Kilter-bound. This epic owns board/layout definitions, namespaced source and
climb identities, configured board installations, capability negotiation, catalog
provider contracts, controller profile/transport contracts, and domain-level catalog
queries above the foundation's raw SQLite port.

When done, the existing Kilter Fullride 7x10 snapshot can be represented as the first
definition/provider/controller composition, while browser, editor, playlists, logbook,
and BLE work depend only on typed domain contracts. It does not implement additional
board vendors or user-facing browsing/control.

## Constraints

- Fullride 7x10 is the first concrete adapter and acceptance fixture.
- Preserve provider-native IDs, payload versions, grades, and provenance alongside
  normalized fields.
- Use explicit typed registries and adapters; do not build a dynamic plugin framework
  before multiple implementations demonstrate the needed abstraction.
- Catalogs install per provider/layout and remain independently removable/updatable.
- A provider's import, publish, auth, and redistribution capabilities are explicit.

## Design decisions

- **Breadth for the first milestone**: implement only the low-cost seams needed to
  prevent Kilter assumptions from escaping—namespaced identity, definition-driven
  geometry, domain query contracts, and separate provider/controller ports. Defer
  board inventory UI, dynamic plugins, multiple installed catalogs, and every
  non-Kilter adapter. — confirmed 2026-08-02.
- **Acceptance fixture**: the home Kilter Fullride 7x10 is the only required physical
  board and catalog for the first release.
- **Local-milestone foundation boundary**: depend on the completed SQLite read path and
  PWA shell directly. Community-catalog bootstrap remains outside the create-save-light
  milestone and does not block board definitions, local drafts, rendering, or control.

## Foundation references

- `docs/ARCHITECTURE.md` — Board Domain, Data Layer, Catalog Providers, and Controller
  Profiles & Transports.
- `docs/SPEC.md` — Board Inventory & Setup and namespaced domain identities.
- `docs/PRINCIPLES.md` — Separate the three changing axes; preserve before normalizing.

## Anticipated child features

Provisional:
- Namespaced domain identities + immutable board/layout definitions
- Board installation registry + capability negotiation
- Domain catalog query port + Kilter projection over the raw SQLite foundation
- Catalog provider and controller profile/transport contracts

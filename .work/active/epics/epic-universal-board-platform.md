---
id: epic-universal-board-platform
kind: epic
stage: review
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

## UI alignment

This epic establishes domain and adapter contracts without adding a user-facing
surface. Its consumers inherit the locked design system and their own approved screen
or flow mockups; no mockup is required for this decomposition.

## Decomposition

Split by durable capability rather than technical layer. The domain-definition feature
owns the shared identity and geometry vocabulary. Installation contracts compose that
definition with provider/controller capabilities, while the catalog-domain feature
independently projects raw SQLite rows into the same vocabulary. This keeps board
control and catalog consumers from sharing Kilter-specific infrastructure while
allowing the two downstream seams to develop in parallel after the definition lands.

### Child features

- `epic-universal-board-platform-domain-definition` — namespaced identities and the
  immutable Fullride 7x10 definition — depends on: `[]`
- `epic-universal-board-platform-installation-contracts` — installation registry,
  capabilities, and provider/controller ports — depends on:
  `[epic-universal-board-platform-domain-definition]`
- Deferred backlog: `epic-universal-board-platform-catalog-domain` — typed community
  catalog queries and Kilter SQLite projection. It is outside the local
  create-save-light milestone and will return with catalog acquisition work.

### Decomposition risks

- **Definition accuracy is load-bearing.** Incorrect placement, coordinate, or LED
  identity would contaminate rendering and physical control. The concrete Fullride
  definition must be verified against the schema-faithful catalog data, with the
  screenshot used only as a visual cross-check.
- **Contract overreach could create a speculative plugin system.** The feature briefs
  constrain this milestone to explicit TypeScript ports and one Kilter composition;
  abstractions not exercised by the first consumers are deferred.
- **Raw-SQL leakage would defeat the boundary.** The existing `CatalogPort` is
  intentionally low-level; its Kilter projection must become the sole query path for
  product modules rather than a parallel convenience wrapper.

## Child features reviewed and complete

- `epic-universal-board-platform-domain-definition` — verified Fullride identity,
  305-placement geometry/LED mapping, semantic roles, and full color contracts.
- `epic-universal-board-platform-installation-contracts` — immutable configured
  installation/capability composition for one active Fullride controller.

The catalog-domain feature was moved to backlog because community-catalog data is
explicitly excluded from this milestone; the completed contracts are sufficient for
local drafts, rendering, and physical control.

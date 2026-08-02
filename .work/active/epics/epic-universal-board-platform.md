---
id: epic-universal-board-platform
kind: epic
stage: done
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

## Review (2026-08-02)

**Verdict**: Approve

**Blockers**: none
**Important**: none
**Nits**: none
**Rejected**: none

**Notes**: Substrate epic review at effective weight `standard`; exactly one balanced,
same-harness fresh-context aggregate pass covered the epic contract, both completed
child-feature review records and public contracts, the deferred catalog-domain backlog
item, current browser/control consumers, and the load-bearing foundation assertions.
The pass did not repeat line-level child review.

The Fullride artifact regenerated byte-for-byte from the checked-in schema-faithful
catalog (source SHA-256
`32b2663c7e699708dc3983d6acf8eff5dd8d458530c680c50ce7f6719c61235f`; generated
artifact SHA-256
`2de883837c343a63c56d4147dd6ff24434ad182712828a9069394515f045e499`). Direct source
queries confirmed 472 scoped placements, exactly 305 unique placement/hole/LED-row/LED-
position mappings numbered `0..304`, the expected 165/140 Mainline/Auxiliary split,
and zero emitted coordinates outside the product-size bounds. Physical-board behavior
is not claimed by this evidence; the already-documented Fullride/Android Chrome smoke
test remains a release checkpoint.

The aggregate seams remain proportionate and coherent: definition-scoped placement
identity retains provider-native placement/hole/set/LED metadata; climb identity is
namespaced by provider, native source ID, and layout revision with unambiguous stable
keys; and the installation registry composes immutable definitions with independently
compatible provider registrations and controller profiles. The shipped Fullride
installation intentionally has no community provider, reports only local `create` and
configured `control` available, keeps live transport state on `BoardLightController`,
and constructs its controller/transport lazily.

Deferring `epic-universal-board-platform-catalog-domain` does not break the current
local create-render-light goal: production browser code consumes normalized immutable
records and typed definition/controller contracts, and no current product consumer
imports `CatalogPort` or issues provider SQL. The raw SQL port remains confined to the
foundation data adapter until the backlog feature supplies the provider-neutral catalog
projection required by future community browsing, provider URLs, playlists, and
logbook consumers. Foundation assertions remain aligned. Persistence/migration,
provider auth/network policy, and user-facing UX lenses were not applicable to this
contract-only aggregate.

Verification passed: 6 Python generator tests, 170 Vitest tests, strict TypeScript
typecheck, full lint, and production build.

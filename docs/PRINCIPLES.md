---
description: Product and engineering principles governing CruxControl decisions
type: planning
kind: planning
updated: 2026-08-02
nav_priority: high
summary: >
  Durable decision rules for building CruxControl as a Kilter-first,
  offline-first, source-faithful climbing-board platform.
decisions:
  - "Complete a Fullride 7x10 vertical slice before expanding implementation breadth."
  - "Keep board definitions, catalog providers, and controller protocols independent."
  - "Preserve native data and provenance; normalized fields are a read model, not a replacement source of truth."
  - "Prefer local and static operation, earning backend and native-shell complexity only when a capability requires it."
  - "Treat measured board capacity, protected climb roles, and foreground-only browser animation as safety contracts rather than presentation details."
---

# CruxControl — Principles

## Product principles

### Finish one board before supporting every board

The Kilter Fullride 7x10 is the proving ground and first release boundary. Universal
contracts are designed in where retrofitting would be expensive—identity, layout
revision, provenance, and edge adapters—but additional board implementations do not
delay a useful Kilter product.

### The wall session is the product

Optimize the loop at the wall: find or make a climb, light it quickly, climb, record
the result, and move on. Features that increase phone handling or network dependence
must justify that friction.

### Climbers own their work and history

Drafts, playlists, attempts, ascents, and notes remain locally available and
exportable. Provider sync is optional and must never be the sole copy of user-created
data.

### Native communities remain legible

Show native board names, layout revisions, grades, setters, identifiers, and
attribution. Cross-board normalization helps search and analytics but must not erase
meaning or imply precision that the source community did not provide.

## Engineering principles

### Separate the three changing axes

Board definitions describe physical truth. Catalog providers describe where climbs
and activity come from. Controller profiles describe how a physical board is driven.
No adapter owns all three merely because one vendor currently supplies them together.

### Contracts before additional providers

Add the first Kilter adapter against typed domain contracts. Validate those contracts
with the working vertical slice, then add another provider. Avoid a premature plugin
framework; use explicit registries and typed adapters until repeated implementations
show the right generalization.

### Local-first, backend-later

Static distribution, browser-local catalogs, and local user data are the default.
CI-generated provider snapshots are acceptable. Add a narrowly scoped service only
for a demonstrated constraint such as protected credentials, browser-incompatible
access, or live multi-user coordination.

### Preserve before normalizing

Store provider-native IDs, payload versions, grades, and provenance beside normalized
query fields. Imports are idempotent and reversible, and a provider update cannot
silently orphan user history.

### Capability detection over platform assumptions

Boards and clients advertise what they can do: browse, control, edit, publish, import,
or sync. Unsupported capabilities degrade explicitly. In particular, iOS browsing is
not mistaken for iOS Web Bluetooth support.

### Preserve physical truth under animation

Never silently thin, truncate, or rewrite a saved design to fit a measured board
capacity. Refuse or slow playback with an explicit explanation, keep semantic climb
roles exact and visually protected from decorative effects, and require the controlling
browser page to remain in the foreground because background timer suspension is a
platform constraint, not a reliable animation mode.

### Evidence governs access

Public reachability, technical feasibility, and permission to redistribute are
different facts. Each provider adapter documents its acquisition authority,
attribution, refresh behavior, and deletion obligations before release.

### Test contracts without depending on scarce hardware

Protocol encoders, provider reconciliation, layout validation, and domain behavior
must be deterministic in CI. Hardware smoke tests complement these tests; they do not
replace them.

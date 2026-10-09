---
id: epic-universal-board-platform-catalog-domain
kind: feature
stage: drafting
tags: [data]
parent: null
depends_on: [epic-universal-board-platform-domain-definition]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-10-09
---

# Domain Catalog Queries and Kilter Projection

## Brief

Place a typed, provider-neutral catalog query surface above the foundation's raw SQL
port and implement the first Kilter SQLite projection. Downstream browser, editor,
logbook, and playlist code receives namespaced climbs, native-plus-normalized grades,
placements, roles, statistics, and provenance without issuing Kilter-specific SQL or
depending on raw database rows.

This feature adapts an already available local Kilter catalog; it does not download,
install, update, authenticate to, publish into, or redistribute a catalog. Community
catalog bootstrap and sync remain separately owned, and the projection must be
testable against a small schema-faithful fixture.

## Epic context

- Scope: standalone feature promoted for Andrew's community-catalog priority;
  retains its existing ID and domain-definition dependency. The completed universal
  board epic owns the earlier local foundation, not this remaining catalog work.
- Position: independent consumer of the domain definition and the completed
  foundation `CatalogPort`; supplies domain reads to browser-oriented epics.

## Inherited design decisions

- The local-milestone contract can land without community-catalog bootstrap; absent
  catalog data is an explicit capability/state rather than a blocker for local drafts.
- Raw provider payloads, native IDs, grades, versions, and provenance are preserved
  alongside normalized query results.
- Bare Kilter IDs and raw Kilter SQL do not cross the domain-query boundary.
- Only the Fullride 7x10 Kilter projection is implemented now; multiple installed
  catalogs and non-Kilter providers are deferred.

## Scope decision

Andrew prioritized community catalog access ahead of invited sharing on 2026-10-09
and authorized resumption. This feature provides a source-independent, synthetic-
fixture-testable query/projection boundary while acquisition evidence is refreshed.
It does not claim current first-party Kilter coverage or ship a community database.
The existing restored snapshot includes layout-compatible climbs that do not fit
the installed 305 placements: reject whole incompatible climbs, never omit holds
to make a route appear compatible. Use native Fullride roles 42–45 in test fixtures.

## Simplification opportunity

Keep provider SQL and native frame decoding in one adapter, reusing the existing
board definition, namespaced identities and view records. Avoid a second climb
model or teaching UI consumers the Kilter schema.

## Research briefs

- `.research/analysis/landscapes/climbing-board-ecosystem.md` — grounds
  provenance-preserving provider boundaries and per-layout catalogs.
- `docs/briefs/data-model.md` — grounds the Kilter SQLite schema, frames encoding,
  placement relationships, grades, statistics, and native identity.
- `docs/briefs/board-rendering-and-filtering.md` — grounds the domain data required by
  rendering and responsive climb queries.

## Foundation references

- `docs/ARCHITECTURE.md` — Data Layer, Catalog Providers, and preserve-source-truth
  convention.
- `docs/SPEC.md` — Climb Browser, Data Acquisition, and provider-aware domain model.
- `docs/PRINCIPLES.md` — Preserve before normalizing; keep SQLite behind domain
  queries.

---
id: epic-universal-board-platform-catalog-domain
kind: feature
stage: drafting
tags: [data]
parent: epic-universal-board-platform
depends_on: [epic-universal-board-platform-domain-definition]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
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

- Parent epic: `epic-universal-board-platform`
- Position in epic: independent consumer of the domain definition and the completed
  foundation `CatalogPort`; supplies domain reads to browser-oriented epics.

## Inherited design decisions

- The local-milestone contract can land without community-catalog bootstrap; absent
  catalog data is an explicit capability/state rather than a blocker for local drafts.
- Raw provider payloads, native IDs, grades, versions, and provenance are preserved
  alongside normalized query results.
- Bare Kilter IDs and raw Kilter SQL do not cross the domain-query boundary.
- Only the Fullride 7x10 Kilter projection is implemented now; multiple installed
  catalogs and non-Kilter providers are deferred.

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

---
id: epic-catalog-sync-catalog-semantics
kind: feature
stage: drafting
tags: [ui, data]
parent: epic-catalog-sync
depends_on: [epic-catalog-sync-snapshot-normalize]
release_binding: null
gate_origin: null
created: 2026-10-19
updated: 2026-10-19
research_refs:
  - .research/analysis/campaigns/kilter-current-catalog-sources/parent.md
---

# Catalog Presentation for Boardsesh-Sourced Data

## Brief

Adapt the catalog browser, climb detail and playlist resolution to the new artifact's
meaning. Removed-upstream climbs stay searchable and playable, marked with a
"removed upstream" badge in results, detail and playlists. The rating filter and
display move from the three-star scale to the artifact's declared scale. Sends remain
distinct climbers and may go down as well as up between versions. Setters are
attributed where individual climbs are shown, and source wording identifies the data
as a Boardsesh-derived community catalog rather than official Kilter data, with the
installed version and build date.

Query and projection code must accept the normalized artifact without excluding
climbs it previously accepted, and cursors and cached query state must stay bound to
the installed snapshot identity. Existing playlist references (exact UUID spelling)
keep resolving across versions.

It does **not** fetch or install catalogs, and does not add new filters (hold
selection and other parity filters remain in the backlog).

## Epic context

- Parent epic: `epic-catalog-sync`
- Position in epic: consumer of the artifact contract; independent of publishing and
  device update.

## Inherited design decisions

- Removed-upstream climbs stay visible with a badge (not hidden).
- Attribute setters; never present the catalog as officially sourced.

## Research briefs

- [Current Kilter catalog sources](../../../.research/analysis/campaigns/kilter-current-catalog-sources/parent.md) §4 Stats and grades, implementation notes 7 and 9.

## Foundation references

- `docs/SPEC.md` §2 Climb Browser (filters, rating scale, source wording) and §8
  Playlists.
- Existing code: `web/src/data/catalog/kilter-catalog.ts`, `kilter-projection.ts`,
  `web/src/catalog/CatalogBrowser.tsx`, `CatalogFilterDialog.tsx`,
  `web/src/playlists/resolve.ts`.

## Mockups

None planned: the badge, scale change and attribution reuse existing catalog row,
detail and filter-sheet components. Fall back to `/ux-ui-design:screens` during
feature design if the badge or attribution needs a visual decision.

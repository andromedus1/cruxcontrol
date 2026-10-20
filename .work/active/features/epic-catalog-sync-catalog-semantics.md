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

## Design decisions

- **Wording (operator, 2026-10-19)**: for a Boardsesh-sourced catalog, the source line
  reads "Kilter community climbs via Boardsesh · updated <build date>" with
  "Not official Kilter data · setters credited"; the badge reads "Removed upstream";
  climbs show "set by <setter>". The existing legacy wording stays for the bundled
  `legacy-aurora-kilter` snapshot.
- **Rating scale comes from the installed manifest**: schema 3 declares
  `qualityScale.max` (5 for Boardsesh); schema 2 / legacy is the three-star scale. The
  filter's allowed range, hint text and star display follow the installed scale.
- **Removed-upstream marker (shared contract with `append-only-guards`)**:
  `climbs.upstream_removed_at TEXT NULL` — NULL means present upstream; a
  `YYYY-MM-DD` date means removed upstream since that build. Carried climbs keep
  `is_listed = 1`. Older artifacts lack the column; treat it as absent (all present).
  Removed climbs stay searchable and playable, with the badge in results, detail and
  playlist rows.
- **Schema-3 manifest parsing moves here** (from `device-update`): once this feature
  lands the app can present Boardsesh data correctly, so the same-origin install path
  should accept schema 3 (`source: boardsesh-kilter`) as well as schema 2. Example
  contract: `web/src/data/catalog/__fixtures__/manifest-v3.example.json` plus the
  additional `removedUpstreamCount` and `changes` fields defined by
  `append-only-guards`. Remote fetch, update prompts and downgrade protection stay in
  `device-update`.

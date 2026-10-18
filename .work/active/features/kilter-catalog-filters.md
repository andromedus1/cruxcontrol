---
id: kilter-catalog-filters
kind: feature
stage: drafting
tags: [data, ui]
parent: null
depends_on: [kilter-community-browser, epic-library-preservation-android-catalog]
release_binding: null
gate_origin: null
created: 2026-10-18
updated: 2026-10-18
---

# Full filtering for the Kilter catalog

Andrew wants the managed Kilter inventory to support filtering climbs by everything
the Kilter app can filter on, including rating, number of sends, and its other
available criteria. These filters are not currently represented in CruxControl.
Andrew selected this as the next priority on 2026-10-18 after confirming the
remaining physical Android acceptance checklist. Promote the existing parked idea;
work with the installed older catalog before pursuing current official coverage.

## Scope and grounding

Extend the existing offline catalog browser and parameterized query adapter. This
is one cohesive feature, separate from acquisition in `epic-catalog-sync`.
The current browser supports name, exact grade and angle; the catalog already
contains per-angle rating, distinct ascensionist count and setter metadata.

The first proposed filter surface includes name, angle, grade range, minimum
rating, minimum send count and setter, with explicit result sorting. Rating uses
the installed source's three-star scale. Label send-count help accurately: distinct
climbers who sent at the selected angle, not a total of repeated ascents.
Whether hold selection joins this first update is awaiting Andrew's direction.
The broader parity request remains the target; this proposal does not redefine it
as only two added controls.

- [Current specification](../../../docs/SPEC.md) and
  [filtering brief](../../../docs/briefs/board-rendering-and-filtering.md).
- [Data model](../../../docs/briefs/data-model.md), especially per-angle statistics.
- Code: `web/src/catalog/{types.ts,CatalogBrowser.tsx,catalog.css}` and
  `web/src/data/catalog/{kilter-catalog.ts,kilter-projection.ts}`.
- Read-only inspection of the pinned installed catalog on 2026-10-18 confirms
  `quality_average` values 1–3 and `ascensionist_count` 1–6712. The schema has
  setter, creation time, frame placements and bounding edges. These facts establish
  available inputs, not current official-app equivalence or source freshness.
- [Kilter's official listing](https://play.google.com/store/apps/details?id=com.kiltergrips.kilter_board_app)
  describes grade, rating and popularity filters. Its
  [support page](https://app.kiltergrips.com/support), checked 2026-10-18, additionally
  documents setter and exclude-sent filters, with liked climbs in a profile playlist.
  Personal sent/liked state is not present in this anonymous catalog. The local
  logbook remains deferred under the existing roadmap; do not invent that state.
- Search snippets and the opened official listing differed on release-note contents;
  do not treat snippet-only hold/geometry claims as a verified exhaustive contract.

## Design decisions

- Keep the existing Fullride scope, source label, offline behavior, read-only
  provider records and board-lighting safety boundaries.
- Reuse the existing design system. Compare filter placement, not a visual rebrand.
- Apply combined filters to the whole catalog before pagination. Never filter only
  the loaded page or advertise an uncomputed total count.
- A filter or sort change resets pagination and selected detail; stale query
  responses cannot restore an old selection or light a newly hidden climb.
- Bind every filter and sort choice into cursor validation; retain stable ordering
  through tied ratings/counts and invalid/incompatible rows.
- Unknown catalog freshness remains visible. No new account, cloud service or
  catalog download is needed for the statistics filters.

## Simplification opportunity

Replace the exact-grade special case with one range model (equal bounds still
represent one grade). Keep query validation and pagination in the existing adapter
instead of introducing a second browser or an in-memory search index.

## Mockups

- Comparison: [catalog filters](../../../.mockups/screens/kilter-catalog-filters/index.html).
- Option 1: compact controls beside results, with expandable advanced filters.
- Option 2: search and sort beside results, with a dedicated filter sheet.
- Selection pending. New filter composition requires mockup alignment before
  production UI implementation under the project's mockup-first convention.
- Both mocks checked in Chromium at phone width (412px), with a desktop comparison
  at 1440px. Combined rating/send filtering, cancel-without-apply, no horizontal
  overflow and no browser errors pass. Visually inspected the comparison and sheet.
  Synthetic rows are explicitly labeled and never read the installed library.

## Pending direction

- Include picking specific holds in this update, or ship the statistics filters first?
- Choose the filter layout after reviewing the interactive comparison.

No implementation units or child stories are finalized while those choices are open.

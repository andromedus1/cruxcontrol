---
id: swipe-between-climbs-catalog
kind: story
stage: done
tags: [ui]
parent: swipe-between-climbs
depends_on: [swipe-between-climbs-core]
release_binding: null
gate_origin: null
created: 2026-10-20
updated: 2026-10-20
---

# Catalog navigation across pages

## Brief
See the parent feature `swipe-between-climbs`, Unit 2.

## Implementation
Parent feature, Unit 2.

## Evidence

- `CatalogBrowser` passes `navigationOverride` built with `listNavigation` over the
  visible rows; position offset = rows on earlier pages in this query's history
  (`PageHistory.rowCounts`), "+" while `nextCursor` exists and the end is not yet known.
- Crossing pages: `movePage` reads the neighboring page itself (forward from
  `nextCursor`, skipping all-excluded pages; backward through the cursor history), then
  commits cursor history and primes the page query with the read page and the climb to
  select (first/last). The open detail never closes between pages and the page is not
  read twice. Manual Previous/Next buttons still clear the selection.
- Cancellation: query changes (`invalidateQuery`), Manage, closing the detail, choosing a
  row or moving within the page cancel a pending move; responses are also discarded
  when the query generation, adapter or page history changed. A trailing run of empty
  pages resolves the move as the end ("Last climb") and drops the "+". A failed or
  unavailable read falls back to an ordinary page change so the existing error/Retry
  states appear.
- Deviation from the design text: the "pending selection" is a primed page (page +
  selected key) instead of a `'first' | 'last'` flag re-applied after a second query;
  same behavior, one read per page, and no sheet close/reopen flicker on phones.
- Tests: 8 new `CatalogBrowser climb-to-climb navigation` cases (within page, forward and
  backward crossing, empty-page continuation, end of results, query-change and close
  cancellation with late responses ignored, manual buttons still clearing, read failure).
  `npm test`: 1023 passed, 1 skipped; lint and typecheck clean.


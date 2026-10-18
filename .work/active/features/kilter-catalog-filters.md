---
id: kilter-catalog-filters
kind: feature
stage: done
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
Andrew selected statistics filters first; hold selection is deferred.
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
- Selected: option 2, dedicated filter sheet — Andrew approved 2026-10-18.
  Apply commits a group of choices; Cancel/Back discards uncommitted choices.
- Both mocks checked in Chromium at phone width (412px), with a desktop comparison
  at 1440px. Combined rating/send filtering, cancel-without-apply, no horizontal
  overflow and no browser errors pass. Visually inspected the comparison and sheet.
  Synthetic rows are explicitly labeled and never read the installed library.

## Architectural choice

Extend the existing catalog query port and SQLite adapter, and keep one committed
filter state plus a temporary sheet draft in the browser (chosen). This preserves
the complete-catalog query and bounded projection pipeline. Filtering loaded rows
would return incomplete results. A separate search index would duplicate the catalog
and add installation/versioning work without a demonstrated need.

## Implementation units

One owner, no child stories: query, pagination and selection invalidation must agree
on the same filter state and are small enough for one cohesive implementation.

### 1. Query contract and stable pagination (trickiest unit)

Files: `web/src/catalog/types.ts`, `web/src/data/catalog/kilter-catalog.ts`,
`web/src/data/catalog/kilter-catalog.test.ts`.

```typescript
export type CatalogSort = 'rating' | 'sends' | 'grade-asc' | 'grade-desc' | 'name';
// Extend CatalogClimbQuery (existing angle/name/minGrade/maxGrade/limit/cursor):
readonly minRating?: number;
readonly minAscents?: number;
readonly setter?: string;
readonly sort?: CatalogSort;
```

Default sort is highest rating; UI exposes all five choices. Rating range 0–3,
finite; ascents must be a nonnegative safe integer; setter is trimmed text up to
200 characters with literal substring matching, just like name. Grade bounds retain
existing native integer-scale semantics and are inclusive. Omitted minimums mean
unrestricted, not a hidden minimum vote count. Use bound SQL parameters for all
input. Keep the angle-specific join and compatibility projection.

Use stable composite keyset ordering: selected sort value plus UUID ascending as
unique tie-breaker. Rating and ascents descending; grade ascending/descending based
on displayed rounded grade; name case-insensitive ascending. Cursor version changes
and binds snapshot/layout, angle, every normalized filter and sort, plus final
inspected sort value and UUID. Old in-memory cursors are rejected; no persisted
cursor migration is necessary. Handle invalid/null source statistics with explicit
sortable SQL keys so an excluded row at a page boundary cannot strand traversal.
Keep the 250-candidate bound and next cursor based on the final inspected candidate,
including rejected rows. Do not claim a complete total count.

Acceptance: combined filters apply before pagination; tied sort keys neither repeat
nor skip valid climbs; Prev/Next works in every sort; changed-query/snapshot cursors
fail; malformed query values fail before storage I/O; incompatible and malformed
source rows remain excluded without breaking continuation.

### 2. Filter sheet and catalog metrics

Files: `web/src/catalog/CatalogBrowser.tsx`, `web/src/catalog/catalog.css`,
`web/src/catalog/CatalogBrowser.test.tsx`; a cohesive `CatalogFilterDialog.tsx` is
permitted if it follows the existing catalog dialog conventions. Extend shared
climb-browser row/detail presentation only through optional additive render slots
or metadata that leave authored-climb views unchanged; do not downcast provider
fields into local authored records.

Use approved option 2: name and angle stay above results; sorting and a Filters
button are adjacent. Sheet has grade From/To, minimum rating, minimum sends and
setter. Clear labels, keyboard focus containment/return, Escape and native Back,
44px targets and phone/desktop layouts follow existing dialogs. Keep draft state
inside the sheet; Apply validates and commits atomically, Cancel/Back discards.
Reset inside the sheet clears its pending fields; outside chips remove one applied
filter. Do not commit invalid ranges or silently clamp invalid input. Rating/send
help explains three stars and distinct climbers at this angle.

Applied chips summarize grade/rating/send/setter choices; existing name debounce
continues. Every committed filter/sort/angle change invalidates current query,
resets pagination and clears selection before new rows arrive. Late responses and
adapter replacement must not resurrect stale selected climbs or initiate lighting.
The sheet itself must not auto-light anything. Show rating and sends in catalog rows
so users can see why a result matched. Retain source freshness labeling, loading,
retry, installation-management and empty-compatible-page continuation behavior.

### 3. Verification and contract docs

Meaningful adapter tests use existing database fixtures: combined numeric/text
filters, angle-dependent statistics, all sort orders with ties across page limits,
invalid rows at page boundaries, stale/tampered cursors, bounds and literal setter
matching. UI tests cover committed vs draft state, invalid inputs, reset/chip
removal, selection/page invalidation, stale responses and keyboard/native Back.
Avoid tests that only assert an exact SQL string or mirror helper implementation.

Run focused catalog tests, then web lint/typecheck/test/build. Add one targeted
browser check of the integrated sheet at phone width and keyboard interaction;
reuse existing catalog integration infrastructure where practical. A real phone
update requires a fresh whole-library backup and USB connection; do not operate on
the disconnected phone or imply that a source change updates the installed APK.
Update SPEC/ARCHITECTURE's browser contract after implementation; retain current
catalog-acquisition, public-distribution and personal-logbook limitations.

## Implementation order

1. Query normalization and keyset sorting with regression fixtures.
2. Approved sheet, result metrics and state/selection behavior.
3. Integrated verification, documentation and independent standard feature review.

## Risks

- **Cursor correctness:** rating/count ties and invalid rows can skip results.
  Verify actual SQL-backed pages; preserve UUID tie-breaks and bounded scans.
- **Statistics meaning:** counts and ratings belong to an angle and an older
  snapshot. Keep those qualifications visible; never imply current official counts.
- **UI lifecycle:** changing filters while detail is selected can leave stale
  lighting targets. Clear selection and reject stale responses before publishing rows.
- **Later parity:** sent/liked need personal data; hold selection and any remaining
  official filters stay under [the deferred parity capture](../../backlog/idea-kilter-remaining-filters.md),
  not falsely advertised as shipped here.

## Implementation discovery

- Implemented grade ranges, minimum rating, minimum distinct sends, setter text,
  and five stable sort modes in the existing parameterized catalog adapter. The
  dedicated sheet keeps draft values separate until Apply; applied chips remove
  one criterion, and every committed query change clears selection and pagination.
- Cursor v2 binds the normalized filter, sort, snapshot, layout and page size. It
  carries explicit sort-rank/value plus UUID keys; bounded scans advance from the
  last inspected candidate even when projection rejects rows. SQL-backed tests
  cover combined/angle-specific filters, literal setter text, invalid statistics,
  ties across one-row pages, and cursor mismatch rejection.
- Catalog rating/send metadata is rendered through an optional row slot, leaving
  authored climb records and their views unchanged. The phone-width browser smoke
  uses only the existing synthetic catalog fixture.
- SPEC and ARCHITECTURE now describe the implemented filter/query contract; the
  delegated documentation update and fresh system audit are complete. Older-catalog
  freshness and personal-data limits remain explicit.

### Verification

- `npm -w web run lint` — passed.
- `npm -w web run typecheck` — passed.
- `npm -w web test` — passed, 102 files / 899 tests.
- `npm -w web run build` — passed; Vite reported its existing large-chunk advisory.
- `node web/scripts/check-pwa-build.mjs` — passed; catalog data is not precached.
- `npm -w web test -- --run src/data/catalog/kilter-catalog.test.ts` — passed,
  11 tests after the final query-test additions.
- `npm -w web run test:e2e -- --grep "installs only with consent"` — passed at
  390px phone width, including combined filters, angle-specific metrics, Escape,
  and focus return. Full E2E and catalog-bootstrap lanes remain for host integration CI.
- No phone update or authored-library access was performed.

## Execution

Use implement-orchestrator with one feature-owning worker in the main checkout.
The small Android review repair is isolated in `.peeragent/preservation-review`.
GPT-5.6 Luna is unavailable in this harness; use GPT-6 Luna at xhigh for the coupled
query/UI work. Effective review weight: standard from `.work/CONVENTIONS.md`.
Dependencies `kilter-community-browser` and `epic-library-preservation-android-catalog`
are done. The earlier cycle check found no reverse dependencies. Worker verifies
and commits the feature at review; host owns independent review, adjudication and
PR completion. No phone/cloud operations or unrelated source changes.


## Standard review (2026-10-18)

**Verdict:** Approve with comments. **Blockers:** none. One independent Claude
Opus peeragent pass (`20261018T220011Z-66c769f2`) confirmed parameterized filters
before pagination, matching keyset order/continuation, cursor binding, atomic
sheet edits, stale-response invalidation and authored-library isolation. The peer
ran the 19 focused tests and an independent mixed-validity paging stress probe.
Host integration CI `39170297487` passed all required lanes, including the full
browser and catalog-bootstrap suites, Android compilation and iOS contracts.

Accepted test gap F2 is resolved with a focused native-Back dispatch regression:
the sheet closes, edits are discarded, focus returns, the selected climb remains,
and a subsequent Back can close that detail. All 9 browser unit tests, typecheck
and lint pass. The initial new fixture omitted a required callback; the fixture
was corrected without changing production behavior or weakening assertions.

F1 performance was not measured on the real phone by the reviewer; host phone
acceptance will check actual query responsiveness before deciding whether it
warrants a separate performance item. Nits F3–F8 are recorded without expanding
this slice: optional empty-state clear-all, transient empty-grade control polish,
singular send wording, sort-group ARIA, mobile footer offset and ASCII-specific
case-fold documentation. None is a required current-cycle correctness blocker.
The actual production sheet was visually checked at 390px and 320px with no
horizontal overflow. No second independent pass is required by standard weight.

The same update includes the already-reviewed editor Back/autosave fix. Phone
installation and before/after whole-library comparison are recorded separately
below; passing source review alone does not claim an installed update.

## Phone delivery and preservation (2026-10-18)

Andrew reconnected the phone and explicitly emphasized his latest climb renames,
list memberships/order and background effects. Release30 was confirmed on the
existing native app ID and SQLite library. The app was at the library root with
the board disconnected, no active editor and a verified online-copy status.
A newly completed native SAF whole-library export was strictly decoded and saved
outside the checkout before maintenance. Old import evidence was not the baseline.

Signed release31 was built from clean source `99e1793` with the retained signing
certificate, private catalog and library-v1 vault configuration. The APK is not
debuggable and has no proof surface. The build sidecar verified its digest and
clean source boundaries. Changes after that build affect tests/docs/work records,
not installed production code. The normal same-ID `install -r` upgrade succeeded;
no uninstall, reset, storage clearing, downgrade or library import was performed.

A fresh provider-written export immediately after installation matched the new
pre-update backup canonically across every saved record, name, revision, ordered
playlist membership and effect recipe. It retains 22 climbs (16 active, 6 in
Trash), four lists, 18 ordered memberships and eight climbs with effects. No
personal contents, identifiers, signing material or backup bytes enter Git.

On the actual phone and retained catalog, combined minimum rating 2.5 and minimum
send count 20 produced matching results. All 25 returned rows respected those
bounds and descending send-count ordering after choosing Most sends. Native Back
first dismissed the keyboard, then discarded a draft setter change without
altering applied filters. Reset/Apply cleared the test filters and default rating
sort was restored. Reads were ready on the first post-interaction accessibility
check, without loading errors; this is bounded acceptance, not a latency benchmark.
No board connection or authored edit was part of these checks.

A third completed export after all phone filter checks again matches the original
pre-update backup exactly. All exports and comparison evidence were retained in
owner-controlled storage outside the checkout. The phone was returned to My Climbs
with no unfinished editor or board connection, and Andrew was told it is safe to
disconnect. Physical board use of these filters is left for Andrew's session; the
phone-only acceptance does not claim radio verification.


## Closure

Required integration CI run `39171223172` passed on the source including the native
Back regression. The single standard independent feature review is complete,
its accepted test gap is resolved and verified, and the fresh system documentation
audit reports zero findings. Signed release31 is installed with exact whole-library
preservation demonstrated before and after the update and the phone checks.
The feature is done; PR #33 remains the reviewable delivery branch stacked on
PR #32, with neither merged or publicly deployed by this work.

---
id: epic-universal-board-platform-catalog-domain
kind: feature
stage: review
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

Andrew subsequently accepted older climbs as the first usable catalog, followed
by current official Kilter coverage. This adapter supports the existing local
Kilter SQLite shape without selecting an acquisition service or asserting that
legacy data includes current first-party climbs. Its provenance must make that
distinction possible for the browser feature.

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

## Design grounding

Designed 2026-10-09 under the active autopilot caller. Read the knowledge navigator,
foundation contracts, cited retained briefs, project rules, existing SQLite engine
and tests, installation identities, provider playlist resolution, and generated
Fullride definition. No project patterns directory exists. Direct reading was
sufficient; no further exploratory fanout or design advisory review was needed for
this bounded, read-only feature. Effective implementation review weight remains
`standard` from `.work/CONVENTIONS.md`.

The generated definition is authoritative for controllable placements and native
role IDs. Existing `CatalogPort` owns SQL execution; `ClimbViewRecord`,
`ProviderClimbId`, and `providerClimbViewKey` own consumer shape and identity.
`CatalogDb` plus `MemoryVFS` already provide real-engine test infrastructure.
The retained source briefs inform the legacy schema, not current acquisition
rights, current coverage, or current sync behavior.

## Design decisions

1. **One read adapter, no storage changes.** Wrap an injected, already-installed
   `CatalogPort`. Do not instantiate workers, acquire data, alter tables, migrate
   user stores, register the provider, or wire the running app in this feature.
   The composition owner retains responsibility for closing the underlying port.
2. **Extend the existing view record.** A catalog climb adds provider identity and
   native grade/statistics to `ClimbViewRecord`; it does
   not duplicate its name, angle, assignments, or presentation model. Source rows
   stay intact in the read-only database. The query port exposes provenance once
   at catalog level. Consumers do not receive raw SQL rows or per-row policy data.
3. **Only complete compatible single-frame climbs.** Require listed, non-draft,
   single-frame layout-8 climbs with statistics at the requested supported angle.
   Reject malformed frames, repeated placements, unknown roles, or any placement
   absent from the complete installed definition. Do not require start/finish
   roles or otherwise impose extra climb-authoring conventions. Never thin holds.
4. **Grades retain source meaning.** Display the source grade label selected by
   `ROUND(display_difficulty)`; preserve the unrounded display, community, and
   nullable benchmark values. A missing grade-label row leaves the existing
   optional `grade` absent; it does not discard a valid climb or invent a label.
   Filter inclusively on the rounded native grade value. These numbers are the
   selected provider's grade scale, not a universal cross-board grade conversion.
5. **Bound each query.** Return at most 100 climbs (default 25), inspect at most
   250 candidate rows, and fetch one extra row only to determine continuation.
   Use a stable source-ID keyset cursor, not growing SQL offsets. A page may be
   short or empty while still returning a continuation cursor; callers must use
   `nextCursor`, not item count, to detect exhaustion. There is no total count.
6. **Bind a cursor to one snapshot and filter.** An adapter represents one
   immutable catalog snapshot. A new install/replacement constructs a new adapter;
   in-place incremental writes are outside this contract. Cursor contents bind the
   snapshot ID, definition revision, normalized query filters, and last inspected
   source ID. Reject malformed or mismatched cursors before querying. Cursors are
   local continuation tokens, not security credentials or durable share URLs.
7. **Distinguish absence and failure.** `isReady() === false` yields explicit
   `unavailable`. Empty results are `ready`. A missing, unlisted, incompatible,
   malformed, wrong-provider, wrong-revision, or angle-unavailable detail is
   `ready` with `null`; database/schema/read failures reject with a stable
   `CatalogReadError` and original cause. Invalid query arguments throw
   `TypeError`/`RangeError` before issuing SQL.
8. **Narrow first filter set.** Support name substring, supported angle, and
   minimum/maximum grade plus lookup by namespaced ID. Grade choices come from
   the query boundary. Quality/ascent statistics are returned, but extra filters,
   relevance/popularity ordering, hold filtering, and URL routing belong to later
   consumer-driven extensions. Snapshot provenance is injected and never inferred
   from the current clock or latest climb date.

## Architectural choice

**Chosen: a small typed catalog contract with a Kilter SQL adapter and a pure frame
projection helper.** SQL handles source scope, name/angle/grade filtering, and
bounded keyset retrieval. The helper validates the complete row and frame against
the existing immutable Fullride definition and creates an existing view record
with metadata. This keeps both the physical truth and native catalog truth under
their present owners and requires no new persistence or library dependencies.

Alternatives considered: loading and normalizing the entire catalog into a second
in-memory index would simplify later filtering but adds an up-front full scan,
duplicate state, and snapshot invalidation machinery. A new normalized SQLite
schema/materialized compatibility table would make paginated compatible queries
simpler but introduces an import/write contract before bootstrap has settled.
Neither is justified for this read-only slice. Bounded post-query validation keeps
the future replacement point confined to one adapter; its short-page behavior is
explicit rather than hidden behind unbounded refill loops.

## Implementation Units

### Unit 1: Complete-route projection — trickiest unit

**File**: `web/src/data/catalog/kilter-projection.ts`

```typescript
import type { Row } from '../port.ts';
import type { BoardDefinition } from '../../domain/boards/definition.ts';
import type { CatalogClimb } from '../../catalog/types.ts';

export function projectKilterClimb(
  row: Row,
  definition: BoardDefinition,
): CatalogClimb | null;
```

**Implementation Notes**:
- Consume explicitly aliased columns from Unit 3. Validate required source fields
  at this boundary; no unchecked cast from `Row` to a trusted climb. Native numeric
  grades and quality must be finite and nonnegative; ascent count must additionally
  be an integer. Benchmark may be `null`, including preservation of a numeric zero.
  Name and UUID must be nonblank strings; setter/description may be empty strings.
- The result uses the existing `KILTER_PROVIDER_ID`, the source UUID, the supplied
  definition's layout revision, and `providerClimbViewKey`. Angle comes from the
  selected `climb_stats` row, never the climb's original angle.
- Build native-placement and native-role lookup maps from `definition.placements`
  and `definition.rolePresets`; do not repeat a hand-maintained mapping of 42–45.
  Parse the entire frames string as consecutive `p<positive-id>r<positive-id>`
  tokens with no skipped characters, trailing junk, whitespace, or leading-zero
  aliases. Reject an empty frame, duplicate placements, unsupported role IDs,
  unknown placements, or more assignments than the installed definition supports.
  A bounded frame-length guard of 16,384 characters is sufficient for this
  305-placement definition and rejects the entire record when exceeded.
- Map each token to a semantic `BoardHoldAssignment` using the existing semantic
  appearance shape. Preserve order and all assignments. Supply no effect recipes.
- `nativeGrades.scale` is `kilter-difficulty`; `gradeValue` is the rounded display
  value. Preserve raw numeric values separately. Copy/freeze returned metadata
  sufficiently that caller mutation cannot change later results.
- Schema-wide errors belong to the adapter. Individual unusable records return
  `null`; healthy neighboring rows remain available.

**Acceptance Criteria**:
- [x] A synthetic Fullride frame with roles 42, 43, 44, and 45 maps every native
      placement to its generated domain ID and correct semantic appearance.
- [x] One unavailable hold rejects the whole climb; no partial result is returned.
- [x] Malformed, empty, duplicate, oversized, wrong-layout, draft, unlisted,
      multi-frame, invalid-numeric, and unsupported-role inputs are excluded.
- [x] The selected angle, native grade values, source identity, setter,
      and description survive projection without changing the source row.
- [x] A missing label preserves a usable record and its numeric grade.

### Unit 2: Consumer contract

**File**: `web/src/catalog/types.ts`

```typescript
import type { ClimbViewRecord } from '../climb-browser/types.ts';
import type { Brand, ProviderClimbId } from '../domain/boards/types.ts';

export type CatalogCursor = Brand<string, 'CatalogCursor'>;

export interface CatalogProvenance {
  readonly source: string;
  readonly snapshotId: string;
  readonly retrievedAt: string | null;
  readonly coverage: string | null;
}

export interface CatalogClimb extends ClimbViewRecord {
  readonly origin: 'provider';
  readonly providerClimbId: ProviderClimbId;
  readonly gradeValue: number;
  readonly nativeGrades: Readonly<{
    scale: string;
    display: number;
    community: number;
    benchmark: number | null;
  }>;
  readonly statistics: Readonly<{
    ascentCount: number;
    quality: number;
  }>;
}

export interface CatalogGradeOption {
  readonly value: number;
  readonly label: string;
}

export interface CatalogClimbQuery {
  readonly angle: number;
  readonly name?: string;
  readonly minGrade?: number;
  readonly maxGrade?: number;
  readonly limit?: number;
  readonly cursor?: CatalogCursor;
}

export interface CatalogPage {
  readonly climbs: readonly CatalogClimb[];
  readonly nextCursor: CatalogCursor | null;
  readonly excludedCount: number;
}

export type CatalogRead<T> =
  | Readonly<{ status: 'unavailable' }>
  | Readonly<{ status: 'ready'; value: T }>;

export interface CatalogQueryPort {
  readonly provenance: CatalogProvenance;
  query(input: CatalogClimbQuery): Promise<CatalogRead<CatalogPage>>;
  get(id: ProviderClimbId, angle: number): Promise<CatalogRead<CatalogClimb | null>>;
  grades(): Promise<CatalogRead<readonly CatalogGradeOption[]>>;
}

export class CatalogReadError extends Error {
  constructor(message: string, options?: ErrorOptions);
}
```

**Implementation Notes**:
- `snapshotId` identifies the exact immutable input (for example a supplied hash
  or synthetic fixture ID). `source` and `snapshotId` must be nonblank. Unknown
  retrieval time and coverage stay `null`; never manufacture them. Expose this
  immutable object once on the query port, rather than on every climb. Acquisition
  authority and redistribution remain bootstrap/source-owner responsibilities.
- `excludedCount` counts only candidate rows inspected and rejected in this page,
  not all provider rows or all SQL-filtered records. This enables an honest later
  browser notice without a full-catalog scan.
- No raw schema types, SQL strings, worker lifecycle, or source URLs are required
  from callers. Consumers can pass `CatalogClimb` directly to the existing viewer
  and use `providerClimbId` for existing provider playlist references.

**Acceptance Criteria**:
- [x] Existing `ClimbViewRecord`, identity helpers, and playlist reference types
      remain unchanged; the new record is structurally usable by those consumers.
- [x] Unavailable, empty, and failed reads have distinct behavior.
- [x] No new runtime dependencies or independently persisted climb model exist.

### Unit 3: Parameterized Kilter catalog adapter

**File**: `web/src/data/catalog/kilter-catalog.ts`

```typescript
import type { CatalogPort } from '../port.ts';
import type { BoardDefinition } from '../../domain/boards/definition.ts';
import type { CatalogProvenance, CatalogQueryPort } from '../../catalog/types.ts';

export function createKilterCatalog(
  catalog: CatalogPort,
  definition: BoardDefinition,
  provenance: CatalogProvenance,
): CatalogQueryPort;
```

**Implementation Notes**:
- Accept only the verified Fullride 7x10 definition ID/revision in this slice;
  fail constructor validation for another definition. Derive layout/native maps
  from that definition. No mutable global catalog or adapter cache.
- Validate requested angle against `supportedAngles`; limit is an integer 1–100
  with default 25. Grade bounds are finite nonnegative integers, ordered when
  both are present. Name is trimmed, at most 200 UTF-16 code units. Blank means
  no name filter. Invalid inputs perform no SQL.
- Query explicitly selected columns from `climbs c JOIN climb_stats s ON
  s.climb_uuid=c.uuid`, scoped by layout, listed/non-draft/single-frame flags,
  and `s.angle`. Left-join the grade label on `ROUND(s.display_difficulty)`.
  Use bound values for **all** caller values including IDs, search text, limits,
  cursor keys, angle, and grade bounds; SQL fragments are fixed adapter-owned
  clauses only. Literal substring matching uses `instr(lower(c.name), lower(?))`
  so `%`, `_`, quotes, and SQL-looking text are ordinary search characters.
- Stable first ordering is `c.uuid COLLATE BINARY ASC`. Cursor continuation uses
  `c.uuid COLLATE BINARY > ?`. This is deterministic enumeration, not a promised
  popularity or alphabetical sort. Grade options are separately value-ordered.
- Fetch at most 251 candidates. Project sequentially until requested valid count
  is reached or 250 candidates have been inspected. The continuation records the
  **last inspected** UUID, including excluded rows. Uninspected prefetched rows
  remain eligible on the next call. Emit `null` only when no remaining candidate
  is known. Do not loop internally to refill from the entire catalog.
- Keep cursor encoding/decoding private in this adapter. A bounded JSON string
  token is sufficient; do not add signing, persisted sessions, or a generic cursor
  framework. Validate shape, size (max 4,096 characters), snapshot/revision, and
  normalized filter tuple. Bind angle, normalized name, and grade bounds; page
  size may change between calls. Reject stale/mismatched tokens with `TypeError`.
- `get` binds one native source ID and angle with the same source eligibility
  rules and projection; use no name/grade pagination filters. Wrong provider or
  layout revision returns `ready/null` without SQL when the catalog is available.
- `grades` reads listed `difficulty_grades` values/labels in ascending numeric
  order and returns only finite nonnegative integer values and nonblank labels.
  Bound retrieval to 257 rows and fail clearly if the supported 256-choice bound
  is exceeded; do not silently truncate the scale.
- Check `catalog.isReady()` before reads. Wrap a rejected readiness/query call in
  `CatalogReadError` with its original cause; do not translate a damaged or
  incompatible schema into a healthy empty result. Do not call `catalog.close()`.

**Acceptance Criteria**:
- [x] Name/grade/angle filters return the expected synthetic climbs through real
      SQLite, including literal wildcard and injection-looking name searches.
- [x] Pagination returns every eligible fixture climb once, including valid
      climbs after runs of incompatible/malformed rows and short/empty pages.
- [x] Every query bounds candidate reads and output; changing a filter or snapshot
      invalidates an old cursor before SQL executes.
- [x] `get` accepts existing provider playlist identities, isolates provider and
      revision namespaces, and returns the same record as an eligible query row.
- [x] Query readiness/failure leaves local drafts, playlists, source tables, and
      connection ownership untouched.

## Implementation Order

1. Add the minimal contract from Unit 2, then prove Unit 1's complete-frame
   projection against a synthetic Fullride fixture. This is the most consequential
   correctness boundary because a partial route could light the wrong climb.
2. Implement Unit 3 and real-engine pagination/filter/detail tests together.
3. Run relevant verification, record evidence here, and advance to feature review.

No child stories: this is one tightly coupled, single-owner read-path stride.
No mockups: it introduces no UI surface and changes no existing visual structure.
Bootstrap, app wiring, browser UX, and independent review remain separately owned.

## Testing

**`web/src/data/catalog/kilter-projection.test.ts`** — table-driven pure tests for
the physical truth boundary: all four Fullride roles, a hold outside the 305,
unknown roles, duplicate holds, malformed/trailing/oversized frames, invalid source
scope/numbers, absent labels, and native metadata retention. Derive expected domain
placement identities from the committed definition; fixture role IDs remain
explicitly 42–45 so an Original-layout 12–15 mapping cannot pass.

**`web/src/data/catalog/__fixtures__/fullride-catalog.sql`** — small synthetic
schema-faithful `climbs`, `climb_stats`, and `difficulty_grades` tables with only
required columns, explicit layout 8, supported placement IDs such as 4117–4120,
all four Fullride roles, and fictional climb/setter text. Include two angles,
fractional/benchmark grades, a missing grade label, nonlisted/draft/multiframe
rows, and at least one unsupported-placement route. No community records or binary
snapshot is committed. The existing layout-1 SQL-engine fixture remains unchanged.

**`web/src/data/catalog/kilter-catalog.test.ts`** — use real `CatalogDb`/
`MemoryVFS` and the existing injected-WASM Node test pattern, wrapping readiness
as a promise to satisfy `CatalogPort`. Verify combined filters, grade rounding,
literal search characters, exact namespaced detail lookup, missing-angle behavior,
preserved metadata, unavailable versus read failure, and source row immutability.
Generate enough additional synthetic rows in the test to cross the 250-candidate
boundary; verify complete enumeration with no lost/duplicated valid climbs and
bounded individual reads. A thin recording port proves invalid arguments/cursors
perform no SQL and confirms each executed read is bounded. Do not substitute SQL
string snapshots for result-level assertions.

**Commands**: targeted new tests first, then web typecheck/lint/full unit suite and
production build as required by implementation. Existing browser workflows/CI
remain the integration regression check; do not add a browser test for a module
that has no browser consumer yet. Feature completion still requires standard
independent review and green required CI through the parent delivery workflow.

## Risks

- **Most consequential assumption: exact frame compatibility.** Layout 8 also
  contains holds outside the installed 7x10. Definition membership and complete
  parsing are mandatory; unknown records are excluded whole. If a native variant
  cannot be interpreted, retain the source untouched and add support with a real
  fixture rather than guessing or clipping holds.
- **Sparse compatible matches.** A bounded page can be empty with more data.
  Consumers must follow the explicit cursor. If measured browsing later demands
  a precomputed compatibility index, implement it at install time in its owning
  item rather than hiding an unbounded scan here.
- **Snapshot replacement.** Keyset reads assume immutable data and one adapter
  per snapshot. Bootstrap must keep the previous snapshot readable until replacement
  succeeds; a future incremental writer must revisit this contract explicitly.
- **Legacy schema versus current source.** This design is least certain about
  compatibility with future first-party Kilter acquisition, which remains outside
  its evidence. Preserve source identity/provenance and replace/add the acquisition
  adapter after research; do not reinterpret a legacy record as current coverage.
- **Missing or corrupt schema.** An explicit read error leaves personal libraries
  usable when this adapter is integrated later. No error path clears storage,
  fabricates an empty installed catalog, or modifies authored library data.

## Implementation notes
- Execution capability: GPT-6 Luna (high), selected by the orchestrator for this bounded adapter and projection delivery.
- Review weight: standard, from `.work/CONVENTIONS.md`.
- Files changed: `web/src/catalog/types.ts`; `web/src/data/catalog/kilter-catalog.ts`; `web/src/data/catalog/kilter-projection.ts`; their two tests and the synthetic SQL fixture.
- Tests added: 25 tests covering complete-frame mapping, rejection of incompatible rows, real-SQLite filters/details/grades, literal search input, cursor invalidation and traversal beyond 250 rejected candidates, identity isolation, readiness and read errors, and row immutability.
- Simplification: no additional database model, worker, cache, query framework, or runtime dependency was introduced.
- Discrepancies from design: none. The adapter selects the documented `climb_stats.difficulty_average` source column and aliases it at the boundary.
- Adjacent issues parked: none.
- Verification: Node 20.20.2; focused catalog tests 25/25 pass after final test edits; full web unit suite 689/689 pass; full web ESLint passes; TypeScript `--noEmit` passes; Vite production build passes.

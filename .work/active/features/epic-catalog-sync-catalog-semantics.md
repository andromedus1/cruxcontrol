---
id: epic-catalog-sync-catalog-semantics
kind: feature
stage: implementing
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

## Architectural choice

**Chosen — manifest-driven presentation over one query adapter.** The installed
manifest (already persisted in the catalog receipt) is the single source of catalog
meaning. `parseCatalogManifest` returns a discriminated union (schema 2 legacy,
schema 3 Boardsesh). One pure module, `web/src/catalog/presentation.ts`, maps a
manifest (or `null` before any manifest is known) to source wording, provenance and
the rating scale. The service builds the existing Kilter query adapter per receipt
with that scale, so filter validation, cursors and caches stay bound to the installed
snapshot identity (sha256) exactly as today. The optional `climbs.upstream_removed_at`
column is probed once per adapter (`PRAGMA table_info(climbs)`), so artifacts with
and without it share one SQL path; the projected record carries an optional
`upstreamRemovedOn` date that the shared climb row, climb detail and playlist rows
render as the "Removed upstream" badge.

Alternatives considered:

- **(B) Read presentation metadata from the artifact (`catalog_meta`) at runtime.**
  Rejected: the legacy artifact has no such table, wording would wait on an async
  SQLite read before the source row can render, and it duplicates provenance the
  manifest and receipt already carry.
- **(C) Record marker-column presence in the install receipt.** Rejected: it needs a
  receipt schema bump and migration for existing installs, while a lazy one-query
  probe on the per-snapshot adapter is cheap, retryable and naturally rebinds when a
  new snapshot installs.

Trickiest part: keeping every legacy behavior identical (wording, three-star scale,
cursor shape, provenance) while making the adapter accept the new column and scale.
Unit 3 (adapter/projection) is built first after the manifest types.

## Implementation Units

### Unit 1: Schema-3 manifest parsing

**File**: `web/src/data/catalog/manifest.ts`

```ts
interface CatalogManifestBase {
  version: number; board: 'kilter-fullride-7x10'; file: string; compression: 'gzip';
  sha256: string; bytesGzipped: number; bytesRaw: number; generatedOn: string;
  generatedFrom: string; filter: string;
}
export interface LegacyCatalogManifest extends CatalogManifestBase {
  schemaVersion: 2; source: 'legacy-aurora-kilter'; sourceDataThrough: string | null;
}
export interface CatalogQualityScale { readonly min: number; readonly max: number }
export interface CatalogChangeSummary {
  readonly added: number; readonly removed: number; readonly restored: number;
}
export interface BoardseshCatalogManifest extends CatalogManifestBase {
  schemaVersion: 3; source: 'boardsesh-kilter';
  sourceBuiltAt: string;                                  // ISO-8601 UTC instant
  sourceWatermarks: Readonly<Record<string, string>>;     // table -> ISO instant
  layoutRevision: string; qualityScale: CatalogQualityScale; climbCount: number;
  removedUpstreamCount: number | null;                    // null = not reported
  changes: CatalogChangeSummary | null;                   // null = not reported
}
export type CatalogManifest = LegacyCatalogManifest | BoardseshCatalogManifest;
export function parseCatalogManifest(value: unknown): CatalogManifest;
```

**Implementation notes**:
- Shared fields keep today's checks and size limits (`size` code above limits).
- Schema 3 requires every key of `__fixtures__/manifest-v3.example.json`:
  `sourceBuiltAt` and watermark values match `YYYY-MM-DDTHH:MM:SS(.fraction)?Z` with a
  real calendar date; `sourceWatermarks` is an object of at most 32 `[a-z0-9_]{1,64}`
  keys; `layoutRevision` is bounded `kilter:<int>:<int>:<int>:<hex>` text;
  `qualityScale` has finite `0 ≤ min < max ≤ 10`; `climbCount` is a positive safe
  integer.
- **Decision (optional fields)**: `removedUpstreamCount` and `changes` may be absent or
  `null` (older/first-build schema-3 manifests); both normalize to `null`. When
  present, `removedUpstreamCount` is a safe integer ≥ 0 and `changes` an object whose
  `added`, `removed`, `restored` are safe integers ≥ 0. They are parsed for the later
  device-update prompt; no cross-field arithmetic is enforced because the counting
  basis is owned by `append-only-guards`.
- Unknown extra keys stay ignored (unchanged policy); the result is a fresh frozen
  object, so receipts round-trip through the same parser.

**Acceptance criteria**:
- [ ] `manifest-v3.example.json` parses with `removedUpstreamCount`/`changes` null.
- [ ] A v3 manifest with valid `removedUpstreamCount` and `changes` parses them.
- [ ] Each malformed v3 field (source/schema mismatch, bad instant, bad scale, bad
      counts, bad `changes`, bad watermark) is rejected with code `manifest`; limits
      still yield `size`; all existing schema-2 cases behave as before.

### Unit 2: Presentation (wording, provenance and rating scale)

**File**: `web/src/catalog/presentation.ts` (new)

```ts
export type CatalogRatingScale = CatalogQualityScale;
export const LEGACY_RATING_SCALE: CatalogRatingScale;          // { min: 0, max: 3 }
export function catalogRatingScale(manifest: CatalogManifest): CatalogRatingScale;
export interface CatalogSourceCopy {
  readonly kind: 'legacy' | 'boardsesh' | 'unknown';
  readonly name: string;        // "Legacy Kilter" | "Kilter community" | "Kilter catalog"
  readonly title: string;       // Manage dialog heading
  readonly headline: string;    // source-row first line
  readonly summary: string;     // source-row second line
  readonly climbLabel: string;  // climb detail eyebrow
  readonly setupDescription: string;
}
export function catalogSourceCopy(manifest: CatalogManifest | null): CatalogSourceCopy;
export function catalogProvenance(manifest: CatalogManifest): CatalogProvenance;
export function formatCatalogDate(value: string): string;   // YYYY-MM-DD, UTC, medium
export function ratingScaleDescription(scale: CatalogRatingScale): string;
```

**Implementation notes**:
- Legacy copy reproduces today's strings exactly ("Legacy Kilter", "Older offline
  snapshot · no live updates", "Legacy Kilter · read only", …) and today's provenance.
- Boardsesh copy per the operator decision: headline "Kilter community climbs via
  Boardsesh · updated <generatedOn>", summary "Not official Kilter data · setters
  credited". The build date is the artifact's `generatedOn` (the installed version's
  build date); the Boardsesh `sourceBuiltAt` appears in Manage details.
- `unknown` (no receipt and no offer yet) uses neutral wording so nothing is claimed
  about a catalog whose manifest has not been read.

**Acceptance criteria**:
- [ ] Legacy, Boardsesh and unknown manifests select their wording; the Boardsesh
      headline contains the formatted build date.
- [ ] Rating scale is 0–3 for schema 2 and `qualityScale` for schema 3.

### Unit 3: Query adapter and projection

**Files**: `web/src/data/catalog/kilter-catalog.ts`, `kilter-projection.ts`,
`web/src/catalog/types.ts`, `web/src/climb-browser/types.ts`

```ts
// climb-browser/types.ts
interface ClimbViewRecord { …; readonly upstreamRemovedOn?: string } // YYYY-MM-DD
// catalog/types.ts
interface CatalogQueryPort { …; readonly ratingScale: CatalogRatingScale }
// kilter-catalog.ts
export function createKilterCatalog(
  catalog: CatalogPort, definition: BoardDefinition,
  provenance: CatalogProvenance, ratingScale: CatalogRatingScale,
): CatalogQueryPort;
```

**Implementation notes**:
- `minRating` must be finite within `[ratingScale.min, ratingScale.max]`; the adapter
  rejects an invalid scale at construction.
- One memoized probe per adapter, after `isReady()`: `PRAGMA table_info(climbs)`;
  the projected column is `c.upstream_removed_at` when present, else `NULL`, aliased
  `source_upstream_removed_at`. A failed probe is not cached (retry possible).
- Projection: `null`/absent → present upstream; a valid `YYYY-MM-DD` → the record gets
  `upstreamRemovedOn`; any other value rejects the record (install validation makes
  this unreachable for accepted artifacts). No other projection rule changes, so no
  previously accepted climb is excluded.
- `get()` keeps exact `c.uuid = ?` matching: playlist references keep resolving by
  their exact spelling, including removed-upstream climbs (still `is_listed = 1`).
- Cursor v2 shape is unchanged and still bound to `snapshotId` (manifest sha256).

**Acceptance criteria**:
- [ ] Without the column, results match today and carry no `upstreamRemovedOn`.
- [ ] With the column, removed climbs are returned by `query` and `get` with
      `upstreamRemovedOn`; present climbs have none.
- [ ] `minRating` 4.5 is accepted on a 0–5 adapter and rejected on the 0–3 adapter.
- [ ] A cursor from one snapshot adapter is rejected by another snapshot's adapter.

### Unit 4: Install-time validation

**File**: `web/src/data/sqlite/catalog-install.ts`

- Required columns unchanged (the marker stays optional). When `climbs` has
  `upstream_removed_at`, every non-NULL value must be text in `YYYY-MM-DD` form and a
  real date, else `schema` failure (active catalog retained).
- A schema-3 manifest's `layoutRevision` must equal the installed Fullride definition
  revision, else `schema` failure.

**Acceptance criteria**:
- [ ] Artifacts with and without the column install; a malformed marker or foreign
      `layoutRevision` is rejected and the previous receipt stays active.
- [ ] A schema-3 manifest installs and its receipt re-reads through the parser.

### Unit 5: Service binding

**File**: `web/src/catalog/service.ts` — `queryForReceipt` uses
`catalogProvenance(manifest)` and `catalogRatingScale(manifest)`. Adapter caching
by sha256 is unchanged; legacy provenance stays identical.

**Acceptance criteria**:
- [ ] A schema-3 receipt yields Boardsesh provenance and a 0–5 adapter scale; the
      legacy receipt yields today's provenance and 0–3.

### Unit 6: UI

**Files**: `web/src/catalog/{CatalogBrowser,CatalogFilterDialog,CatalogManageDialog}.tsx`,
`catalog.css`, `web/src/climb-browser/{ClimbDetail,LocalClimbViewer}.tsx`,
`web/src/climb-browser/UpstreamRemovedBadge.tsx` (+ `upstream-badge.css`, new),
`web/src/playlists/PlaylistLibrary.tsx`, `web/src/app/CruxControlWorkspace.tsx`.

- Source row, filter form label, Manage title/facts/download labels and the climb
  eyebrow come from `catalogSourceCopy(receipt?.manifest ?? offer ?? null)`.
- The filter dialog takes `ratingScale`: input `min`/`max`, validation, error text and
  hint follow it; the Boardsesh hint adds that sends can go down as well as up between
  versions. Chips and row metrics show `/ <max>`. A committed `minRating` outside a
  newly installed scale is dropped rather than sent to the adapter.
- Setter credit: row meta reads "· set by <setter>" and detail shows "Set by" (only
  provider climbs carry a setter). Playlist rows for resolved provider climbs show
  "set by <setter>".
- "Removed upstream" badge (`UpstreamRemovedBadge`) in catalog rows, climb detail
  (with a one-line explanation and the date) and playlist rows; play-through inherits
  it through `ClimbDetail`.
- Manage dialog for Boardsesh: not-official statement, version + build date, Boardsesh
  snapshot time, climb count and removed-upstream count when reported, rating scale and
  sends semantics. Legacy facts unchanged.
- Workspace list-resolution hint drops "older" ("Install the Kilter catalog …").

**Acceptance criteria**:
- [ ] A legacy receipt renders today's wording and "/ 3"; a Boardsesh receipt renders
      the decided wording, "/ 5", the 0–5 hint and accepts a 4.5 minimum rating.
- [ ] Removed climbs show the badge in rows, detail and playlist rows; present climbs
      do not.

### Unit 7: Foundation docs

`docs/SPEC.md` §2 (rating scale, source wording, removed-upstream, setter credit),
`docs/ARCHITECTURE.md` (Module Map 3 "current app builds reject schema 3", rating
0–3 statement), `README.md` only where a statement becomes false.

## Implementation Order

1. Unit 1 manifest union + tests (everything else types against it).
2. Unit 3 adapter/projection + marker probe + tests (trickiest).
3. Unit 2 presentation module + tests; Unit 5 service binding.
4. Unit 4 install validation + tests.
5. Unit 6 UI and component tests; repair stale tests.
6. Unit 7 docs; lint/typecheck/test/build; catalog e2e.

No child stories: the units share one type change (manifest union → adapter scale →
UI) and are delivered by one owner in one PR.

## Testing

- `manifest.test.ts`: v3 example, optional fields present/absent/null, every malformed
  v3 field, unchanged v2 cases.
- `kilter-projection.test.ts`: marker absent/null/date/malformed.
- `kilter-catalog.test.ts`: real SQLite with and without the column (via `ALTER
  TABLE`), removed climbs searchable and resolvable by exact UUID, scale-driven
  `minRating` validation, cursor snapshot binding.
- `catalog-install.test.ts`: schema-3 install with the marker column, malformed marker
  and foreign layout revision rejected with the active receipt retained.
- `catalog-receipt.test.ts`: schema-3 receipt round trip.
- `presentation.test.ts`: wording, provenance and scale selection.
- `service.test.ts`: schema-3 receipt yields Boardsesh provenance and 0–5 scale.
- Component tests: `CatalogBrowser`, `CatalogManageDialog`, viewer/detail and
  `PlaylistLibrary` badge + setter credit; `resolve.test.ts` removed climb resolves.

## Risks

- **Legacy regression** — wording or cursor drift for the installed legacy snapshot.
  Mitigation: legacy copy and provenance asserted verbatim; existing e2e strings kept.
- **Contract drift with `append-only-guards`** — marker or manifest fields differ when
  that branch lands. Mitigation: shared contract recorded in both items; the parser
  accepts absence of the two late fields; marker validation is format-only.
- **Probe under read-only pragmas** — `PRAGMA table_info` with `query_only` and
  `trusted_schema=OFF`. Mitigation: install validation already runs the same pragma on
  that connection.
- **Least sure**: whether "updated <date>" should use `sourceBuiltAt` rather than
  `generatedOn`; both are equal for today's builds and both are shown in Manage.

---
id: epic-catalog-sync-append-only-guards
kind: feature
stage: done
tags: [data]
parent: epic-catalog-sync
depends_on: [epic-catalog-sync-snapshot-normalize]
release_binding: null
gate_origin: null
created: 2026-10-19
updated: 2026-10-19
research_refs:
  - .research/analysis/campaigns/kilter-current-catalog-sources/parent.md
---

# Append-Only Catalog Reconciliation and Fail-Closed Update Guards

## Brief

Combine the previously published artifact with a newly normalized one so that the set
of climb identities only grows. A climb that is absent, unlisted, excluded or folded
into an alias upstream stays in the catalog, marked removed upstream with the date it
was first observed missing; a climb that reappears is restored. New and changed climbs
and refreshed stats are taken from the new snapshot. Output: the next artifact version
(strictly increasing), a machine-readable diff report (new, changed, newly removed,
restored, listed counts) and a guard verdict.

The guards fail closed. The build publishes nothing and keeps the last-known-good
artifact when: the upstream manifest or artifact is missing or unparseable; schema or
format versions change; size-17 hardware differs; the upstream listed-climb count drops
beyond a threshold; newly removed climbs exceed a cap; or the merged artifact would
lose any previously published UUID. Thresholds are set in this feature's design,
recorded in code with tests, and tuned from real diffs. Bootstrapping from the current
`legacy-aurora-kilter` artifact must keep all of its UUIDs.

It does **not** fetch, schedule or publish (publish pipeline), and does not change app
behavior for removed climbs (catalog semantics).

## Epic context

- Parent epic: `epic-catalog-sync`
- Position in epic: consumer of `epic-catalog-sync-snapshot-normalize`; the publish
  pipeline consumes its verdict and report.

## Inherited design decisions

- Climb identities are append-only; nothing is hard-deleted.
- Fail closed on suspicious upstream data; keep last-known-good; retain prior versions.
- Auto-publish when every guard passes; a tripped guard holds publication and notifies
  the operator (publish pipeline owns notification).

## Research briefs

- [Current Kilter catalog sources](../../../.research/analysis/campaigns/kilter-current-catalog-sources/parent.md) §4 Deletions and edits, Climb identity and
  coverage (94 already unlisted, alias folds, exclusions, no deletion feed) and
  implementation notes 5–6.

## Foundation references

- `docs/SPEC.md` §6 Data Acquisition; `docs/ARCHITECTURE.md` Biggest Risks (sync API
  drift).

## Design decisions

- **Guard limits (operator, 2026-10-19)**: hold publication when the upstream-present
  climb count falls more than 2% below the previous artifact's, or more than 250
  climbs become newly removed upstream in one run.
- **Identity scope**: append-only applies to identities the app could ever show — the
  previous artifact's climbs that pass the same size-17 lightability rule. Legacy rows
  the app always excluded (unlit placements, multi-frame) are not carried; nothing
  user-visible or playlist-referenced is lost.
- **Removed-upstream marker (shared contract with `catalog-semantics`)**:
  `climbs.upstream_removed_at TEXT NULL` — the `YYYY-MM-DD` build date on which the
  climb was first no longer listed upstream; NULL means present upstream. Carried
  climbs keep `is_listed = 1` (the app's projection requires it) plus their frozen
  stats from the previous artifact. A climb that reappears upstream is restored
  (marker cleared, fresh data).
- **Versioning**: next version = previous manifest `version + 1`; builds never reuse or
  lower a version.
- **Upstream not newer**: if the snapshot's `sourceBuiltAt` equals the previous
  artifact's, the run ends "unchanged" (nothing to publish); if it is older, the guard
  holds (possible upstream rollback).
- **Manifest additions**: `removedUpstreamCount` and `changes` (`added`, `removed`,
  `restored`, relative to the previous version) for the device update prompt.

## Architectural choice

Reconciliation runs after normalization on the freshly built SQLite file, before
finalize: it attaches the previous artifact read-only, copies forward missing
identities with their frozen rows and stats, sets the marker, computes the diff, and
evaluates guards. Guards are pure functions over a `ReconcileReport`, so thresholds are
unit-testable without SQLite. Alternatives: (B) merging inside normalization — couples
upstream parsing with history and makes normalization non-deterministic in its inputs;
(C) diffing two finished artifacts outside the build — duplicates finalize and cannot
stop an artifact being written.

## Implementation Units

### Unit 1: Previous-artifact loader — `web/scripts/catalog/previous.py`

```python
@dataclass(frozen=True)
class PreviousArtifact:
    db_path: Path                 # decompressed, verified against manifest sha256/bytesRaw
    manifest: dict
    version: int
    schema_version: int           # 2 (legacy) or 3
    source_built_at: Optional[str]  # None for legacy schema 2

class PreviousArtifactError(Exception): ...

def load_previous(manifest_path: Path, artifact_path: Path, work_dir: Path) -> PreviousArtifact: ...
```
Verifies sha256 of the gzip bytes and raw size; accepts schema 2 (`legacy-aurora-kilter`)
and schema 3 (`boardsesh-kilter`) only.

### Unit 2: Reconcile — `web/scripts/catalog/reconcile.py`

```python
@dataclass
class ReconcileReport:
    previous_version: int
    previous_present: int         # previous lightable identities with marker NULL
    present: int                  # new upstream-present climbs
    added: int
    removed: int                  # newly marked this run
    restored: int
    carried: int                  # all marked climbs in the new artifact
    lost: List[str]               # previous identities missing after merge (must be empty)

def reconcile(new_db: sqlite3.Connection, previous: PreviousArtifact,
              scope: HardwareScope, build_date: str) -> ReconcileReport: ...
```
Adds `upstream_removed_at` to the new `climbs` table; copies forward previous
lightable climbs absent from the new set (legacy rows map by column name;
`upstream_frames` = previous frames when absent); keeps the earlier marker date when a
climb was already removed; copies their stats.

### Unit 3: Guards — `web/scripts/catalog/guards.py`

```python
MAX_PRESENT_DROP_FRACTION = 0.02
MAX_NEWLY_REMOVED = 250

@dataclass(frozen=True)
class GuardVerdict:
    publish: bool
    unchanged: bool
    reasons: Tuple[str, ...]

def evaluate(report: ReconcileReport, previous: PreviousArtifact,
             source_built_at: str, revision: str) -> GuardVerdict: ...
```
Holds on: any `lost` identity; present-count drop over 2%; newly removed over 250;
older `sourceBuiltAt`; revision different from the previous schema-3 manifest's.
`unchanged` when `sourceBuiltAt` equals the previous one.

### Unit 4: Build integration — `artifact.py`, `build-catalog-snapshot.py`

`--previous-dir DIR` (manifest.json + its artifact). Version defaults to previous + 1
(explicit `--version` must equal it). Manifest gains `removedUpstreamCount` and
`changes`; report JSON gains `reconcile` and `guards`. Exit codes: 7 guard hold (no
artifact written), 8 unchanged (no artifact written). Without `--previous-dir` the
build is a first build and refuses to run unless `--version` is given explicitly.

## Implementation Order

Guards (pure) → loader → reconcile → build integration → real-data bootstrap run from
the bundled legacy artifact.

## Testing

- Guards: each hold reason at and just past its threshold; unchanged vs older source.
- Reconcile on synthetic fixtures: carried climb keeps frozen stats and marker; marker
  date preserved across runs; restored climb clears marker; legacy schema-2 previous
  maps columns; unlightable legacy rows not carried; `lost` stays empty.
- Loader: sha/size mismatch and unsupported schema rejected.
- Build: version monotonic; hold and unchanged write no artifact; manifest example
  updated with the new keys.
- Real data (local): bootstrap from the bundled v1 artifact → v2 with 33 carried,
  13,299 present, guards pass.

## Risks

- **Threshold tuning**: real weekly churn is unmeasured. — **Fallback**: a hold is safe;
  thresholds are constants with tests and can be adjusted in a reviewed change.
- **Carried rows age**: frozen stats for removed climbs never update. — Accepted;
  marker tells the UI they are frozen.

## Implementation notes

- Execution capability: inline, single owner — extends the Python package from
  `snapshot-normalize`; runs alongside the separately delegated `catalog-semantics`.
- Review weight: standard (project default).
- Files changed: `web/scripts/catalog/{previous,reconcile,guards}.py` (new),
  `artifact.py`, `schema.py` (`climbs.upstream_removed_at`), `normalize_climbs.py`,
  `fixtures.py`, `web/scripts/build-catalog-snapshot.py` (`--previous-dir`, exit codes
  7/8/9, optional `--version`), `test_reconcile_guards.py` (new),
  `web/src/data/catalog/__fixtures__/manifest-v3.example.json` (adds
  `removedUpstreamCount`, `changes`), `docs/SPEC.md` §6, `docs/ARCHITECTURE.md` item 3.
- Tests added: 10 (guard thresholds at and past each limit, unchanged vs older
  upstream, lost/case/revision holds; carry → preserved marker → restore across four
  builds with frozen stats; legacy schema-2 previous carrying only app-visible climbs;
  held/unchanged builds write nothing; monotonic versions; previous-manifest
  verification). Suite: 38 tests green.
- Real-data verification (local, after review fixes): bootstrapping from the bundled
  v1 legacy artifact with the 2026-10-19 snapshot produced v2 with 13,322 climbs.
  App-visible (lightable with usable stats): 9,781 before → 11,016 present now;
  23 previously visible climbs carried and marked `2026-10-19`; 1 present climb kept
  its previous stats; changes added 1,258 / removed 23 / restored 0; `lost` empty;
  guards passed. Re-running against v2 with
  the same snapshot exits 8 (unchanged) and writes nothing.
- Discrepancies from design: the marker column lives in the base `climbs` schema
  (NULL on first builds) rather than being added during reconciliation; an "added"
  count for a first build equals all emitted climbs.
- Adjacent issues parked: none.

## Review

- Effective weight: standard; one independent pass.
- Reviewer: Codex `gpt-6.1-sol` (medium) via peeragent — cross-model. It ran the suite
  (38 green) plus in-memory probes for each finding.
- Proposed verdict: Request changes. Receiver adjudication (all accepted):
  - **Blocker — retention did not guarantee app visibility.** The app's climb query
    inner-joins stats; a previously visible climb present upstream but with no usable
    stats would vanish while `lost` stayed empty. Real data confirmed the shape (2,294
    climbs without stats in the first v2; 1 previously visible climb affected).
    Fixed: "app-visible" now requires a usable stats row; such climbs keep their
    previous stats (`stats_kept`); `lost` checks final visibility; present/added
    count visible climbs. Regression test added.
  - **Blocker — incomplete schema-3 previous manifests disabled guards.** Missing
    `sourceBuiltAt`/`layoutRevision` silently skipped the older-build and revision
    holds. Fixed: required for schema 3; regression test added.
  - **Important (fixed as part of the same contract) — build times compared as
    strings.** Now parsed as timezone-aware instants with any fractional precision;
    unparsable times hold. Regression tests for precision, offsets and malformed input.
- Verification after fixes: 40 tests green; real-data bootstrap as recorded above.
- Closure: standard weight — blockers fixed and verified, no second pass.

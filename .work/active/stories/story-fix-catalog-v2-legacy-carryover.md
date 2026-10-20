---
id: story-fix-catalog-v2-legacy-carryover
kind: story
stage: done
tags: [bug, data]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-10-20
updated: 2026-10-20
---

# Repair legacy rows that published catalog v2 carried forward unscaled or dropped

## Symptom
Promoted from `idea-repair-v2-legacy-carryover`. Published catalog v2 (2026-10-20) was
built before the `epic-catalog-sync` epic-review fixes (archived record at `77a4a72`):
46 stat rows of the 23 climbs carried from the Aurora-era v1 keep 1–3 ratings inside a
0–5 artifact, and 3 previously usable (climb, angle) pairs are missing. No current user
impact (no playlist references catalog climbs yet).

## Reproduction
Building "v3" from a pre-fix v2 (the local dry-run v2 built from the 2026-10-19
snapshot) with a newer upstream build time and current code: compared with a correct
rebuild, 46 rows stayed unscaled and 3 pairs stayed missing.

## Root cause
`reconcile` copies frozen rows verbatim from a schema-3 previous artifact (scale 1); the
×5/3 rescale applies only when the previous artifact is schema 2. v2 itself copied the
legacy rows unscaled and lost pairs under the pre-fix per-climb rule, and a schema-3
artifact records nothing that identifies those rows, so every later build reconciling
against v2 preserves the defects.

## Fix approach
An optional schema-2 legacy baseline (the bootstrapped v1, already in the private bucket)
for `reconcile`: a row copied forward from the previous artifact that still exactly
equals the raw baseline row is rescaled ×5/3, and a baseline pair missing for a climb in
the catalog is restored (rescaled). Corrected rows no longer match the raw values, so the
repair is idempotent. `build-catalog-snapshot.py --legacy-baseline DIR`; the publisher
downloads v1 and passes it on every run once a version above 1 exists.

## Regression test
`web/scripts/catalog/test_reconcile_guards.py::test_legacy_baseline_repairs_a_prefix_v2_once`
— rewrites a published artifact like the pre-fix v2 (carried rating unscaled, one pair
dropped for a climb still upstream), asserts the next build rescales it and restores the
pair (1/1), and that a further build changes nothing (0/0). The publish-script tests
exercise the baseline download path.

## Implementation notes
- Execution capability: inline; a bounded change in one module plus two call sites.
- Files: `web/scripts/catalog/reconcile.py`, `artifact.py`,
  `web/scripts/build-catalog-snapshot.py`, `web/scripts/catalog-publish.sh`,
  `test_reconcile_guards.py`.
- Confirmation: (1) new test passes; (2) full suite 49 tests pass; (3) original
  reproduction fixed — v3 from the pre-fix v2 now has 0 unscaled rows and 0 missing
  pairs versus a correct build (`legacy_rescaled` 46, `legacy_restored` 3, `lost` []);
  (4) idempotent on real data — the following build reports 0/0. The live repair happens
  on the next weekly publish (v3), delivered to the phone by the normal update prompt.
- Adjacent issues parked: none.

## Review (bounded inline, standalone story)
- Verdict: approve. No independent reviewer (standalone-story lane).
- Rescale applies only to rows copied forward from the previous artifact whose complete row
  (all metrics and first-ascent fields) equals the raw legacy row; fresh upstream rows are
  never touched, and Boardsesh's own Aurora-sourced values already differ by ×5/3.
- Restore targets only climbs present in the catalog; consistent with append-only.
- Idempotence verified on real data; an absent or non-schema-2 v1 skips the repair, and an
  invalid v1 fails closed through the existing previous-artifact checks.

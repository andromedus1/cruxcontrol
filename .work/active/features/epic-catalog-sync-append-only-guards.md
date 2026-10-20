---
id: epic-catalog-sync-append-only-guards
kind: feature
stage: drafting
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

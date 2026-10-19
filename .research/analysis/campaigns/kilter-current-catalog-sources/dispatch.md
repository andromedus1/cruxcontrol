---
provenance: agent-synthesis
intent: terminate-in-position
output_kind: synthesis-brief
consumer: calibrated-work
verification_rigor: full
temporal_contract: supersedes-prior
primitives_extends: []
primitives_opts_out: []
decision_relevance: >
  Selects whether a current, permitted source exists for updating CruxControl's
  installed offline Kilter Fullride 7x10 catalog toward current official-app coverage,
  and which acquisition adapter epic-catalog-sync designs around. A finding of "no
  permitted current source" redirects the epic toward retaining the older snapshot or
  user-authorized personal-data export.
scope_authority: mixed
analytical_artifact_type: per-campaign-brief
---

# Current Kilter catalog sources (refresh of docs/briefs/catalog-sync-api.md)

Commissioned for `.work/active/epics/epic-catalog-sync.md` (epic, stage drafting).
Refresh re-engagement: prior artifact `docs/briefs/catalog-sync-api.md` (2026-06-13),
`input_state: legacy`; loaded as lens only, never cited. Prior attestations under
`.research/attestation/` (boardlib, kilter-schema, scout-boardsesh-*) are re-validated
before reuse.

Pre-registered coverage (operator, 2026-10-19): (1) source inventory; (2) per-source
coverage, freshness, incremental vs full snapshot, request/response shapes where
public, auth, rate limits, Fullride placement-identity compatibility; (3) terms of
service / intended use / redistribution, separating personal-use acquisition from
public distribution; (4) ID mapping, deletions/edits, grade/stat schema differences.

Constraint: public or user-authorized sources only; no reverse engineering of private
APIs or bypassing access controls — if current data is reachable only that way, record
it as a finding.

## Decomposition (emergent, confirmed by operator 2026-10-19)

Candidates: A by source (3 facets); B by question (4 facets); C single inline pass.
Chosen: **A**. Each specialist answers all four question groups for its source so the
cross-synthesis compares like-for-like. Self-flag: Kilter's first-party terms likely
govern every route, so facet 1 owns that analysis and the cross-synthesis applies it to
facets 2–3.

1. `kilter-first-party` — Kilter's post-Aurora first-party app, web, API surface, data
   claim/export flows, and terms.
2. `legacy-aurora-sync` — kilterboardapp.com / Aurora sync API liveness and freshness,
   BoardLib current status.
3. `third-party-clients` — Boardsesh API and other third-party clients/datasets.

---
campaign: kilter-current-catalog-sources
gate: "evaluate (isolated context, synthesis + seed only)"
provenance: agent-synthesis
---

# Campaign evaluation

## Pass 1 — assessed parent.md sha256 a0b0683fe26d96cc — NEEDS-REVISION

Priority-ordered recommendations (summarized from the evaluator's inline report):

1. Quality-scale contradiction smoothed (0–5 doc vs 1–5 sync doc vs observed 0.25–5.0);
   key finding 6 and implementation note 7 depended on it.
2. Personal-use vs redistribution not separated (device fetch / distributed-app fetch /
   bundling or re-hosting); sources not assessed against the seed constraint; "none
   viable" outcome not addressed.
3. Counts and baseline unreconciled (34,070 vs role breakdown; baseline scope undefined;
   1,129 pre-split absent climbs unexplained); completeness gap not listed.
4. Inference markers dropped in frontmatter; "Original-product" unattested.
5. Hangtime missing from inventory.
6. Minor: alias wording, launch-date tension row, BoardLib row label, "rebuilt at least
   daily", authoring-history phrasing, manifest/table shape, stat angle set.

Disposition: all six addressed in revision (sha256 0691f2dfc3d7da8a). New measurements
added to kcs-boardsesh-kilter8-artifact (listed/unlisted split, no mixed-role rows,
2,278 absent breakdown incl. 523 dashed-UUID climbs with pre-split dates, 13 rows with
quality < 1, angle sets, manifest keys, baseline hash).

## Pass 2 — assessed parent.md sha256 0691f2dfc3d7da8a — NEEDS-REVISION (frontmatter only)

Body resolved priorities 1–3. Frontmatter (summary, key findings 5 and 6), the §2 cadence
cell and the Hangtime row were stale because the orchestrator's first frontmatter edit
was never written to disk (a script omitted its write step). Also flagged: "post-split"
used as a created_at cutoff without saying so; "Legacy Aurora sync was public" mis-cited;
baseline incompleteness (194 climbs) and unexplained unlisted rows missing from Gaps.

Disposition: all addressed in revision c97c0b9c9352f53e. Surfaced to the operator per the
second-pass rule; final confirmation pass requested.

## Pass 3 — assessed parent.md sha256 c97c0b9c9352f53e — APPROVED

All pass-2 items resolved; frontmatter consistent with body. Three non-blocking wording
nits (cadence cell, key finding 5 pre-cutoff count, key finding 3 qualifier) applied as
wording-only corrections in 7ced87db199a54cd; no claim or citation changed.

---
description: Quality report + metadata for the Kilter grade-prediction deep-research campaign
type: program-report
kind: research
slug: kilter-grade-prediction-campaign
research_method: /deep-research
provenance: agent-synthesis
verification_status: attested
updated: 2026-06-13
summary: |
  Campaign report for the Kilter grade-prediction deep-research run: 6 parallel
  Sonnet specialists + Opus synthesis + isolated Opus evaluator. Verdict GO (0.84).
  Records the evaluator's findings, citation-lint result, and deferred verification.
key_findings:
  - "Evaluator verdict: GO (overall 0.84) — fit to ground epic-grade-prediction design."
  - "Citation chain: 288 citations, 0 broken; 59 thin attestations + 91 advisory pattern flags are quality-checkpoint follow-ups."
  - "Top design follow-ups: resolve dataset size (10K vs 100K–1M), front-load a data-acquisition workstream, reconcile loose accuracy figures."
status: draft
---

# Campaign Report: Kilter Grade Prediction

## Method

- **Lead** (Opus, parent context) decomposed the seed into 6 orthogonal facets.
- **6 specialists** (Sonnet, parallel, background) — feature-engineering,
  classical-models, deep-representation-models, evaluation-methodology,
  prior-work-datasets, in-browser-inference. Each wrote source-direct
  attestations + a cited brief.
- **Synthesis** (Opus) wrote `parent.md`, carrying citations forward and flagging
  contradictions.
- **Evaluator** (Opus, isolated context — briefs + seed only) scored the output.

## Citation integrity (mechanical lint)

`/citation-lint` over the campaign directory: **288 resolved citations, 0 broken**
(exit 0). Caveats for the quality-checkpoint:
- **59 thin attestations** — some specialist attestations lack verbatim `>`
  passages (summary-only). Harden at the quality-checkpoint (`gate-citations`).
- **91 advisory pattern flags** — version-numbers / superlatives; mostly the
  reported accuracy figures (which are cited), not fabrications.
- **Redundant handles for shared sources** — the Frontiers survey, the
  Board-to-Board paper, and the GradeNet/BetaMove work were each attested under
  multiple handles by different specialists (not collisions; the chain still
  resolves). Dedupe at index cleanup if desired.

## Deferred verification

Per the session decision to run adversarial-reader passes at the **quality-checkpoint**
(not per-artifact), the campaign-level **adversarial source-support read** (Phase 9.5)
is deferred to `rp:quality-checkpoint` before release. The isolated Opus **evaluator**
(below) already served as the external verifier for the loop-exit gate. Re-run the
adversarial reader if any load-bearing claim is promoted to a hard design commitment
before then.

## Evaluator report (verbatim)

**Overall: 0.84 — Verdict: GO (with follow-ups).**

- **Coverage 0.85** — six facets cover the seed; missing: a data-pipeline/BoardLib
  facet, uncertainty-surfacing ("grade as a distribution"), class-imbalance
  mitigation, retraining cadence.
- **Coherence 0.88** — briefs integrate well; the parent recommendation is
  genuinely supported. Real crack: dataset size stated as ~10K in the parent vs
  ~100K–1M in prior-work (now reconciled in parent.md).
- **Contradictions 0.83** — flagged contradictions are real and side-by-side.
  Unflagged: the dataset-size one (now fixed); accuracy-band low end swings
  35/40/42%; the one GBT head-to-head in the corpus (Tai GCN) had GBT at worst AUC
  (different feature regime, but worth a builder caveat).
- **Groundedness 0.80** — reads source-grounded and honestly self-flags gaps
  (Board-to-Board PDF unparsed, GradeNet cited through the survey). Suspicious
  precision: a 91.75%/21-grade HGBC figure strains the "exact grading is hard"
  thesis; "sub-millisecond" inference is self-flagged as unmeasured.
- **Recommendations 0.82** — the GBT-first → GroupKFold-on-`climb_uuid` → Vilin97
  → GBT→ONNX → deep-as-next-step spine is sound and actionable.

### Top 3 follow-ups (→ inputs to epic-grade-prediction design)

1. **Resolve dataset size before locking the model-family decision.** Measure
   Vilin97's actual row count; if 100K+, treat a small role-channel CNN as a
   co-baseline, not a deferred step. (Reconciled in parent.md.)
2. **Front-load a data-acquisition/pipeline workstream** — BoardLib pull, frames→
   (x,y,role) decode validation, near-duplicate detection (for the grouped split),
   label hygiene (the kilterbench flash-log mitigation). Currently compressed into
   one hand-wavy step.
3. **Reconcile loose figures + the GBT-lost-on-AUC datapoint** — pin one accuracy
   band, caveat the 91.75% result, and surface that the corpus's one GBT
   head-to-head had GBT lose (different feature regime) so the builder validates
   the GBT ceiling empirically.

## Cost / scale

6 specialists (Sonnet) ~36–57K tokens each; synthesis + evaluator (Opus) ~70K each.
All briefs at `confidence: speculative, status: draft` — promotion is manual.

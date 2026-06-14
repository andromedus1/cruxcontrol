---
description: Evaluation and validation methodology for ML models predicting Kilter Board climb difficulty from hold placements, roles, and angle, targeting per-angle community-consensus grade.
type: brief
kind: research
slug: kilter-grade-evaluation
research_method: /deep-research
provenance: agent-synthesis
verification_status: attested
confidence: speculative
status: draft
updated: 2026-06-13
summary: Defines the target variable, metrics, and leakage-safe splitting that the grade-prediction approaches must be judged against. The target is per-angle community-consensus difficulty (difficulty_average) filtered by ascent count; primary metrics are MAE/RMSE in grade units plus accuracy-within-±1-grade (~84-85% is human parity); the dominant validation risk is leakage from the same climb appearing at multiple angles and from setter/duplicate climbs, requiring grouped splits and per-fold preprocessing.
key_findings:
  - Headline regression metrics for board-climb grade prediction are MAE and RMSE expressed in grade units; a strong published reference on Moonboard is ~0.87 MAE / ~1.12 RMSE [board-to-board]{1}.
  - Accuracy-within-±1-grade is the practical bar where models reach human-level parity (~84-85%), while exact-grade accuracy across 10-12 classes sits ~40-47% [frontiers-grading-bias]{2}.
  - The target should be per-angle community-consensus difficulty (difficulty_average / display_difficulty), filtering out climbs with too few ascents; benchmark_difficulty (setter/curated) is a cleaner-but-narrower alternative ground truth [frontiers-grading-bias]{2}, [kilter-schema]{4}.
  - The same climb (same uuid/layout) appears as separate rows per angle, each with its own difficulty and ascent count — these are correlated samples that must be kept in the same train/test split to avoid leakage [kilter-schema]{4}, [connectome-leakage]{3}.
  - Preprocessing/feature-selection fit on the full dataset before splitting inflates metrics, worst when the signal is weak (low-ascent climbs); fit all preprocessing inside the training fold only [connectome-leakage]{3}.
  - Models must be evaluated for out-of-distribution generalization (e.g., across hold-set/layout configurations and angles), not just in-distribution; current methods remain below human level on generalization [board-to-board]{1}.
  - The grade distribution is class-imbalanced toward easier climbs, which distorts plain accuracy and demands stratified reporting and imbalance-aware metrics [frontiers-grading-bias]{2}.
---

# Evaluation & Validation Methodology: Kilter Board Grade Prediction

This brief defines how candidate grade-prediction approaches (feature-engineering, classical models, deep-representation models — covered by sibling facets) are to be judged. It owns the target-variable definition, the metric suite, and the splitting protocol. It does not recommend a model.

## 1. Target variable

Kilter's SQLite database stores difficulty in a `climb_stats` table keyed by `(climb_uuid, angle)`, joined to a `climbs` table holding the static hold layout (`frames`). The same physical climb (same uuid, same holds) appears as a separate statistics row at each angle it has been graded at, each row carrying its own `display_difficulty` (community-consensus aggregate, here treated as `difficulty_average`), `benchmark_difficulty` (setter/curated benchmark grade), `ascensionist_count`, and `quality_average` [kilter-schema]{4}.

Recommended target: **per-angle community-consensus difficulty (`difficulty_average`/`display_difficulty`)**. This matches the campaign goal and is what the app surfaces to users. The literature on the analogous Moonboard problem supports limiting the target to community-determined grades and removing inaccurately/under-graded routes [frontiers-grading-bias]{2}.

`benchmark_difficulty` is an alternative ground truth: in Moonboard work, professionally-set "benchmark" routes are "used as ground truth ... because they are uploaded by route setting professionals" [frontiers-grading-bias]{2}. It is cleaner (less crowd noise) but far narrower in coverage and biased toward curated climbs. Treat it as a secondary evaluation slice, not the primary training target, unless coverage is sufficient.

### Filtering by ascent count
Low-`ascensionist_count` climbs have noisy consensus grades. A community-standard filter is `ascensionist_count >= 5` combined with a quality threshold (~`quality_average > 2.6`) [kilter-schema]{4}. This threshold is a starting point, not validated optimum — see Disconfirming analysis. Options, in increasing sophistication:
1. Hard filter (drop below threshold) — simplest, loses data.
2. Sample weighting by ascent count (or log ascent count) so well-established climbs dominate the loss.
3. Keep a held-out high-ascent "gold" test slice and report on it separately, since low-signal/small-sample regimes are where evaluation is least trustworthy [connectome-leakage]{3}.

## 2. Metrics

Grades are ordinal (V-scale / font), so use ordinal-aware reporting:

- **MAE in grade units** (primary). Interpretable as "average grades off." Reference: ~0.87 MAE on Moonboard [board-to-board]{1}.
- **RMSE in grade units** (secondary) — penalizes large misses; reference ~1.12 [board-to-board]{1}.
- **Accuracy within ±1 grade** — the practical/human-parity bar, ~84-85% in route-centric Moonboard work; exact-grade accuracy across 10-12 classes is only ~40-47% [frontiers-grading-bias]{2}. Report both exact and ±1.
- **Per-grade / stratified breakdown** — because the distribution skews easy [frontiers-grading-bias]{2}, a model can win on aggregate accuracy by over-predicting common grades. Report MAE/accuracy per grade band and inspect the confusion matrix / predicted-distribution fidelity.
- **Calibration**: for regression, plot predicted vs consensus grade and check residual bias by grade band and by angle (does the model systematically over/under-grade steep angles?). Reproducing the underlying grade distribution is itself a quality signal in this domain [frontiers-grading-bias]{2}.

### What "good" looks like
A useful Kilter model should land near or below ~1.0 MAE in grade units and reach ~80-85% within-±1-grade on a leakage-free, high-ascent test slice, with no large per-angle or per-grade-band residual bias. Matching ~0.87 MAE [board-to-board]{1} and ~84% within-grade [frontiers-grading-bias]{2} would be competitive with published board work and approach human consistency. Note these references are Moonboard, not Kilter — see Contradictions.

## 3. Splitting to avoid leakage

This is the facet's most consequential output. Leakage produces optimistic-but-invalid metrics; the worst offenders for this dataset:

1. **Same-climb-across-angles leakage.** Because `climb_stats` rows share a `climb_uuid` across angles [kilter-schema]{4}, randomly splitting rows puts angle-40 and angle-45 versions of the same layout in both train and test. The model then "predicts" a grade it has effectively seen. **Mitigation: GroupKFold / grouped train-test split keyed on `climb_uuid`** so all angle-variants of a climb stay in one split — directly analogous to keeping "all members of a single family ... in the same test split" [connectome-leakage]{3}.
2. **Duplicate / near-duplicate climbs.** Setters re-post mirrored or trivially-shifted layouts under new uuids. These should be detected (e.g., hold-set hashing / near-duplicate frames) and grouped, or they leak the same signal. Subject-duplicate leakage inflated performance by Δr up to 0.29 in the connectome study [connectome-leakage]{3}.
3. **Setter leakage** (optional, stricter). If setter identity is recoverable, a setter's stylistic grading bias can leak; grouping by setter tests generalization to unseen setters but costs data. Treat as a stricter secondary evaluation, not the default.
4. **Preprocessing/feature leakage.** Any normalization, target encoding, or feature selection must be fit inside the training fold only. Fitting on the full dataset inflated weak-signal performance dramatically (r 0.01 → 0.48) [connectome-leakage]{3} — and low-ascent Kilter climbs are exactly the weak-signal regime.
5. **Popularity bias.** Popular climbs have tighter consensus and dominate counts. A uniform random split lets the model overfit popular climbs while the metric looks fine; report on a balanced/high-ascent slice and consider ascent-stratified splits.

### Recommended protocol
- Group key = `climb_uuid` (after near-duplicate merging). Use grouped train/validation/test (e.g., GroupKFold for CV, or a grouped holdout).
- Optionally stratify the grouped split by grade band to keep all bands represented despite imbalance.
- Fit all preprocessing per-fold.
- Report MAE, RMSE, exact accuracy, and ±1 accuracy, each overall and per-grade-band and per-angle, on the grouped test set; additionally on a high-ascent "gold" slice.

## 4. Per-angle modeling vs angle-as-feature

Two evaluable designs (the modeling choice itself belongs to sibling facets; here we define how to compare them fairly):
- **Angle-as-feature** (one model, angle as input) — more data per model, must be tested for per-angle residual bias (calibration by angle).
- **Per-angle models** (one model per angle) — risks data starvation at rare angles and cannot borrow strength across angles.

Whichever is chosen, the **split must remain grouped by `climb_uuid` across angles** so the comparison is leakage-free; an angle-as-feature model evaluated on a row-random split would look artificially strong precisely because of same-climb leakage (§3.1).

## Disconfirming analysis

- **Is `difficulty_average` itself trustworthy as ground truth?** Community grading is the very "bias" several papers set out to correct [frontiers-grading-bias]{2}; treating consensus as truth means the model is judged against a noisy, possibly biased label, not objective difficulty. The honest framing: we are predicting *community-consensus grade*, not *true difficulty*. A model that perfectly predicts consensus inherits consensus bias. Reporting against `benchmark_difficulty` on benchmark climbs is a partial disconfirming check.
- **Is the `ascensionist_count >= 5` / quality > 2.6 filter justified?** It comes from a dataset-builder's choices [kilter-schema]{4}, not a validated noise analysis. The right move is empirical: measure grade-variance vs ascent count and set the threshold where consensus stabilizes, rather than inheriting 5.
- **Do Moonboard reference numbers transfer to Kilter?** The ~0.87 MAE / ~84% within-grade references are Moonboard [board-to-board]{1}, [frontiers-grading-bias]{2}. Kilter has more holds, continuous angle adjustment, and hold *roles* (start/hand/foot/finish), so difficulty structure differs; these numbers are directional targets, not Kilter-validated thresholds.

## Contradictions

- **Exact-grade accuracy figures vary widely** across the survey (e.g., GradeNet 46.7% over 10 grades vs 2DCNN 42.0% over 12 grades) [frontiers-grading-bias]{2} — not directly comparable because the number of grade classes differs. This is why MAE/RMSE and ±1-accuracy (class-count-robust) are preferred over raw exact accuracy. Presented side-by-side rather than merged.
- **Benchmark vs consensus as ground truth**: the survey endorses both community-consensus filtering AND professional benchmark routes as ground truth [frontiers-grading-bias]{2}; these are different targets that will yield different "best" models. The campaign target (per-angle consensus) picks one; benchmark stays a secondary slice.

## Suggested cross-references to sibling subdomains

- **feature-engineering**: hold-role encoding and angle representation feed directly into the per-angle-vs-angle-as-feature evaluation (§4) and the near-duplicate detection needed for grouped splits (§3.2).
- **classical-models / deep-representation-models**: both must be evaluated under the same grouped-split + metric suite defined here; report on the identical leakage-free test slice for fair comparison.
- **prior-work-datasets**: the Moonboard MAE/accuracy reference points [board-to-board]{1} and benchmark-route convention [frontiers-grading-bias]{2} originate there; reconcile dataset filtering thresholds with what that facet documents.
- **in-browser-inference**: calibration and per-angle residual reporting (§2) should inform what confidence/uncertainty the in-browser model surfaces to users.

## Sources (provisional handles)

- [board-to-board]{1} — Board-to-Board: Evaluating Moonboard Grade Prediction Generalization, arXiv 2311.12419.
- [frontiers-grading-bias]{2} — Addressing grading bias in rock climbing: machine and deep learning approaches, Frontiers in Sports and Active Living, 2024.
- [connectome-leakage]{3} — Data leakage inflates prediction performance in connectome-based machine learning models, PMC10901797.
- [kilter-schema]{4} — Kilter Board SQLite schema via kilterboard_climbs / BoardLib / stfamod Kilter-Board-Dataset card.

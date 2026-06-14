---
description: The synthesis of the Kilter grade-prediction research campaign — the recommended ML approach for predicting per-angle community-consensus difficulty from hold placements/roles/angle, training offline in Python and running inference in-browser. Read before designing the epic-grade-prediction work.
type: brief
kind: research
slug: kilter-grade-prediction
research_method: /deep-research
provenance: agent-synthesis
verification_status: attested
confidence: speculative
status: draft
updated: 2026-06-13
nav_priority: high
blocks_phase: epic-grade-prediction
summary: |
  No published Kilter-specific grade predictor exists; the field is MoonBoard, where route-only models cluster at ~42-47% exact-grade and ~84% within ±1 grade (best regression ~0.87 MAE). For Kilter, the low-risk starting point is engineered geometric/move-summary features feeding a gradient-boosted-tree regressor on per-angle difficulty_average, evaluated with GroupKFold grouped on climb_uuid on the Vilin97/KilterBoard dataset (which ships UUID-disjoint splits), then exported GBT→ONNX and run single-threaded WASM in-browser via ONNX Runtime Web. BetaMove-style move decomposition and deep models (a small role-channel CNN being the most export-friendly) are a documented next step, not the start — and the literature genuinely splits on whether move-decomposition is the key enabler or a bias source.
key_findings:
  - No source-direct fully-benchmarked Kilter (not MoonBoard) grade predictor was found; the ~42-47% exact / ~84% within-±1 / ~0.87 MAE band is a MoonBoard prior to validate on Kilter, not a Kilter target. [arxiv-board-to-board-2311-12419]{3}, [frontiers-grading-bias-2024]{1}
  - Gradient-boosted trees are the correct first baseline on engineered tabular features — state-of-the-art on medium tabular data, CPU-trainable, interpretable, ONNX-exportable. [grinsztajn-tree-vs-dl-tabular]{1} Caveat: Vilin97/KilterBoard is ~100K–1M rows [hf-vilin97-kilterboard]{1}, larger than the regime where trees dominate most — so a small CNN is a co-baseline to benchmark, not a deferred step.
  - The target is per-angle community-consensus difficulty (difficulty_average / display_difficulty), filtered by ascent count; the same climb_uuid recurs as one row per angle, so splits must group on climb_uuid or the model "predicts" grades it has effectively seen. [kilter-schema]{4}, [connectome-leakage]{3}
  - Vilin97/KilterBoard is the natural prediction substrate — SQLite keyed by (uuid, angle), with prebuilt 80/10/10 UUID-disjoint splits and the placement/role reference tables; load it directly (the HF auto-loader cannot read SQLite). [hf-vilin97-kilterboard]{6}
  - Grades are finite ordered categories — treat as numeric-index regression (order-aware) rather than plain multiclass; report MAE/RMSE plus exact and within-±1 accuracy, stratified per grade band and per angle. [ordinal-regression-wikipedia]{2}, [frontiers-grading-bias]{2}
  - The load-bearing geometric signal across prior work is inter-hold reach/span, especially the largest hand-to-hand move; error concentrates on hard climbs where one crux move dominates an otherwise-easy sequence. [duh-chang-moonboardrnn]{1}, [moonboardrnn-betamove-code]{2}
  - For trees the dominant deployment risk is not the runtime but train/serve skew: float32-vs-float64 at tree decision boundaries (unbounded, not derivative-bounded) and JS-vs-Python feature-extraction divergence; mitigate by baking preprocessing into the ONNX graph and validating ONNX outputs against Python on a held-out set. [sklearn-onnx-float-double]{5}, [sklearn-onnx-lightgbm-pipeline]{4}
  - SHAP / TreeExplainer (not default gain importance, which "is biased to attribute more importance to lower splits") gives consistent per-climb attributions, enabling sandbag/soft-grade detection on climbs whose predicted grade diverges from consensus. [lundberg-shap-xgboost]{4}
decisions:
  - Start with engineered geometric/move-summary tabular features (hold/role counts, density, height extent, reach/span summaries especially the largest hand move, per-placement learned difficulty, board angle) feeding a gradient-boosted-tree regressor; angle is a first-class feature, not a constant. [duh-chang-moonboardrnn]{1}, [grinsztajn-tree-vs-dl-tabular]{1}
  - Frame the problem as numeric-index regression on per-angle difficulty_average (continuous community-consensus grade), not plain multiclass. [ordinal-regression-wikipedia]{2}
  - Train and evaluate on Vilin97/KilterBoard using GroupKFold grouped on climb_uuid (after near-duplicate merging), fitting all preprocessing inside the training fold; report MAE/RMSE + exact + within-±1 accuracy overall, per-grade-band, and per-angle on a high-ascent gold slice. [hf-vilin97-kilterboard]{6}, [connectome-leakage]{3}, [frontiers-grading-bias]{2}
  - Filter labels by ascent count (start ~ascensionist_count>=5, quality>2.6) and layer kilterbench's Quick-Log truncation + drop-<500-repeats hygiene; treat the threshold as empirically tunable, not fixed. [kilter-schema]{4}, [github-kilterbench]{5}
  - Export GBT→ONNX via onnxmltools/sklearn-onnx (TreeEnsembleRegressor, zipmap=False, ai.onnx.ml opset 2) and serve with ONNX Runtime Web on single-threaded WASM; skip COOP/COEP for the tree model; validate ONNX-vs-Python predictions on a held-out set as a deploy gate. [onnx-traditional-ml]{2}, [sklearn-onnx-lightgbm-pipeline]{4}, [sklearn-onnx-float-double]{5}
  - Treat BetaMove-style move decomposition and deep models (a small role-channel CNN as the most export-friendly; LSTM/attention-pool and an inductive move-graph GNN as further options) as a documented next step that must beat the GBT baseline before adoption. [duh-chang-rnn]{1}, [tai-gcn]{2}, [poirier-transformer]{3}
related:
  - {slug: .research/briefs/kilter-grade-prediction/feature-engineering.md, relationship: part-of}
  - {slug: .research/briefs/kilter-grade-prediction/classical-models.md, relationship: part-of}
  - {slug: .research/briefs/kilter-grade-prediction/deep-representation-models.md, relationship: part-of}
  - {slug: .research/briefs/kilter-grade-prediction/evaluation-methodology.md, relationship: part-of}
  - {slug: .research/briefs/kilter-grade-prediction/prior-work-datasets.md, relationship: part-of}
  - {slug: .research/briefs/kilter-grade-prediction/in-browser-inference.md, relationship: part-of}
---

# Kilter Grade Prediction — Campaign Synthesis

## Context & decomposition

The seed: ML approaches for predicting Kilter Board climb difficulty from hold
placements, hold roles, and board angle. The target is the community-consensus
difficulty (`difficulty_average`) defined *per angle*. Training happens offline
in Python; inference must run client-side in the browser (ONNX.js / TF.js). The
campaign decomposed this into six orthogonal facets, each researched as a
sibling brief:

1. **Feature engineering** — decoding the `frames` string into geometry and
   deriving predictive features over the hold point-set.
2. **Classical models** — gradient-boosted trees and other tabular regressors as
   the baseline.
3. **Deep representation models** — CNN / GNN / sequence families and their
   inductive biases, data hunger, and export-friendliness.
4. **Evaluation methodology** — target definition, metrics, and leakage-safe
   splitting.
5. **Prior work & datasets** — what has been built (MoonBoard, mostly) and the
   reusable Kilter datasets.
6. **In-browser inference** — the export path, conversion, runtime backend, and
   train/serve skew.

This parent carries forward the load-bearing claims from each facet (citations
verbatim) and commits a sequenced recommendation for the `epic-grade-prediction`
phase. Note: each `[handle]{N}` below is scoped to the sibling brief it came
from — the same numeral can refer to different sources across facets (e.g.
`{1}` is `grinsztajn-tree-vs-dl-tabular` in the classical-models facet but
`duh-chang-rnn` in the deep-models facet); the handle name, not the numeral, is
authoritative.

## Key findings (cross-cutting)

### Prior art is MoonBoard; Kilter prediction is a genuine gap
There is essentially no published Kilter *grade-prediction* model — existing
Kilter ML is route *generation* and grade-inflation analysis, and "No
source-direct confirmation of a fully benchmarked Kilter (not MoonBoard) grade
predictor was found" [arxiv-board-to-board-2311-12419]{3}. The accuracy band we
inherit — ~42-47% exact-grade, ~84% within ±1 grade, regression SOTA ~0.87 MAE /
1.12 RMSE — is MoonBoard prior art [frontiers-grading-bias-2024]{1},
[arxiv-board-to-board-2311-12419]{3}, and cross-board generalization "is below
human level performance currently" [arxiv-board-to-board-2311-12419]{3}. For
Kilter this is a hypothesis to validate, not a target to assume.

### Representation matters more than model family
The single most-repeated finding across the corpus: how the climb is represented
dominates which model wins. On MoonBoard, a naive RNN on raw hold lists scored
~34.7% (tied with a CNN), while the *same* recurrent architecture fed a
human-ordered BetaMove move sequence jumped to 46.7% exact / 84.7% within ±1 —
"the improvement primarily comes from the injection of human insight through the
BetaMove-preprocessed move sequence" [duh-chang-rnn]{1}. The Frontiers review
generalizes this to "Sequencing holds/movements is critical"
[frontiers-grading-bias-2024]{1}.

### The load-bearing geometric signal is reach/span
Prior work places the most weight on inter-hold distance, modeling each move's
feasibility from Euclidean inter-hold distance plus hand-specific per-hold
difficulty via a sum-of-Gaussians reach model [moonboardrnn-betamove-code]{2}.
The largest hand-to-hand move (the crux reach) deserves heavy weight because
prediction error concentrates on hard climbs where one extreme move dominates
[duh-chang-moonboardrnn]{1}. The `frames` string decodes deterministically to
that geometry through the board's SQLite tables (`pXXXXrXX` →
`placements.hole_id` → `holes.(x,y)`, with `role_id` giving hand/foot and
start/finish), and this decode is the prerequisite for every geometric feature
[kilter-frames-db-schema]{4}.

### GBT is the correct first baseline on engineered features
Tree-based models "remain state-of-the-art on medium-sized data (~10K samples)
even without accounting for their superior speed," beating tuned deep nets, and
deep learning's superiority on tabular data "is not clear"
[grinsztajn-tree-vs-dl-tabular]{1}. They win because they are robust to
uninformative features, axis-aligned (orientation-preserving), and learn
irregular/non-smooth functions natively [grinsztajn-tree-vs-dl-tabular]{1} —
the last especially relevant since a single crux hold can jump the grade. They
also train CPU-only and export cleanly to ONNX, making them the baseline any
deep model must beat.

**Dataset-size caveat (reconciliation).** The grinsztajn "trees win on
medium-sized data (~10K samples)" result is the regime where the tree advantage
is strongest. The Vilin97/KilterBoard dataset is materially larger — on the order
of 100K–1M rows [hf-vilin97-kilterboard]{1} — where the tree-vs-deep gap narrows.
This does NOT overturn the GBT-first recommendation (CPU-trainable, interpretable,
trivially ONNX-exportable — the right *first* baseline), but it does mean a small
role-channel CNN should be treated as a near-term **co-baseline** to benchmark on
the identical split, not a deferred next step. Measure the actual row count before
locking the model-family decision.

### Grades are ordinal; regression is the faithful frame
Climbing grades are "finite ordered categories" — the canonical
ordinal-regression setting [ordinal-regression-wikipedia]{2}. Plain multiclass
"will assume that the error of misclassifying an A as a D is just as bad as
misclassifying A as a B," discarding the ordering [ordinal-regression-wikipedia]{2}.
Because `difficulty_average` is already a community-averaged real number,
numeric-index regression is the most faithful framing, and class-count-robust
metrics (MAE/RMSE, ±1 accuracy) are preferred over raw exact accuracy, which
varies with the number of grade classes [frontiers-grading-bias]{2}.

### Leakage is the dominant validation risk
The same physical climb appears as a separate `climb_stats` row per angle, each
with its own difficulty and ascent count [kilter-schema]{4}; a random row split
puts angle-40 and angle-45 versions of one layout in both train and test, so the
model "predicts" a grade it has effectively seen. The mitigation is
GroupKFold / grouped split keyed on `climb_uuid`, directly analogous to keeping
"all members of a single family ... in the same test split" [connectome-leakage]{3}.
Preprocessing fit on the full dataset before splitting inflated weak-signal
performance dramatically (r 0.01 → 0.48) [connectome-leakage]{3} — and low-ascent
climbs are exactly that weak-signal regime — so all preprocessing must be fit
inside the training fold. Vilin97/KilterBoard already ships 80/10/10
UUID-disjoint splits [hf-vilin97-kilterboard]{6}.

### Crowd-sourced labels are biased and need hygiene
The Kilter "Quick Log Ascent" flash mechanism auto-logs at the assigned grade,
spiking that histogram bin; kilterbench mitigates by truncating the assigned-grade
bin to ≤50% of repeats and dropping climbs with <500 repeats — directly reusable
label-cleaning heuristics — and its per-climb skewed-normal fits imply a grade is
better treated as a distribution than a point label [github-kilterbench]{5}.

### Browser deployment: the runtime is easy, skew is hard
TensorFlow.js converts only neural-net models and "cannot" represent tree
ensembles, so a GBT must route through ONNX [tfjs-converter]{1}; ONNX Runtime
supports the `ai.onnx.ml` domain (`TreeEnsembleRegressor`) and runs tree models
from sklearn/LightGBM/XGBoost once converted [onnx-traditional-ml]{2}. The real
risk is train/serve skew: trees are discontinuous, so "even a small dx may
introduce a huge discrepancy" at a decision boundary when float64 is cast to
float32 [sklearn-onnx-float-double]{5}; and reimplementing the Python
feature-extraction in JS without bit-for-bit parity is undetectable skew. Both
are mitigated by baking preprocessing into the ONNX graph (sklearn-onnx converts
whole pipelines) and validating ONNX-vs-Python predictions on a held-out set
before deploy [sklearn-onnx-lightgbm-pipeline]{4}, [sklearn-onnx-float-double]{5}.
For a small tabular GBT, single-threaded WASM with SIMD is sub-millisecond-class
work, so the COOP/COEP cross-origin-isolation complexity is unnecessary
[coop-coep-sab]{8}, [onnx-web-env-flags]{7}.

### Interpretability is a first-class deliverable
Default gain importance "is biased to attribute more importance to lower splits"
[lundberg-shap-xgboost]{4}; SHAP / TreeExplainer is exact for tree ensembles,
consistent, and locally accurate, exposing per-climb attributions so a
large predicted-minus-consensus residual with an anomalous SHAP profile becomes
an explainable sandbag/soft-grade candidate [lundberg-shap-xgboost]{4}.

## Recommended approach for epic-grade-prediction

A concrete, sequenced recommendation. Each step ties to the facet/finding that
supports it.

**Step 1 — Acquire and clean the dataset.** Use Vilin97/KilterBoard as the
prediction substrate: SQLite keyed by `(uuid, angle)` with prebuilt 80/10/10
UUID-disjoint splits and the placement/role reference tables; load the SQLite
directly since the HF auto-loader cannot read it [hf-vilin97-kilterboard]{6}.
Layer kilterbench's label hygiene (truncate the Quick-Log assigned-grade bin,
drop climbs below the repeat threshold) on top [github-kilterbench]{5}. Filter by
ascent count (start ~`ascensionist_count>=5`, `quality>2.6`), treating the
threshold as empirically tunable rather than inherited [kilter-schema]{4},
[github-kilterbench]{5}.

**Step 2 — Engineer geometric/move-summary tabular features.** Decode `frames`
→ `(x,y,role)` via the SQLite tables [kilter-frames-db-schema]{4}, then derive:
hold/role counts and density, height/extent statistics, and the reach/span
summaries that prior work found load-bearing — especially the largest
hand-to-hand move, weighted heavily because error concentrates on crux-dominated
hard climbs [duh-chang-moonboardrnn]{1}, [moonboardrnn-betamove-code]{2}.
Recover a data-driven per-placement difficulty from how each placement co-occurs
with consensus grades (the Kilter-available analogue of MoonBoard's incut-depth
feature) [frontiers-grading-bias-survey]{3}. **Board angle is a first-class
feature**, not a constant, since the target is defined per angle
[kilter-frames-db-schema]{4} / [frontiers-grading-bias]{2}.

**Step 3 — Fit a gradient-boosted-tree regressor.** Numeric-index regression on
per-angle `difficulty_average` with a GBT (XGBoost/LightGBM/CatBoost) — the
state-of-the-art, CPU-only, ONNX-exportable baseline at this data scale
[grinsztajn-tree-vs-dl-tabular]{1}, framed as regression because the ordinal
target makes multiclass mis-penalize distant errors [ordinal-regression-wikipedia]{2}.
Use standard overfitting controls (early stopping, shallow `max_depth`, low
learning rate, L1/L2, subsampling) given the high label noise.

**Step 4 — Evaluate leakage-free.** GroupKFold grouped on `climb_uuid` (after
near-duplicate merging), all preprocessing fit per-fold [connectome-leakage]{3};
report MAE/RMSE + exact + within-±1 accuracy overall, per-grade-band, and
per-angle, on a high-ascent "gold" slice; check residual bias by angle and grade
band [frontiers-grading-bias]{2}. Vilin97's shipped UUID-disjoint splits give
this for free [hf-vilin97-kilterboard]{6}.

**Step 5 — Export and deploy.** GBT → ONNX via onnxmltools/sklearn-onnx
(`TreeEnsembleRegressor`, `zipmap=False`, `target_opset ai.onnx.ml: 2`), with
preprocessing baked into the ONNX graph to shrink the JS surface
[sklearn-onnx-lightgbm-pipeline]{4}. Run ONNX Runtime Web on single-threaded
WASM (`numThreads=1`), skipping COOP/COEP for the tree model [onnx-web-env-flags]{7},
[coop-coep-sab]{8}. Mitigate float precision (keep preprocessing in float64; use
the `TreeEnsembleRegressor` `split` option for double-precision cross-tree
summation) and **gate the deploy on validating ONNX-vs-Python predictions on a
held-out set** [sklearn-onnx-float-double]{5}, [sklearn-onnx-lightgbm-reg-split]{6}.

**Step 6 — Add interpretability.** SHAP/TreeExplainer for per-climb attributions
and sandbag detection (predicted-minus-consensus residual + anomalous SHAP
profile) [lundberg-shap-xgboost]{4}.

**Documented next step (NOT the start).** Only if the GBT ceiling proves
inadequate: invest in BetaMove-style move decomposition (the representation that
drove MoonBoard's best sequence results) [duh-chang-rnn]{1}, and/or deep models.
Among deep families, a small role-channel CNN is the most export-friendly
(conv/relu/pool/dense fully supported in ONNX Runtime Web and TF.js, static
graph, low-hundreds-of-KB) and reached ~42% exact / ~84% within ±1 on MoonBoard
[duh-chang-rnn]{1}; an LSTM/attention-pool head and an *inductive* per-route
move-graph GNN are further options, while a full Transformer is premature on this
data scale [poirier-transformer]{3}. A deep model must beat the GBT baseline on
the identical leakage-free split before adoption.

## Contradictions

### (a) Move-decomposition: predictive enabler vs bias source
Two well-supported, genuinely opposed design stances on whether to decompose a
climb into an ordered move sequence before modeling:

- **Move-decomposition is the key enabler (Duh & Chang / GradeNet position).**
  The BetaMove move-ordering preprocessor drove MoonBoard's best results: the
  same recurrent network jumped from ~34.7% (raw holds) to 46.7% exact / 84.7%
  within ±1 once fed the human-ordered move sequence, and "the improvement
  primarily comes from the injection of human insight through the
  BetaMove-preprocessed move sequence" [duh-chang-rnn]{1}; GradeNet
  "outperformed other classifiers including CNN, MLP, and Graphical neural
  networks" [github-moonboardrnn-gradenet]{2}, and the Frontiers survey
  generalizes that sequencing is "critical" [frontiers-grading-bias-2024]{1}.

- **Move-decomposition is a bias source to avoid (Board-to-Board position).**
  The Board-to-Board work deliberately uses "a feature-set that does not require
  decomposing routes into individual moves" precisely to avoid move-decomposition
  bias, and still reaches regression SOTA (0.87 MAE / 1.12 RMSE)
  [arxiv-board-to-board-2311-12419]{3}.

These are not reconciled here. The recommended approach sides with the
non-decomposed feature set *for the starting baseline only* (lower risk, no
ordering heuristic to build, and consistent with the regression-SOTA result),
while explicitly preserving move-decomposition as the documented next step. The
Board-to-Board full text could not be parsed (abstract-only across multiple
specialists), so its exact feature set is unattested — a caveat on the strength
of the "avoid decomposition" position.

### (b) Board geometry / hold count
The Frontiers review extraction cites "198 standardized holds"
[frontiers-grading-bias]{4}, whereas both primary Stanford papers state MoonBoard
2016 has "exactly 140 holds" / an 18×11 grid [tai-gcn]{2}, [duh-chang-rnn]{1}.
Likely a different MoonBoard hold-set version or a summarizer artifact; this is a
MoonBoard-geometry discrepancy and does not bind the Kilter design (Kilter
geometry comes from the Vilin97 reference tables directly), but it is recorded
rather than smoothed.

### (c) "Sequence is the key" vs CNN parity
The Frontiers review's headline that "sequence is the key" sits in mild tension
with its own report that a spatial 2D-CNN reached 84% within ±1
[frontiers-grading-bias]{4}, nearly matching the sequence model on the tolerance
metric. Both can hold (sequence wins on exact accuracy and hard grades; CNN is
close on ±1), but the framing overstates the sequence advantage — relevant to
the next-step model choice, where the CNN's export-friendliness and lack of a
preprocessing pipeline are real advantages.

### (d) Classification vs regression framing
GradeNet/2DCNN report classification accuracy (46.7% / 42.0%)
[github-moonboardrnn-gradenet]{2}, while Board-to-Board reports regression error
(0.87 MAE) [arxiv-board-to-board-2311-12419]{3}; these are not directly
comparable. The recommendation picks regression (faithful to the continuous
`difficulty_average` target) but reports both exact and ±1 accuracy so results
stay comparable to the classification literature.

## Coverage & gaps

- **No published Kilter-specific grade-prediction model exists.** Prior art is
  MoonBoard; the inherited accuracy band (~42-47% exact, ~84% within ±1, ~0.87
  MAE) is borrowed from MoonBoard and **unvalidated on Kilter**
  [arxiv-board-to-board-2311-12419]{3}, [frontiers-grading-bias-2024]{1}. Kilter
  has more holds, continuous angle adjustment, and explicit hold roles, so the
  difficulty structure differs; the band is a directional hypothesis.
- **The Board-to-Board PDF body could not be parsed** by multiple specialists
  (returned as binary; abstract-only), so its non-decomposed feature set — the
  load-bearing evidence for the "avoid move-decomposition" position — is
  unattested beyond the abstract.
- **The Stanford CS230 GradeNet PDF** likewise returned as binary; its numbers
  are cited *through* the Frontiers review rather than source-direct.
- **Acquisition-pending measurements:** exact row counts for the HF datasets;
  measured ONNX model byte-size and per-inference latency on single-threaded WASM
  (needed to confirm the "skip COOP/COEP" recommendation); confirmation that the
  stock onnxruntime-web WASM build registers `ai.onnx.ml` (TreeEnsemble) kernels
  by default; whether XGBoost's converter exposes a LightGBM-equivalent `split`
  precision control.
- **The data-driven per-placement-difficulty feature** is a specialist inference
  (the MoonBoard incut-depth result relies on hold metadata Kilter does not
  expose), flagged speculative, not a sourced Kilter result.
- **`difficulty_average` is consensus, not objective truth** — a model that
  perfectly predicts it inherits consensus bias; reporting against
  `benchmark_difficulty` on benchmark climbs is the partial disconfirming check.

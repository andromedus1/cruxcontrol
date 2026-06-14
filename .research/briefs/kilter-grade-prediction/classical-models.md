---
description: Classical / gradient-boosted-tree models for predicting Kilter Board climb difficulty from engineered tabular features, including regression-vs-ordinal framing, expected accuracy, overfitting controls, and interpretability for sandbag detection.
type: brief
kind: research
slug: kilter-grade-classical-models
research_method: /deep-research
provenance: agent-synthesis
verification_status: attested
confidence: speculative
status: draft
updated: 2026-06-13
summary: >
  Gradient-boosted decision trees (XGBoost, LightGBM, CatBoost) are the natural
  strong baseline for grade prediction from engineered tabular features: on
  medium-sized (~10K-sample) tabular data they remain state-of-the-art versus
  deep nets, train fast on CPU, and export trivially to in-browser inference.
  Climbing grades are finite ordered categories, so the target is best framed as
  regression on a numeric grade index (cheap, order-aware) with optional
  ordinal-aware methods; plain multiclass classification wastes the ordering.
  Reported exact single-grade accuracy across the literature clusters at
  roughly 35-47% (near human ~45%), rising to ~84% with a +/-1-grade tolerance,
  with the best regression-style MoonBoard results near 0.86 MAE. SHAP /
  TreeExplainer gives consistent, per-prediction feature attributions that
  enable sandbag/soft-grade detection by flagging climbs whose predicted grade
  diverges from consensus with anomalous attributions.
key_findings:
  - GBT ensembles are the correct first baseline before deep models on engineered tabular features at this dataset scale; tree-based models "remain state-of-the-art on medium-sized data (~10K samples)" and beat tuned deep nets, while being faster and CPU-only. [grinsztajn-tree-vs-dl-tabular]{1}
  - Climbing grades are finite ordered categories — the textbook ordinal-regression setting; treat as numeric-index regression (order-aware, simple) rather than plain multiclass, which mis-penalizes distant-grade errors equally. [ordinal-regression-wikipedia]{2}
  - Expected performance bar from prior work: ~35-47% exact single-grade accuracy (~45% human), ~84% within +/-1 grade, best regression-style ~0.86 MAE; a Histogram Gradient Boosting Classifier reached 91.75% over 21 Font grades and a Random Forest reached 0.378 RMSE on indoor routes. [frontiers-climbing-grading-bias]{3}
  - GBT win because they are robust to uninformative features, axis-aligned (orientation-preserving), and learn irregular/non-smooth functions natively — the three gaps deep nets struggle to close on tabular data. [grinsztajn-tree-vs-dl-tabular]{1}
  - For interpretability and sandbag detection, prefer SHAP/TreeExplainer over default gain importance, which "is biased to attribute more importance to lower splits"; SHAP is consistent, locally accurate, and exposes per-climb outlier attributions. [lundberg-shap-xgboost]{4}
---

# Classical models on engineered features for Kilter grade prediction

This brief covers gradient-boosted decision trees (GBT) and other classical
regressors as the baseline approach for predicting community-consensus Kilter
difficulty from an engineered tabular feature vector (treated here as a given,
produced by the feature-engineering sibling). It frames the prediction problem,
states the accuracy bar set by prior work, and gives concrete training,
overfitting, and interpretability guidance for an offline-trained model that
ships to in-browser inference.

## Why GBT is the natural strong baseline

The target is a row of engineered tabular features per climb (hold counts, role
counts/positions, spatial statistics, board angle) mapping to a scalar
consensus grade. On exactly this kind of data and at the dataset scale Kilter
implies (tens of thousands of community-graded climbs per angle bucket, i.e.
"medium-sized" tabular data), the benchmark literature is unambiguous:
tree-based models "remain state-of-the-art on medium-sized data (~10K samples)
even without accounting for their superior speed," and deep learning's
superiority on tabular data "is not clear" — in sharp contrast to image/text
domains [grinsztajn-tree-vs-dl-tabular]{1}.

The mechanistic reasons map directly onto why a deep model is *not* the obvious
first move on engineered features. Grinsztajn et al. identify three properties
a tabular neural net must be engineered to acquire but that tree ensembles have
by construction [grinsztajn-tree-vs-dl-tabular]{1}:

1. **Robustness to uninformative features.** An engineered feature set will
   contain many weak or redundant columns; trees ignore them via split
   selection, whereas NNs are easily perturbed by them.
2. **Preserving the orientation of the data.** Trees are axis-aligned, so each
   engineered feature keeps its individual meaning; NNs are rotationally
   invariant and blur per-feature semantics.
3. **Learning irregular functions.** Grade-vs-feature relationships are
   non-smooth (a single crux hold can jump the grade); trees fit piecewise
   steps naturally.

Practical corollaries that matter for this project: GBT train fast on CPU (no
GPU pipeline needed for offline training), tune easily, and — critically for
the in-browser inference constraint — XGBoost/LightGBM models are small and
export cleanly to ONNX (handed to the in-browser-inference sibling). This makes
GBT the baseline against which any CNN/GNN/sequence model from the
deep-representation sibling must justify its added complexity.

## Regression vs ordinal-classification framing

Kilter grades (V-scale / Font, or the internal `difficulty_average`) are
**finite ordered categories** — the canonical ordinal-regression setting, which
"has properties of both classification and metric regression"
[ordinal-regression-wikipedia]{2}. Three framings are available:

- **Numeric-index regression (recommended baseline).** Map each grade to its
  numeric index (or use `difficulty_average` directly as a continuous target,
  per the evaluation-methodology sibling) and fit a GBT regressor with squared
  or pseudo-Huber loss. This is order-aware for free: predicting V7 for a V6 is
  cheaper than predicting V10, and the model output is naturally continuous so
  you can report MAE/RMSE and round for accuracy. Because `difficulty_average`
  is already a community-averaged real number, regression is the most faithful
  framing.
- **Ordinal-aware methods.** Threshold/cumulative-link models or
  ordinal-binary-decomposition can be layered on GBT when grade spacing is not
  perceptually uniform; ordinal methods "have potential to outperform
  classification or regression approaches, when the range of the dependent
  variable is finite and ordered" [ordinal-regression-wikipedia]{2}.
- **Plain multiclass classification (avoid as the primary frame).** A standard
  classifier "will assume that the error of misclassifying an A as a D is just
  as bad as misclassifying A as a B," discarding the ordering
  [ordinal-regression-wikipedia]{2}. Use it only if you specifically want a
  per-grade probability distribution.

Prior climbing work spans all three: an ordinal-regression CNN beat Naive Bayes
and Softmax Regression at 34.0% over 13 grades, while a Random Forest
*regression* model hit 0.378 RMSE on indoor routes
[frontiers-climbing-grading-bias]{3}.

## Expected accuracy bar from prior work

The literature sets a concrete bar that a Kilter GBT baseline should be measured
against (note: most prior numbers are MoonBoard/outdoor, not Kilter — treat as
order-of-magnitude, deferring exact metric/split choices to the
evaluation-methodology sibling) [frontiers-climbing-grading-bias]{3}:

- **Exact single-grade accuracy ~35-47%**, with human prediction itself around
  45% — i.e. exact grading is intrinsically hard and noisy.
- **~84% accuracy within +/-1 grade**, matching the human baseline; this
  tolerance-band metric is the more honest target.
- **Best regression-style MoonBoard result ~0.86 MAE / 1.12 RMSE.**
- A **Histogram Gradient Boosting Classifier reached 91.75%** over 21
  Fontainebleau grades in a probabilistic setup, and a **Random Forest
  regressor reached 0.378 RMSE** on indoor routes (32 Font grades) — direct
  evidence classical/GBT models are competitive in this domain, not just a
  strawman baseline.

The survey's overarching framing is the **Grading Bias Problem**: the setter
injects bias into a declared grade, so the right target is the
community-consensus grade and the right training set is restricted to
climbs "whose difficulty has been determined by the community"
[frontiers-climbing-grading-bias]{3} — which is exactly what
`climb_stats.difficulty_average` provides.

## Hyperparameters and overfitting

GBT overfit if left unconstrained; the standard controls apply directly. Tune
tree count with early stopping on a validation fold; cap `max_depth` (shallow
trees, ~4-8, suit tabular interactions); use a low learning rate with more
rounds; apply L1/L2 leaf regularization, subsampling of rows
(`subsample`) and columns (`colsample_bytree`), and minimum-child-weight /
min-samples-leaf to prevent leaf overfit. CatBoost's ordered boosting and
native categorical handling, and LightGBM's leaf-wise growth with
`num_leaves`/`min_data_in_leaf` caps, are the framework-specific knobs. Because
grade noise is high (sub-50% exact accuracy is the ceiling), aggressive
regularization and honest cross-validation matter more than chasing training
fit. The split design itself (per-angle, leakage-safe) is owned by the
evaluation-methodology sibling.

## Feature importance and interpretability (sandbag detection)

Interpretability is a first-class deliverable here, not a nice-to-have: it
enables **sandbag detection** — surfacing climbs whose model-predicted grade
diverges from the consensus grade and explaining why.

Do not rely on XGBoost's default `gain`/split-count importance: it "is biased to
attribute more importance to lower splits," so a feature can paradoxically lose
attributed importance as it becomes more influential [lundberg-shap-xgboost]{4}.
Use **SHAP / TreeExplainer** instead, which is exact for XGBoost/LightGBM/
CatBoost and grounded in a game-theoretic uniqueness result guaranteeing
**consistency** (more reliance never lowers attribution) and **local accuracy**
(per-sample attributions sum to the model output) [lundberg-shap-xgboost]{4}.

For sandbag detection specifically, SHAP's per-prediction nature is the key
tool: just as "capital gain is not the most important feature globally, [but]
is by far the most important feature for a subset of customers," SHAP exposes
heterogeneous, per-climb feature effects [lundberg-shap-xgboost]{4}. A climb
with a large predicted-minus-consensus residual *plus* an anomalous SHAP
attribution profile is a soft/sandbag candidate the model can explain in human
terms ("graded easy for its number of small crimps at this angle").

## Disconfirming analysis

I searched for evidence that the GBT-baseline framing is wrong for this domain.
Two genuine caveats surfaced:

- **Sequence/spatial structure can beat tabular GBT.** The Frontiers survey
  concludes "Sequence is the key. Route-centric, NLP and probabilistic methods
  were the most successful," and an RNN (GradeNet) reached the human ~84%
  +/-1-grade bar [frontiers-climbing-grading-bias]{3}. This is the
  deep-representation sibling's territory and is a real threat to GBT *if* the
  engineered features fail to encode the spatial/relational structure of holds.
  The honest position: GBT is the strong baseline and the interpretability
  workhorse, but it is not guaranteed to be the top model — its ceiling is set
  by how much structure the feature-engineering sibling can flatten into
  columns.
- **Deep tabular models occasionally win.** TabPFN (a Bayesian net pre-trained
  on synthetic tabular data) has been reported to beat GBT in some benchmarks.
  This does not overturn the baseline recommendation at ~10K-sample scale
  [grinsztajn-tree-vs-dl-tabular]{1} but means "GBT always wins tabular" would
  be an overstatement; it is the strong default, not a proven optimum.

No source claimed classical models are unsuitable for climbing grade
prediction — the disconfirming evidence is about the *ceiling*, not the
*baseline* role.

## Contradictions

No direct source-vs-source contradiction on classical-model facts. The apparent
tension — "tree models are state-of-the-art on tabular data"
[grinsztajn-tree-vs-dl-tabular]{1} vs "sequence/RNN methods were most
successful" for climbing [frontiers-climbing-grading-bias]{3} — is not a
contradiction but a scope difference: the former concerns *engineered tabular
features*, the latter concerns models that ingest *raw hold sequences/layouts*.
Which wins depends on whether the feature representation is tabular or
structural — a hand-off question, not a conflict.

## Suggested cross-references to sibling subdomains

- **feature-engineering** — GBT performance is bounded by how well spatial/
  relational hold structure is flattened into columns; the disconfirming
  analysis above is really a feature-representation question.
- **deep-representation-models** — owns the sequence/CNN/GNN models that may
  exceed the GBT ceiling; GBT is the baseline they must beat.
- **evaluation-methodology** — owns the exact target (`difficulty_average`),
  per-angle splits, leakage control, and whether to report MAE/RMSE vs
  exact/+-1 accuracy; this brief deliberately defers all metric/split choices.
- **prior-work-datasets** — owns the MoonBoard/HF datasets and the papers cited
  here at the survey level (Frontiers, Grinsztajn).
- **in-browser-inference** — receives the trained GBT as an ONNX export; the
  small CPU-only footprint of XGBoost/LightGBM is a deployment argument for the
  baseline.

---
source_handle: grinsztajn-tree-vs-dl-tabular
fetched: 2026-06-13
source_url: https://arxiv.org/abs/2207.08815
provenance: source-direct
---

# Why do tree-based models still outperform deep learning on typical tabular data? (Grinsztajn, Oyallon, Varoquaux; NeurIPS 2022 Datasets & Benchmarks)

Benchmark of standard and novel deep-learning methods vs tree-based models (XGBoost, Random Forests) across 45 datasets from varied domains, with a methodology accounting for both model fitting and hyperparameter search (~20,000 compute hours).

## Key verbatim claims

- "tree-based models remain state-of-the-art on medium-sized data (~10K samples) even without accounting for their superior speed."
- Deep learning's superiority on tabular data "is not clear," in contrast to text and image domains.

## Three challenges identified for building tabular-specific neural nets (inductive-bias gaps GBT do NOT have)

1. "be robust to uninformative features" — handle irrelevant variables effectively.
2. "preserve the orientation of the data" — non-rotationally-invariant; maintain per-feature axis meaning (NNs are rotationally invariant and lose this).
3. "be able to easily learn irregular functions" — capture non-smooth / piecewise decision boundaries.

These are precisely the properties tree ensembles possess natively, explaining their dominance on engineered tabular feature sets at this dataset scale.

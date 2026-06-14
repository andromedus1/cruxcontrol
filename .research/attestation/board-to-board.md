---
source_handle: board-to-board
fetched: 2026-06-13
source_url: https://arxiv.org/abs/2311.12419
provenance: source-direct
---

# Board-to-Board: Evaluating Moonboard Grade Prediction Generalization (arXiv 2311.12419)

Study of grade prediction on Moonboard across hold-set editions (2016/2017/2019), reporting regression metrics and explicitly testing cross-edition generalization. The PDF body was binary-corrupted on fetch; abstract page extracted instead.

## Verbatim key passages (abstract-level)

- State of the art: "0.87 MAE and 1.12 RMSE" on Moonboard grade prediction across multiple dataset editions.
- Generalization framing: authors "demonstrate the generalization capability of this model between editions," testing across 2016, 2017, and 2019 Moonboard datasets; "generalization performance of these techniques is below human level performance currently."
- Feature design: used "a feature-set that does not require decomposing routes into individual moves," to avoid bias common in literature; applied classical ML, deep learning, and "a novel vision-based method."

## Summary

Establishes MAE/RMSE (in grade units) as the headline regression metrics for board-climb grade prediction, with ~0.87 MAE / ~1.12 RMSE as a strong reference point. Crucially demonstrates that models must be evaluated for generalization across hold-set editions/configurations rather than only in-distribution, and that current methods remain below human-level on out-of-distribution generalization. Acquisition-pending: train/test split mechanics and within-grade accuracy not recovered from the corrupted body PDF.

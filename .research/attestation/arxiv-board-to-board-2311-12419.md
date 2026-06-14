---
source_handle: arxiv-board-to-board-2311-12419
fetched: 2026-06-13
source_url: https://arxiv.org/abs/2311.12419
provenance: source-direct
---

# Board-to-Board: Evaluating Moonboard Grade Prediction Generalization (arXiv 2311.12419)

## Summary
Applies classical + deep-learning models to MoonBoard 2016/2017/2019 editions for grade
prediction, reports state-of-the-art regression error, introduces a vision-based prediction
method, and (the paper's central contribution) evaluates cross-board generalization — finding
it falls below human-level. Deliberately avoids the move-decomposition preprocessing step to
sidestep its bias.

## Verbatim key passages
- "0.87 MAE and 1.12 RMSE" — described as "state of the art grade prediction performance"
- Method note: "a feature-set that does not require decomposing routes into individual moves"
  (avoiding move-decomposition bias)
- Datasets: MoonBoard "2016, 2017, and 2019" editions
- "introduce a novel vision-based method of grade prediction"
- Generalization: "the generalization performance of these techniques is below human level
  performance currently"
- Application vision: implement "in pre-existing mobile applications" to "better track
  progress and assess new routes with reduced bias"

## Notes for downstream use
- The regression framing (MAE/RMSE on numeric grade) is an alternative to classification —
  relevant to evaluation-methodology sibling facet.
- Cross-edition generalization failure is the key cautionary finding: a model trained on one
  board/angle/set configuration may not transfer. For Kilter this maps to generalizing across
  angles and layouts.
- Vision-based input (image of the board) is an alternative to the holds-matrix encoding.

---
id: epic-grade-prediction
kind: epic
stage: drafting
tags: [ml, needs-research]
parent: null
depends_on: [epic-foundation]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
---

# Grade Prediction (ML)

## Brief

The headline differentiator: train a model to predict a climb's difficulty from hold
placements, roles, and board angle, then serve that prediction in-browser. This epic
owns the offline ML pipeline (feature extraction from the catalog → training dataset →
model) and the exported model's in-browser inference. Downstream value: grade unclimbed
routes, flag sandbagged/soft routes (predicted vs actual divergence), and surface
target-difficulty climbs.

When done, the app can predict a grade for any climb (including a freshly created one
with no ascents) and quantify predicted-vs-consensus divergence. It does NOT cover
recommendation or circuit logic — that's epic-recommendations, which consumes this
model.

## Research briefs

- `docs/briefs/data-model.md` — `climb_stats.difficulty_average` (the training target),
  `holes` coordinates, frames encoding (the raw feature source).
- **[needs-research]** — *ML grade-prediction approaches.* This is genuinely open and
  warrants **`/research-pipeline:deep-research`** (not just a brief): the approach space
  is wide — feature engineering from frames (move distances, hold density, height,
  spacing), gradient-boosted trees on engineered features, a CNN over a 2D board-image
  representation, a graph neural network (holds as nodes, moves as edges), and sequence
  models over ordered placements. Facets to decompose: feature engineering, each model
  family, evaluation/validation methodology (per-angle, benchmark vs consensus), and
  **prior work** (HuggingFace datasets `Vilin97/KilterBoard`, `stfamod/Kilter-Board-Dataset`;
  any published Kilter/MoonBoard grade-prediction work). Run the campaign before
  `/epic-design`.

## Foundation references

- `docs/ARCHITECTURE.md` — Module Map §8 (ML Pipeline); Key Dependencies (ONNX.js /
  TF.js); Biggest Risks (ML signal quality — validate early).
- `docs/SPEC.md` — Capability 5 (Grade Prediction); Capability 6 (training pipeline).

## Anticipated child features

Provisional (firmed up after the research campaign):
- Feature-extraction pipeline (catalog → training table)
- Model training + evaluation (per the chosen approach)
- Model export + in-browser inference (ONNX.js / TF.js)
- Sandbag/soft-route divergence surfacing

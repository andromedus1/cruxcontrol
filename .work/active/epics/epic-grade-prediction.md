---
id: epic-grade-prediction
kind: epic
stage: drafting
tags: [ml]
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
- **[research done]** [.research/briefs/kilter-grade-prediction/parent.md](../../../.research/briefs/kilter-grade-prediction/parent.md)
  — deep-research campaign (6 specialists + synthesis + evaluator; verdict GO, 0.84).
  **Recommended spine:** decode `frames`→(x,y,role) geometry → engineer geometric/move
  features (reach/span, esp. largest hand move; angle as a first-class feature) → fit a
  **gradient-boosted-tree regressor** on per-angle `difficulty_average` → evaluate with
  **GroupKFold grouped on `climb_uuid`** (no climb spans splits) on the **Vilin97/KilterBoard**
  dataset (ships UUID-disjoint splits) → export **GBT→ONNX**, run single-threaded WASM via
  ONNX Runtime Web. SHAP/TreeExplainer → sandbag detection. Per-facet briefs:
  feature-engineering, classical-models, deep-representation-models, evaluation-methodology,
  prior-work-datasets, in-browser-inference (same directory). Campaign report:
  [campaign.md](../../../.research/briefs/kilter-grade-prediction/campaign.md).

  **Design follow-ups from the evaluator (address in `/epic-design`):**
  1. Measure Vilin97's actual row count (parent says ~100K–1M, not ~10K); if large,
     treat a small role-channel CNN as a **co-baseline**, not a deferred next step.
  2. Front-load a **data-acquisition workstream** — BoardLib pull, frames-decode
     validation, near-duplicate detection (for the grouped split), label hygiene
     (kilterbench flash-log mitigation).
  3. **Contradiction to carry, not resolve:** move-decomposition (BetaMove→GradeNet)
     drove MoonBoard's best results but Board-to-Board deliberately avoids it and still
     hits regression SOTA — baseline starts non-decomposed; revisit move features as an
     experiment. There is **no published Kilter-specific predictor** (prior art is
     MoonBoard); the ~42–47% exact / ~84% within ±1 / ~0.87 MAE band is borrowed and
     unvalidated on Kilter — validate empirically.

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

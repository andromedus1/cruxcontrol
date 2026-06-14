---
source_handle: lundberg-shap-xgboost
fetched: 2026-06-13
source_url: https://medium.com/data-science/interpretable-machine-learning-with-xgboost-9ec80d148d27
provenance: source-direct
---

# Interpretable Machine Learning with XGBoost (Scott Lundberg)

Author of SHAP / TreeExplainer explains why default XGBoost feature importance is unreliable and how SHAP fixes it.

## Verbatim claims

- "the gain method is biased to attribute more importance to lower splits" — when a feature becomes more important (higher in the tree), gain-based importance can paradoxically decrease.
- "it turns out Tree SHAP is mathematically equivalent to averaging differences in predictions over all possible orderings of the features."
- "a proof from game theory on the fair allocation of profits leads to a uniqueness result for feature attribution methods."
- SHAP guarantees **consistency** (increasing reliance on a feature never decreases its attribution) and **local accuracy** (per-sample feature importances sum to the model output).
- Per-sample / outlier insight: "while capital gain is not the most important feature globally, it is by far the most important feature for a subset of customers." SHAP dependence plots reveal heterogeneous effects invisible in aggregate importance.

## Relevance to this facet

Per-prediction SHAP attributions let you explain why a specific climb was graded high/low and surface climbs whose predicted vs consensus grade diverge with anomalous feature attributions (sandbag/soft-grade candidates). TreeExplainer is exact for XGBoost/LightGBM/CatBoost.

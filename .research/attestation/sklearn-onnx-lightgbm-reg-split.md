---
source_handle: sklearn-onnx-lightgbm-reg-split
fetched: 2026-06-13
source_url: https://onnx.ai/sklearn-onnx/auto_tutorial/plot_gexternal_lightgbm_reg.html
provenance: source-direct
---

# Summary

sklearn-onnx tutorial on converting a LightGBM regressor, documenting the `split` option that subdivides a TreeEnsemble node to recover double-precision summation accuracy. Surfaced via search; corroborates the float/double attestation.

# Verbatim key passages

- Tree ensemble regressors compute predictions by summing each tree's contribution; in float32 ONNX this summation is a float addition, creating discrepancy versus the original double-precision computation.
- "an option was added to split the TreeEnsembleRegressor node into multiple nodes and perform summation with double precision this time. The split parameter is the number of trees per node TreeEnsembleRegressor."
- "Double precision is required to avoid significant discrepancies when the prediction computation involves discontinuous functions as in Trees."
- Recommendation: "always compare approximate equality of predictions on a validation set prior to deploying the exported ONNX model."

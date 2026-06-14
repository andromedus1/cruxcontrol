---
source_handle: sklearn-onnx-float-double
fetched: 2026-06-13
source_url: https://onnx.ai/sklearn-onnx/auto_tutorial/plot_ebegin_float_double.html
provenance: source-direct
---

# Summary

sklearn-onnx tutorial "Issues when switching to float" — the canonical explanation of float32-vs-float64 prediction discrepancies in tree ensembles converted to ONNX, and the primary train/serve-skew risk for tree models.

# Verbatim key passages

- scikit-learn computes in double precision (float64); ONNX converters typically assume float32 because ONNX was designed initially for deep learning deployment.
- For continuous functions the float cast introduces only small discrepancies bounded by the derivative.
- "A decision tree trained for a regression is not a continuous function. Therefore, even a small dx may introduce a huge discrepancy."
- At decision boundaries, float32 and float64 can yield opposite comparison results ("discord areas"): `x <= y` may be true in double but false once both cast to float32, sending the tree down a different path.
- Mitigation: keep types consistent — cast inputs to float64 first, run normalizer in double precision, cast to float32 only immediately before tree ops; conversion options like `{"div": "div_cast"}` control operator behavior.
- Validation advice: always validate predictions on a held-out test set before deployment to confirm the converted model matches the original sklearn pipeline acceptably.

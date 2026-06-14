---
source_handle: sklearn-onnx-lightgbm-pipeline
fetched: 2026-06-13
source_url: http://onnx.ai/sklearn-onnx/auto_examples/plot_pipeline_lightgbm.html
provenance: source-direct
---

# Summary

sklearn-onnx tutorial: converting a scikit-learn pipeline that wraps a LightGBM classifier to ONNX, including converter registration and output-shape configuration.

# Verbatim key passages

- Workflow: train pipeline → register converter via `update_registered_converter()` → convert and validate predictions match.
- Registration snippet:
  ```python
  update_registered_converter(
      LGBMClassifier,
      "LightGbmLGBMClassifier",
      calculate_linear_classifier_output_shapes,
      convert_lightgbm,
      options={"nocl": [True, False], "zipmap": [True, False, "columns"]},
  )
  ```
- Conversion snippet:
  ```python
  model_onnx = convert_sklearn(
      pipe, "pipeline_lightgbm",
      [("input", FloatTensorType([None, 2]))],
      target_opset={"": 12, "ai.onnx.ml": 2},
  )
  ```
- `zipmap` option controls probability output format (dict mappings vs vector arrays) — affects downstream JS consumption. Setting `zipmap=False` yields plain tensors easier to read in onnxruntime-web.
- `target_opset {"ai.onnx.ml": 2}` ensures TreeEnsemble support for GBT models.

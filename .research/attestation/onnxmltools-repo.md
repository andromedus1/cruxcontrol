---
source_handle: onnxmltools-repo
fetched: 2026-06-13
source_url: https://github.com/onnx/onnxmltools
provenance: source-direct
---

# Summary

ONNXMLTools GitHub repo — the conversion library that turns XGBoost, LightGBM, sklearn, LibSVM, etc. into ONNX. Surfaced via search; details corroborated by sklearn-onnx tutorial pages fetched separately.

# Verbatim key passages

- ONNXMLTools "enables conversion of models to ONNX" from XGBoost and LightGBM (among others).
- Install via PyPI: `pip install onnxmltools`. From source, set env var `ONNX_ML=1` before installing the onnx package.
- `convert_lightgbm()` converts a LightGBM model to ONNX. Analogous XGBoost conversion functions exist.
- `target_opset` parameter controls ONNX version compatibility of the emitted model.

---
source_handle: onnx-traditional-ml
fetched: 2026-06-13
source_url: https://onnxruntime.ai/docs/tutorials/traditional-ml.html
provenance: source-direct
---

# Summary

Official ONNX Runtime docs page on running traditional (non-neural) ML models. Confirms ONNX Runtime can execute tree/classical models converted from sklearn, LightGBM, XGBoost, LibSVM via the ONNX-ML operator specification.

# Verbatim key passages

- "ONNX Runtime supports ONNX-ML and can run traditional machine models created from libraries such as Sciki-learn, LightGBM, XGBoost, LibSVM, etc."
- Supported source libraries listed: Scikit-learn, LightGBM, XGBoost, LibSVM.
- Links out to ONNX-ML operator documentation (`docs/Operators-ml.md`) — the `ai.onnx.ml` domain, which contains `TreeEnsembleRegressor`/`TreeEnsembleClassifier`.
- The page does NOT explicitly state web/browser support for traditional ML; that must be inferred from onnxruntime-web sharing the same operator kernels (acquisition-pending confirmation that the default web WASM build registers ai.onnx.ml kernels).

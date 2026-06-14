---
source_handle: tfjs-converter
fetched: 2026-06-13
source_url: https://github.com/tensorflow/tfjs-converter
provenance: source-direct
---

# Summary

TensorFlow.js converter repo/docs — converts TensorFlow SavedModel and Keras models to TF.js format. Establishes that the TF.js path is neural-net-only (no native tree/GBT support). Surfaced via search.

# Verbatim key passages

- tfjs-converter "Convert[s] TensorFlow SavedModel and Keras models to TensorFlow.js."
- During conversion the model graph is traversed and each operation is checked for TF.js op support.
- No native support in TensorFlow.js or its converter for XGBoost / gradient-boosted-tree models — TF.js is built for neural networks; tree ensembles are not expressible in its op graph.
- Implication: a GBT model destined for the browser must go through ONNX (onnxruntime-web), not TF.js. TF.js is the path only if the offline model is a neural net.

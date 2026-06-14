---
description: In-browser inference and deployment paths for a Kilter Board grade-prediction model trained offline in Python and served client-only in a PWA — ONNX Runtime Web vs TensorFlow.js, tree-to-ONNX conversion, WASM/SIMD backends, model size/latency, and feature-extraction parity to avoid train/serve skew.
type: brief
kind: research
slug: kilter-grade-inference
research_method: /deep-research
provenance: agent-synthesis
verification_status: attested
confidence: speculative
status: draft
updated: 2026-06-13
summary: For a client-only PWA, the simplest reliable path depends on the offline model family. A gradient-boosted tree model (XGBoost/LightGBM/sklearn) cannot go through TensorFlow.js — TF.js is neural-net-only — so it must be converted to ONNX (via onnxmltools/sklearn-onnx) and run with ONNX Runtime Web on the WASM (CPU) backend. A neural net can take either path, but ONNX Runtime Web still gives the most uniform deployment story across model families. The dominant correctness risk is not the runtime but two forms of train/serve skew: (1) float32-vs-float64 discrepancies at tree decision boundaries, which are sharp and unbounded for the discontinuous tree function, and (2) reimplementing the Python feature-extraction pipeline in JavaScript without bit-for-bit parity. Both are mitigated by exporting preprocessing into the ONNX graph where possible and validating exported predictions against the Python model on a held-out set before shipping.
key_findings:
  - TensorFlow.js converts only TensorFlow SavedModel and Keras (neural-net) models; it has no native support for XGBoost/LightGBM/gradient-boosted trees, so a tree model destined for the browser must route through ONNX, not TF.js [tfjs-converter]{1}.
  - ONNX Runtime supports ONNX-ML and runs traditional tree models (sklearn, LightGBM, XGBoost, LibSVM) via the ai.onnx.ml operator domain (TreeEnsembleRegressor/Classifier); onnxmltools and sklearn-onnx perform the offline conversion [onnx-traditional-ml]{2} [onnxmltools-repo]{3} [sklearn-onnx-lightgbm-pipeline]{4}.
  - The biggest tree train/serve-skew risk is precision - sklearn/LightGBM compute in float64 but ONNX defaults to float32; at a tree's discontinuous decision boundary even a tiny dx flips a comparison and sends traversal down the wrong branch, so discrepancies are unbounded, not derivative-bounded [sklearn-onnx-float-double]{5}.
  - Mitigations are concrete - keep preprocessing in double precision and cast to float32 only just before tree ops, and use the TreeEnsembleRegressor `split` option to recover double-precision summation across many trees; always validate exported predictions on a held-out set before deploy [sklearn-onnx-float-double]{5} [sklearn-onnx-lightgbm-reg-split]{6}.
  - ONNX Runtime Web's default execution provider is WASM (CPU); multi-threading needs WebAssembly threads AND `crossOriginIsolated`, which requires serving COOP `same-origin` + COEP `require-corp` headers so SharedArrayBuffer is available — otherwise it silently falls back to single-threaded [onnx-web-env-flags]{7} [coop-coep-sab]{8}.
  - For a small tabular model (a few features, one GBT ensemble), single-threaded WASM with SIMD is more than fast enough; SIMD processes 4-8 values per instruction, and a tree-ensemble forward pass over a single climb is sub-millisecond-class work, so the COOP/COEP complexity is optional for trees [coop-coep-sab]{8} [onnx-web-env-flags]{7}.
  - Replicating Python feature extraction in JavaScript is the second skew source; the most reliable defense is to push as much preprocessing as possible into the ONNX graph (sklearn-onnx converts whole pipelines, not just the estimator) so JS only assembles raw inputs [sklearn-onnx-lightgbm-pipeline]{4} [sklearn-onnx-float-double]{5}.
---

# In-Browser Inference and Deployment

## Scope

How to take a model trained offline in Python and run inference inside a client-only PWA (no server). Two candidate offline model families are in play for this campaign: a gradient-boosted tree (GBT) like XGBoost/LightGBM/sklearn, or a neural net. This facet covers the runtime and deployment mechanics — export path, conversion, backend selection, size/latency, and feature-extraction parity. It does not cover which model to choose, how features are engineered, or how accuracy is evaluated (sibling facets).

## The two export paths

There are two mature browser inference runtimes, and the choice is largely forced by the offline model family.

**TensorFlow.js** converts TensorFlow SavedModel and Keras models to a TF.js format; during conversion it walks the model graph and checks each op is supported [tfjs-converter]{1}. It is a neural-network runtime — it has no native representation for tree ensembles, so XGBoost/LightGBM models cannot be converted to TF.js [tfjs-converter]{1}. TF.js is therefore only on the table if the offline model is a neural net.

**ONNX Runtime Web (onnxruntime-web)** runs ONNX models in the browser using the same inference API and operator kernels as server-side ONNX Runtime. Critically, ONNX Runtime supports ONNX-ML — the `ai.onnx.ml` operator domain that contains `TreeEnsembleRegressor` / `TreeEnsembleClassifier` — so it can run tree models from sklearn, LightGBM, XGBoost, and LibSVM once they are converted to ONNX [onnx-traditional-ml]{2}. It can equally run a neural net. This makes ONNX Runtime Web the single runtime that covers both candidate model families.

### Practical recommendation (simplest reliable path)

Use **ONNX Runtime Web on the WASM (CPU) backend**, regardless of whether the offline model ends up being a GBT or a small neural net. Rationale:

- It is the only path that works for trees at all [tfjs-converter]{1} [onnx-traditional-ml]{2}.
- It keeps the deployment story identical if the model family changes between research iterations — no rewrite of the inference layer.
- For a small tabular model the WASM backend needs no GPU, no WebGPU feature detection, and (see below) no cross-origin-isolation headers.

If and only if the offline model becomes a large neural net where WASM latency is unacceptable, escalate to the WebGPU execution provider — but that is a later optimization, not the starting point.

## Converting tree models to ONNX

The offline (Python) conversion uses **onnxmltools** and/or **sklearn-onnx (skl2onnx)**:

- `onnxmltools` converts XGBoost and LightGBM models to ONNX; install via `pip install onnxmltools` [onnxmltools-repo]{3}.
- For a full preprocessing+estimator pipeline, `sklearn-onnx` registers the LightGBM/XGBoost converter into its pipeline machinery and emits one ONNX graph for the whole pipeline [sklearn-onnx-lightgbm-pipeline]{4}:

  ```python
  update_registered_converter(
      LGBMClassifier, "LightGbmLGBMClassifier",
      calculate_linear_classifier_output_shapes,
      convert_lightgbm,
      options={"nocl": [True, False], "zipmap": [True, False, "columns"]},
  )
  model_onnx = convert_sklearn(
      pipe, "pipeline_lightgbm",
      [("input", FloatTensorType([None, n_features]))],
      target_opset={"": 12, "ai.onnx.ml": 2},
  )
  ```

- Set `zipmap=False` so probability/score outputs come back as plain tensors rather than a list-of-dicts, which is far easier to read from JavaScript [sklearn-onnx-lightgbm-pipeline]{4}.
- `target_opset={"ai.onnx.ml": 2}` ensures TreeEnsemble support [sklearn-onnx-lightgbm-pipeline]{4}.

For Kilter difficulty as a regression (continuous grade) the analogous estimator is `TreeEnsembleRegressor`; for ordinal/classification framing it is `TreeEnsembleClassifier`. (Which framing is correct is a sibling-facet decision.)

## Train/serve skew — the dominant correctness risk

The runtime is the easy part. Two skew sources will silently degrade predictions in the browser.

### 1. float32 vs float64 at tree decision boundaries

scikit-learn and LightGBM compute in **double precision (float64)**, but ONNX converters default to **float32** because ONNX was built for deep learning [sklearn-onnx-float-double]{5}. For continuous functions this only introduces small, derivative-bounded error. **Trees are discontinuous** — a decision node is a hard threshold comparison. "A decision tree trained for a regression is not a continuous function. Therefore, even a small dx may introduce a huge discrepancy." [sklearn-onnx-float-double]{5}. At a boundary, `x <= y` can be true in float64 but false once both are cast to float32, sending traversal down a different branch and producing a categorically different leaf value [sklearn-onnx-float-double]{5}.

Mitigations (all offline, in the conversion step):

- Keep preprocessing in float64 and cast to float32 only immediately before the tree op; control operator behavior with options like `{"div": "div_cast"}` [sklearn-onnx-float-double]{5}.
- Use the `TreeEnsembleRegressor` **`split`** option, which subdivides the ensemble node so the cross-tree summation is done in double precision (`split` = number of trees per node) [sklearn-onnx-lightgbm-reg-split]{6}.
- **Validate exported predictions against the original Python model on a held-out set before deploying** — this is the explicit, repeated recommendation [sklearn-onnx-float-double]{5} [sklearn-onnx-lightgbm-reg-split]{6}.

### 2. Feature-extraction parity in JavaScript

The PWA must produce the model's input vector from a Kilter climb (the hold set / role-encoded board state) in JavaScript, matching the Python training pipeline bit-for-bit. Any divergence in encoding, ordering, scaling, or default-value handling is undetectable skew.

The strongest defense is to **minimize the JavaScript surface**: sklearn-onnx converts entire pipelines, so scalers, encoders, and other deterministic preprocessing should be baked into the ONNX graph rather than reimplemented in JS [sklearn-onnx-lightgbm-pipeline]{4} [sklearn-onnx-float-double]{5}. Then JS only assembles the raw climb representation (hold IDs and roles) into the tensor shape the graph expects, and the graph does the rest with the same numerics as training. Whatever JS preprocessing remains should be covered by a parity test that compares JS-extracted feature vectors to the Python pipeline's on a sample of climbs.

## Backend, size, and latency for a PWA

ONNX Runtime Web's default execution provider is **WASM (CPU)** [onnx-web-env-flags]{7}. WASM can use SIMD (vectorized, 4-8 values/instruction) and optional multi-threading.

- **Multi-threading** is gated: it activates only when the browser supports WASM threads AND `crossOriginIsolated` is true, which requires serving `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless`) so `SharedArrayBuffer` is available; without these headers it silently falls back to single-threaded [onnx-web-env-flags]{7} [coop-coep-sab]{8}. `ort.env.wasm.numThreads` defaults to auto (`min(navigator.hardwareConcurrency/2, 4)`); set `= 1` to force single-thread [onnx-web-env-flags]{7}.
- **For a small tabular GBT model this header complexity is unnecessary.** A single-feature-vector forward pass through a tree ensemble is trivial work; single-threaded WASM with SIMD handles it comfortably [coop-coep-sab]{8}. Recommend starting single-threaded (`numThreads = 1`), skipping COOP/COEP, and only revisiting if a large neural net is chosen.
- **Bundle/size**: ship the ONNX model and the onnxruntime-web WASM binaries as static PWA assets; `ort.env.wasm.wasmPaths` lets you point the loader at your hosted copies rather than a CDN [onnx-web-env-flags]{7}. A converted GBT for tabular data is small (model size scales with tree count x depth), so it caches well in a service worker. (Exact byte sizes are acquisition-pending — measure post-conversion.)
- `env.wasm.proxy = true` can move inference to a Web Worker to keep the UI thread responsive, but it is incompatible with WebGPU and CSP-restricted contexts [onnx-web-env-flags]{7}; for sub-millisecond tree inference it is not needed.

## Disconfirming analysis

- **Could we skip ONNX entirely and hand-port the tree ensemble to JS?** Possible — a GBT is just nested if/else plus a sum, and several JS micro-libraries do this. But hand-porting reintroduces exactly the float/threshold skew problem [sklearn-onnx-float-double]{5} without the conversion tooling's mitigations (`split`, pipeline embedding), and adds a bespoke artifact to maintain. ONNX Runtime Web is the lower-risk path. This remains an option only if onnxruntime-web's WASM build turns out not to register `ai.onnx.ml` kernels (acquisition-pending — see gaps).
- **Is TF.js ever preferable?** Only if the chosen model is a neural net AND a TF.js-specific advantage matters (e.g., an existing Keras ecosystem). For this campaign's tree-leaning, tabular, small-feature problem, TF.js adds nothing and excludes the GBT option [tfjs-converter]{1}.
- **Does WASM single-threaded actually suffice?** The sub-millisecond claim is reasoned from "small/medium models viable on CPU" [coop-coep-sab]{8} plus the triviality of one tree-ensemble pass, not a measured Kilter benchmark. Confidence is speculative until benchmarked on the actual converted model.

## Contradictions

None material across sources. The official ONNX traditional-ML page does not explicitly assert browser support for ai.onnx.ml [onnx-traditional-ml]{2}, while practitioner guidance and the shared-kernel architecture imply it does; this is a confirmation gap, not a contradiction.

## Suggested cross-references to sibling subdomains

- **feature-engineering**: defines the exact input representation (hold/role encoding) that the JS extractor must reproduce and that should ideally be embedded into the ONNX pipeline graph — directly determines the parity-test surface.
- **classical-models**: if the chosen model is XGBoost/LightGBM, the conversion + `split`/precision mitigations here apply directly; coordinate on tree count/depth (affects model size).
- **deep-representation-models**: if a neural net is chosen, this facet's WebGPU escalation note and the TF.js-vs-ONNX choice become live.
- **evaluation-methodology**: the "validate exported predictions on a held-out set" requirement is a deployment gate that should be folded into the evaluation harness (compare Python vs ONNX outputs, not just Python CV scores).

## Acquisition-pending gaps

- Confirm the **stock onnxruntime-web WASM build registers `ai.onnx.ml` (TreeEnsemble) kernels** by default, or whether a custom build is required (`onnx-traditional-ml` page is silent on web specifically).
- **Measured byte size and cold-start + per-inference latency** of a converted Kilter GBT on single-threaded WASM in a real PWA — needed to confirm the "skip COOP/COEP" recommendation.
- Whether the **XGBoost** converter exposes a `split`-equivalent precision control identical to LightGBM's (`split` is documented on the LightGBM regressor path).

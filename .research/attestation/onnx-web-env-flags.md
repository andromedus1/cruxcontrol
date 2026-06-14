---
source_handle: onnx-web-env-flags
fetched: 2026-06-13
source_url: https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html
provenance: source-direct
---

# Summary

Official ONNX Runtime Web configuration reference covering execution providers and WASM environment flags (threads, proxy, wasmPaths).

# Verbatim key passages

- Execution providers available: `'wasm'` ("The default CPU execution provider"), `'webgpu'`, `'webnn'`, `'webgl'`.
- `ort.env.wasm.numThreads` default is `0` = auto; in browsers this resolves to "half of `navigator.hardwareConcurrency` or `4`, whichever is smaller."
- `ort.env.wasm.numThreads = 1;` disables multi-threading.
- Multi-threading "only activates when the browser supports WebAssembly multi-threading AND `crossOriginIsolated` mode is enabled."
- `env.wasm.proxy` offloads compute to a separate Web Worker for UI responsiveness; cannot be used with WebGPU EP or under CSP-restricted environments.
- `env.wasm.wasmPaths` overrides binary file locations (string prefix or filename→path object map).

---
source_handle: coop-coep-sab
fetched: 2026-06-13
source_url: https://maddevs.io/writeups/running-ai-models-locally-in-the-browser/
provenance: source-direct
---

# Summary

Practitioner write-up on running AI models locally in the browser with WebGPU and WASM; covers cross-origin isolation headers required for SharedArrayBuffer, and the SIMD performance angle. Corroborated by the official onnxruntime-web env-flags doc (separate attestation) on the multi-threading + crossOriginIsolated requirement.

# Verbatim key passages

- Two HTTP headers must be present on every response: `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless`), so `SharedArrayBuffer` is available.
- "WebGPU and multi-threaded WASM both require SharedArrayBuffer, which the browser only enables under Cross-Origin Isolation. Without these headers... multi-threaded WASM silently falls back to single-threaded mode."
- "Modern WASM with SIMD extensions can process 4-8 values per instruction, which makes small and medium models viable on a CPU without feeling unusable."
- Debug check: `console.log('Cross-Origin Isolated:', window.crossOriginIsolated); // Must be true`.
- WASM multi-threading uses SharedArrayBuffer + Web Worker + SIMD128.

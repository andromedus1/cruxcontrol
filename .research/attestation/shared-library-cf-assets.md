---
source_handle: shared-library-cf-assets
fetched: 2026-09-26
source_url: https://developers.cloudflare.com/workers/static-assets/binding/
provenance: source-direct
substrate_confidence: source-direct
---

# Cloudflare Workers — Static asset binding

## Summary

Static Assets can serve application files while selected paths execute Worker code first. Routing behavior is configurable rather than implicitly API-aware.

## Anchored observations (paraphrased)

### run_worker_first
This option accepts a boolean or an array of route patterns. The example routes `/api/*` through the Worker while excluding `/api/docs/*`; default behavior prioritizes matching assets.

### ASSETS binding
Worker code can call the asset binding's `fetch` method to serve assets. The documented SPA fallback option supplies the application entry page for unmatched navigation paths.

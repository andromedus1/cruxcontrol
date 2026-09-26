---
source_handle: shared-library-cf-service-pricing
fetched: 2026-09-26
source_url: https://developers.cloudflare.com/workers/platform/pricing/
provenance: source-direct
substrate_confidence: source-direct
---

# Cloudflare Workers — Pricing

## Summary

Workers offers free usage and a paid account minimum, with usage charges above included allocations.

## Anchored observations (paraphrased)

### Workers table and introductory pricing
The free plan includes 100,000 requests per day and 10 milliseconds of CPU time per invocation. The paid plan has a minimum account charge of USD 5 per month; additional request and CPU usage can be billed beyond included allocations. This minimum is not a spending cap.

### Workers table, footnote 3
Requests to static assets are free and unlimited. This does not make Worker execution free or remove the separately documented database limits.

### Workers table, footnote 4 — Workers Caching
With Workers Caching enabled, requests served from the Worker cache, including static assets, incur the same per-request charge as invoking the Worker. CPU charges apply only when the cache is missed or bypassed. The free-static-assets statement must retain this qualification.

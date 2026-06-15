---
source_handle: cf-pages-build-limits
fetched: 2026-06-14
source_url: https://developers.cloudflare.com/pages/platform/limits/
provenance: source-direct
---

# Cloudflare Pages — Build limits (Free plan)

## Summary

Cloudflare Pages' native Git-integration builds are metered: on the Free plan, one
build at a time, 500 builds per month, with a 20-minute build timeout, concurrency
counted per account. This is the load-bearing source for the tradeoff argument that
running build/test in GitHub Actions (and using wrangler direct upload to deploy) does
not consume Cloudflare's native build quota. (Workers Builds has its own analogous
quotas; the Pages numbers are quoted here as the concrete documented figures.)

## Key passages

> "Build limits depend on your plan:
>
> | | Free | Pro | Business |
> |---|---|---|---|
> | Builds | 1 build at a time | 5 concurrent builds | 20 concurrent builds |
> | Builds per month | 500 | 5,000 | 20,000 |
>
> Builds will timeout after 20 minutes. Concurrent builds are counted per account."
> — § Builds

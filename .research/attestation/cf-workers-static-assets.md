---
source_handle: cf-workers-static-assets
fetched: 2026-06-14
source_url: https://developers.cloudflare.com/workers/static-assets/
provenance: source-direct
---

# Cloudflare Workers — Static Assets (SPA routing)

## Summary

Cloudflare's Workers Static Assets documentation describes how to serve a single-page
application: setting `not_found_handling = "single-page-application"` returns a 200 with
`index.html` for any request that does not match a static asset. This is the
load-bearing source for configuring a React + Vite SPA on Workers Static Assets.

## Key passages

> "`not_found_handling = "single-page-application"`: Sets your application to return a
> 200 OK response with `index.html` for requests which don't match a static asset. Use
> this if you have a Single Page Application."
> — § Static Assets, SPA routing

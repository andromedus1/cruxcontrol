---
source_handle: shared-library-cf-version-urls
fetched: 2026-09-26
source_url: https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/
provenance: source-direct
substrate_confidence: source-direct
---

# Cloudflare Workers — Version URLs

## Summary

Version URLs expose a particular uploaded Worker version. They do not create a separate data environment.

## Anchored observations (paraphrased)

### Version URLs
An enabled Version URL is public after a version is created. The introduction states that it uses that version's configuration and resources rather than creating an isolated environment.

### Manage access to Version URLs
Access can require sign-in for one Worker's version URLs or for Workers across an account. The page distinguishes this from isolated branch testing using the separate Previews workflow.

---
source_handle: shared-library-cf-worker-access
fetched: 2026-09-26
source_url: https://developers.cloudflare.com/workers/configuration/cloudflare-access/
provenance: source-direct
substrate_confidence: source-direct
---

# Cloudflare Workers — Access integration

## Summary

The page distinguishes direct Worker authentication context from routes that pass through another Worker. It also describes overlapping Access protection levels.

## Anchored observations (paraphrased)

### Read authenticated user identity / ctx.access limitations
A directly invoked Worker can receive authenticated identity in `ctx.access` without extra configuration or JWT parsing. Service bindings do not propagate it. With Workers Static Assets, an internal routing Worker receives that context but does not pass it to user Worker code, even when Access protects the application.

### Understand the Access hierarchy
Hostname/path policies take precedence over Worker-level protection, which takes precedence over account-wide protection.

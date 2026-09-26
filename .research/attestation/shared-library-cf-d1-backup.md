---
source_handle: shared-library-cf-d1-backup
fetched: 2026-09-26
source_url: https://developers.cloudflare.com/d1/reference/time-travel/
provenance: source-direct
substrate_confidence: source-direct
---

# Cloudflare D1 — Time Travel and backups

## Summary

D1 provides managed point-in-time recovery. The restore history is bounded and differs by plan.

## Anchored observations (paraphrased)

### Time Travel
Recovery history is enabled for databases and can restore a database to a selected point within its retention window.

### Notes
The documented window is seven days on Workers Free and thirty days on Workers Paid. The page links SQL export as an additional way to back up data. These statements concern the hosted D1 database; they make no promise about application data stored on client devices.

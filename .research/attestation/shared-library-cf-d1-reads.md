---
source_handle: shared-library-cf-d1-reads
fetched: 2026-09-26
source_url: https://developers.cloudflare.com/d1/best-practices/read-replication/
provenance: source-direct
substrate_confidence: source-direct
---

# Cloudflare D1 — Read replication

## Summary

Read replication is asynchronous. The page distinguishes ordinary binding queries from queries using the Sessions API.

## Anchored observations (paraphrased)

### Use read replication
Without the Sessions API, queries execute on the primary database. Replicated reads require sessions; writes execute on the primary.

### Sequential consistency / bookmarks
A session provides sequential consistency, and bookmarks carry a minimum observed database position between sessions. `first-primary` starts with a primary read. Replicas can lag, so enabling replication does not by itself promise immediate visibility of another client's latest write.

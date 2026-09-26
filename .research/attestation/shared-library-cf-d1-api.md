---
source_handle: shared-library-cf-d1-api
fetched: 2026-09-26
source_url: https://developers.cloudflare.com/d1/worker-api/d1-database/
provenance: source-direct
substrate_confidence: source-direct
---

# Cloudflare D1 — Database binding

## Summary

D1 exposes prepared statements and batched operations through a Worker environment binding. The batch contract provides a transaction boundary for a specified sequence of statements.

## Anchored observations (paraphrased)

### prepare()
Parameterized statements use `prepare` followed by `bind`, separating values from SQL text.

### batch()
Statements execute sequentially and results retain input order. The documentation defines batched statements as transactions: a failing statement aborts or rolls back the sequence. The example supplies a list of prepared statements; this does not establish a transaction spanning separate network requests.

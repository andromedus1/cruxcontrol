---
source_handle: shared-library-sb-rls
fetched: 2026-09-26
source_url: https://supabase.com/docs/guides/database/postgres/row-level-security
provenance: source-direct
substrate_confidence: source-direct
---

# Supabase — Row Level Security

## Summary

Postgres row-level policies can use authenticated identity and JWT claims. The page warns about the trust and freshness of those claims.

## Anchored observations (paraphrased)

### auth.uid()
This helper identifies the signed-in user and returns null without authentication.

### auth.jwt()
User-editable metadata must not supply authorization decisions. Application metadata is not directly user-editable, but JWT claims can remain stale: removing a user from a team in stored metadata does not update an already-issued token until refresh. A policy using those claims inherits that delay.

---
source_handle: shared-library-sb-keys
fetched: 2026-09-26
source_url: https://supabase.com/docs/guides/getting-started/api-keys
provenance: source-direct
substrate_confidence: source-direct
---

# Supabase — API keys

## Summary

API keys identify an application component; Supabase Auth separately identifies an individual user.

## Anchored observations (paraphrased)

### Which key do you use? / Key types
Publishable keys are suitable for shipped clients. Secret keys are for controlled backend components and bypass Row Level Security. Legacy `service_role` keys likewise have elevated privileges.

### Postgres roles and Row Level Security
A signed-in client using a publishable key acts as `authenticated`; without sign-in it acts as `anon`. A secret key uses `service_role`, whose bypass privilege means ordinary row-level policies do not constrain it.

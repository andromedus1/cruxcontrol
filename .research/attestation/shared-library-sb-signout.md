---
source_handle: shared-library-sb-signout
fetched: 2026-09-26
source_url: https://supabase.com/docs/guides/auth/signout
provenance: source-direct
substrate_confidence: source-direct
---

# Supabase Auth — Signing out

## Summary

Sign-out has configurable scope and separates refresh-token revocation from access-token lifetime.

## Anchored observations (paraphrased)

### Sign out and scopes
The `local` scope ends the current session, `global` affects every session for the user, and `others` leaves the current session active. JavaScript defaults to global scope.

### Access-token lifetime
Sign-out destroys affected refresh tokens and removes the client's stored session. Already-issued access tokens remain valid until the expiry encoded in their `exp` claim; sign-out is not immediate invalidation of every bearer token.

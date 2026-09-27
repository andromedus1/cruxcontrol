---
source_handle: scout-boardsesh-auth
fetched: 2026-09-27
source_url: https://github.com/boardsesh/boardsesh/blob/ab9a998efde3559869a6ab9884b36e804ce5f932/packages/mobile/src/lib/auth-store.ts
provenance: source-direct
substrate_confidence: source-direct
---

# Boardsesh native credentials

## Anchored observations (paraphrased)

### Imports / AUTH_SECURE_KEYS / ensureAuthCredentialsMigrated

The native credential store uses secure-store helper functions for JWT, refresh token
and expiry keys. Credential mutation is serialized and the source handles migration
between keychain namespaces. Comments and code handle failed deletion/migration and
sign-out races. These are implementation observations, not an audit of the whole
authentication system or evidence for another provider's native compatibility.

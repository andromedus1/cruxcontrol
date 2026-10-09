---
source_handle: shared-library-cf-application-token
fetched: 2026-10-09
source_url: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/
provenance: source-direct
substrate_confidence: source-direct
---

# Cloudflare Access — Application token

## Summary

The application token distinguishes human identity claims from service-token claims.
An application's durable membership identifier must not assume the provider subject
survives removal and recreation of an account.

## Anchored observations (paraphrased)

### Payload / Identity-based authentication
The documented claims include audience, verified email, expiry, issue time,
not-before time, issuer, application-token type, and subject. The subject is unique
to an email within an account; removing and re-adding the user or authenticating to
another organization changes it.

### Payload / Service token authentication; Signature
The service-token example has an empty subject and lacks the human email claim.
Signatures use RS256 and the corresponding public key for verification.

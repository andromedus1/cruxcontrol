---
source_handle: shared-library-cf-jwt
fetched: 2026-09-26
source_url: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
provenance: source-direct
substrate_confidence: source-direct
---

# Cloudflare Access — Validate JWTs

## Summary

The page documents origin-side verification of Access assertions and supplies a Cloudflare Worker example using a JWT library.

## Anchored observations (paraphrased)

### Access signing keys
Verification uses the Access team's public keys from its `/cdn-cgi/access/certs` endpoint; merely decoding a token does not verify its signature.

### Cloudflare Workers example
The introductory sentence says that a Worker behind Access still needs to validate the assertion JWT, without naming a `ctx.access` exception.

The example reads `Cf-Access-Jwt-Assertion`, rejects missing configuration or a missing token, and verifies the token using the team's issuer and the application's audience. Verification failure returns a forbidden response.

---
source_handle: shared-library-cf-sessions
fetched: 2026-10-09
source_url: https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/
provenance: source-direct
substrate_confidence: source-direct
---

# Cloudflare Access — Session management

## Summary

The page separates authentication session duration, administrative revocation, and behavior of expired sessions in browser subrequests.

## Anchored observations (paraphrased)

### Revoke user sessions
Administrative revocation terminates active sessions for a user or application. It does not prevent signing in again while the user remains permitted by the access policy.

### Log out as a user
The browser's Access authorization cookie is cleared immediately; previously issued tokens stop being accepted after 20–30 seconds. This end-user logout behavior is distinct from administrative revocation.

### AJAX requests
An expired token on a background request can fail without displaying a login page. Requests marked `X-Requested-With: XMLHttpRequest` receive an HTTP 401 response when the session expires, allowing an application to handle reauthentication.

### Global / application session duration
Global sessions range from fifteen minutes to one month, defaulting to twenty-four
hours; expiry requires another identity-provider authentication. Application session
duration ranges from immediate to one month, also defaulting to twenty-four hours.
A still-valid global session can permit renewal of an application session. The
Cloudflare One Client session, when configured, can override these durations.

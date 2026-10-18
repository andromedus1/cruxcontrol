---
source_handle: preservation-access-cors
fetched: 2026-10-09
source_url: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/cors/
provenance: source-direct
substrate_confidence: source-direct
---

# Cloudflare Access CORS

## Anchored observations

**Configure response to preflight requests / cookies:** Access can answer preflight OPTIONS requests; subsequent authenticated cross-origin requests require the application authorization cookie after login to the protected domain. The page specifically warns that Incognito mode blocks this cookie as a third-party cookie on cross-origin requests; it also records a Safari 13.1 cookie-format problem.

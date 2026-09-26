---
source_handle: shared-library-cf-paths
fetched: 2026-09-26
source_url: https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/
provenance: source-direct
substrate_confidence: source-direct
---

# Cloudflare Access — Application paths

## Summary

Access applications can target hostnames and paths, allowing different portions of a hostname to have different access rules.

## Anchored observations (paraphrased)

### Application paths
An application definition can include a domain, subdomain, and path. Coverage depends on the configured pattern; application paths are a security boundary, not just a UI routing choice.

### More-specific paths
When multiple Access applications overlap, the more-specific application takes precedence. Its policy is evaluated rather than inheriting the broader application's policy.

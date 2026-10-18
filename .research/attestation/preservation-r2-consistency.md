---
source_handle: preservation-r2-consistency
fetched: 2026-10-09
source_url: https://developers.cloudflare.com/r2/reference/consistency/
provenance: source-direct
substrate_confidence: source-direct
---

# R2 consistency

## Anchored observations

**Operations and consistency / caching:** The page documents strongly consistent read-after-write, metadata operations, deletion and object listing. Concurrent writes to one key use last-completing-write semantics. IAM changes can take time to propagate. Cached custom-domain reads relax observed consistency; Worker bindings and the S3 API access buckets directly.

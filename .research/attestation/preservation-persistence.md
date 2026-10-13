---
source_handle: preservation-persistence
fetched: 2026-10-09
source_url: https://web.dev/articles/persistent-storage
provenance: source-direct
substrate_confidence: source-direct
---

# Persistent storage

## Anchored observations

**Storage pressure / persistent storage:** The article describes origin eviction and a persistence request that protects against browser eviction, while users can still remove site data. The API returns a Boolean grant decision. Chromium evaluates engagement silently; installed or bookmarked sites are among the documented grant heuristics. It recommends requesting around a meaningful save interaction rather than at startup.

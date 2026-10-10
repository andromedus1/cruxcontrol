---
source_handle: preservation-lifecycle
fetched: 2026-10-09
source_url: https://developer.chrome.com/docs/web-platform/page-lifecycle-api
provenance: source-direct
substrate_confidence: source-direct
---

# Page Lifecycle API

## Anchored observations

**Frozen, discarded and developer recommendations:** Frozen pages suspend freezable tasks, including timers and fetch callbacks. A discarded page executes no JavaScript and receives no discard event. The hidden transition can be the last observable session event, especially on mobile. Termination and unload callbacks are unreliable.

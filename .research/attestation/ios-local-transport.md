---
source_handle: ios-local-transport
fetched: 2026-09-27
source_path: web/src/board-control/transport.ts
provenance: source-direct
substrate_confidence: source-direct
---

# CruxControl — BoardByteTransport

## Anchored observations (paraphrased)

### BoardByteTransport / BoardTransportState

The TypeScript interface separates capability/state observation, explicit selection/connection, reconnection, remembered devices, disconnect, byte-batch writes and force-disconnect. It contains no React rendering types. Error and lifecycle contracts accompany byte transport; a replacement must preserve those semantics.

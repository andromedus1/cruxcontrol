---
id: epic-ios-controller-bridge-native-ble
kind: feature
stage: drafting
tags: [ble]
parent: epic-ios-controller-bridge
depends_on: [ios-prototype-shell]
release_binding: null
gate_origin: null
research_refs:
  - .research/analysis/briefs/ios-shared-client.md
  - .research/analysis/landscapes/ios-board-client-prior-art.md
created: 2026-09-28
updated: 2026-09-28
---

# Native BLE transport for the isolated iOS prototype

## Brief

Continue the accepted Capacitor experiment with a native implementation of the
existing `BoardByteTransport` port and wire it into the isolated shell. Reuse
Fullride codecs, capacity/pacing policy, effects, existing connection controls and
local library. This feature delivers testable adapter preparation; compilation,
simulator behavior and real iPhone/board acceptance remain separate epic gates.
The parent retains its research gate for storage, authentication and distribution.

## Design decisions

Direction is inherited from Andrew's accepted prototype plan: foreground sessions,
existing screens, synthetic data, no production framework commitment. The scoped
question pass found no unresolved product choice requiring another confirmation.
Keep permission/discovery user initiated. Remember the selected board only for
the current app runtime; a new app session chooses again. On native backgrounding,
disconnect and require explicit reconnect after returning; do not automatically
resume effects. No background Bluetooth entitlement is added.

## Simplification opportunity

Use the existing byte-transport contract and runtime injection seam. Keep native
dependencies and bootstrap under `prototypes/ios`; avoid a second UI, browser API
emulation, a general transport framework, or changes to proven web transport code.

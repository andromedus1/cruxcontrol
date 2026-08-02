---
id: epic-route-creation-board-light-capacity-envelope-policy
kind: story
stage: implementing
tags: [perf, ble]
parent: epic-route-creation-board-light-capacity-envelope
depends_on: [epic-route-creation-board-light-capacity-envelope-physical-results]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Measured Capacity Policy and Adaptive Scheduler

## Brief

Implement Optimization 3 from the parent feature using the accepted physical trace.
Choose safe pacing/FPS from measured profiles, bound/coalesce frames, warn truthfully,
and add sparse delta frames only if the omitted-light semantic probe proves them valid.

## Implementation

See the parent feature's `## Optimization Plan`. No guessed capacity constant may be
labeled or treated as a physical result.

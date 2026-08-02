---
id: epic-route-creation-board-light-capacity-envelope-physical-results
kind: story
stage: implementing
tags: [perf, ble]
parent: epic-route-creation-board-light-capacity-envelope
depends_on: [epic-route-creation-board-light-capacity-envelope-instrumentation]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Physical Fullride Capacity Results

## Brief

Run Optimization 2 from the parent feature on Andrew's home Fullride 7×10 through the
Android PWA. Preserve the exported aggregate trace and manual pattern/stuck-LED outcomes
without device identity or raw climb data. This is an empirical checkpoint, not a code
implementation or a threshold to guess in CI.

## Implementation

See the parent feature's `## Optimization Plan`. Advance only when the physical matrix
and post-campaign one-light/clear recovery evidence are durably recorded.

## Observations in progress

- Android PWA static tests at 20 ms inter-chunk pacing: the operator reported clean
  pattern/clear behavior while increasing through 1, 20, 84, and 85 lights.
- At the UI's 168-light point, one section lit briefly, then extinguished when the
  later/right section appeared. The complete requested scene was never simultaneous.
- At 252 lights, the same split boundary repeated, with more lights in the later/right
  section. Testing stopped before larger or animated cases.
- This repeatable replacement pattern is evidence of packet/message assembly behavior,
  not yet evidence of an electrical simultaneous-LED ceiling. Because 85 passed while
  168 and 252 failed, API-level-2's 127-light packet boundary is the leading hypothesis;
  the UI now exposes 126/127/128 and nearby values for confirmation. The displayed API
  level, exact result timing, trace export, and boundary cases remain to be recorded.

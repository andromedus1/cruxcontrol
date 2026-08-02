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
- The diagnostic reports API level 2. At 127 lights, one packet / 260 framed bytes / 13
  BLE writes completed with the full pattern correct and p95 batch duration 2,280.7 ms at
  20 ms inter-chunk pacing. At 128, the first 127-light section was replaced by the final
  one-light packet. This establishes an exact reliable full-scene ceiling of 127 lights
  for the measured controller path; no case above 127 should be used by product policy.
- The initial result said “3 frames” because trace summaries included clear-before and
  clear-after batches. The diagnostic summary now counts only batches with a corresponding
  rendered scene event; the recorded 2,280.7 ms remains the scene p95 because it was the
  longest of those batches.
- A 20-light, 2 FPS animation at 20 ms inter-chunk pacing completed with the expected
  visible behavior and clean clear. Exact trace-derived effective FPS and latency remain
  pending because that case was not separately exported.
- Retrieved local trace `cruxcontrol-capacity-20-10fps.json` from the connected Android
  device without retaining it in the repository. It records API 2, 20 lights, one packet,
  46 framed bytes, three writes, requested 10 FPS, 20 ms pacing, and operator observation
  `correct`. The manually stopped 4.18-second run delivered 9 complete frames at 2.0266
  effective FPS with 24 missed due frames, p50 424.3 ms, p95/max 448.4 ms. Cancellation
  occurred during the next frame and recovery force-disconnected after one clear event;
  this is useful throughput evidence but not a full-duration animation pass.
- Together, the clean visible 2 FPS case and 10-FPS trace show that the present 20-light
  path is transport-limited to roughly 2 FPS at 20 ms pacing. Product policy must not
  present requested 10 FPS as delivered motion.

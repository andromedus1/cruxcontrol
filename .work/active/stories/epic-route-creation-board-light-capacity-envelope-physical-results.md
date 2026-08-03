---
id: epic-route-creation-board-light-capacity-envelope-physical-results
kind: story
stage: done
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
- Omitted-light semantics are resolved by the 128-light boundary case itself: the first
  API-2 packet visibly established 127 lights, then the final one-light packet extinguished
  those 127 and left only its own section. A later frame containing only changed lights
  therefore represents a replacement scene, not a delta; sparse-frame optimization is
  unsafe on this measured controller path. Every animation frame must resend the complete
  route + decoration + effect scene and remain at or below 127 lights.

## Accepted conservative profile

- **Controller path**: API 2 on the current Android/Web Bluetooth Fullride installation.
- **Static scene**: cap at one complete API-2 packet, 127 lights. The 127-light/20 ms case
  passed once at 260 framed bytes, 13 writes, and 2,280.7 ms p95; 128 failed exactly at
  the packet boundary. The product does not claim repeated-trial reliability or faster
  pacing beyond this observation.
- **Animation scene**: support only complete scenes of at most 20 total lights at 2 FPS
  and 20 ms pacing. One visual 2 FPS case passed. The exported 10 FPS request delivered
  9 complete frames over 4.18 seconds at 2.0266 effective FPS, p95/max 448.4 ms, proving
  the transport—not the requested clock—is the limiting cadence.
- **Scene semantics**: every packet/frame replaces the visible scene. Omitted placements
  do not persist, so delta/sparse updates are forbidden; route, decoration, and effect
  lights all consume the same complete-scene budget.
- **Recovery**: the clean 2 FPS case cleared correctly. The manually stopped 10 FPS trace
  force-disconnected after an incomplete recovery clear, so subsequent lighting must
  require the normal reconnect path rather than claiming an in-place recovery succeeded.

## Campaign closure

The remaining repeated static trials, pacing sweep, 84–305-light animation points, and
long confirmation runs were deliberately omitted. Above 127 cannot form one API-2 scene;
above 20 lacks a measured animation pass; and continuing after the forced-disconnect trace
would add hardware stress without changing the safe first policy. Those optimization
measurements are preserved as `idea-expanded-fullride-capacity-matrix` rather than being
invented or silently treated as passing.

This story is complete as an empirical checkpoint for a conservative product profile,
not as a claim that the board's maximum sustainable throughput has been found.

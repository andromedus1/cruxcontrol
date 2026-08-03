---
id: epic-route-creation-board-light-capacity-envelope-policy
kind: story
stage: done
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

## Implementation notes

- Execution capability: GPT-5.6 Codex, xhigh; the measured BLE policy crosses the
  controller queue, animation timing, and editor warning boundary, so it received a
  focused strong implementation pass.
- Review weight: standard from `.work/CONVENTIONS.md`; this child story advances directly
  to done and the parent feature owns the independent review boundary.
- Files changed: new `web/src/board-control/capacity-policy.ts`; controller pacing;
  editor lighting scheduler, cost/status presentation, focused tests, and current-state
  `docs/{SPEC,ARCHITECTURE}.md`.
- Tests added/removed: deterministic API-2 profile replay at 127/128 static lights and
  20/21 animation lights; latency downgrade/pause; runtime refusal without assignment
  mutation; measured two-FPS one-in-flight scheduling; and normal-write pacing. One stale
  six-FPS assertion was corrected to the accepted physical cadence; no coverage was
  removed.
- Simplification: the existing controller preview arbitration remains the only queue;
  the hook uses absolute due times and skips missed deadlines rather than introducing a
  second frame queue. One profile owns the 20 ms pacing value used by both policy and
  controller.
- Discrepancies from design: recent batch duration is measured around the existing
  controller preview promise rather than adding production trace events. The conservative
  policy drops from 2 FPS to 1 FPS above a 500 ms recent p95 and pauses above 1,000 ms.
  No API-3 profile is invented; its existing static path remains available and animation
  reports that capacity is unmeasured.
- Adjacent issues parked: none.

## Verification

- `npm test --workspace web -- --run` — all 67 files / 406 tests passed.
- `npm run --workspace web typecheck` — passed.
- `npm run --workspace web lint` — passed.
- `npm run --workspace web build` — passed, including the PWA precache build.

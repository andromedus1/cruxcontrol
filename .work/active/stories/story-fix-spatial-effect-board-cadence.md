---
id: story-fix-spatial-effect-board-cadence
kind: story
stage: done
tags: [bug, ui, ble]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Match spatial effect motion to the physical board cadence

## Symptom

Physical dogfooding found that the effects do start, but all spatial presets move much
too quickly in the screen preview for the board to reproduce legibly. The initial report
that they did not start was user error and is not part of this defect.

## Root cause

The board scheduler correctly caps API-2 playback at the measured two FPS, but the spatial
renderer uses a continuous phase and the preview samples it at ten FPS. Built-in recipes
also complete a whole-board cycle in only 4–9 seconds. A Snake therefore skips many holds
between the board's 500 ms complete-scene writes, while the faster preview misleadingly
shows intermediate poses the board will never receive.

## Fix approach

Quantize spatial recipe time to the measured 500 ms board frame, make the screen preview
show those same discrete poses, and retune built-in full-cycle durations for legible
hardware motion. Present the editor control as cycle time with a range that can represent
the slower board-safe presets.

## Regression test

`web/src/light-effects/spatial-frame.test.ts` proves that spatial output is held for a
complete 500 ms board frame and that traversal presets have board-legible default cycle
durations. Route-editor coverage proves the cycle-time control can represent those values.

## Implementation notes

- **Execution capability**: host-owned focused repair; the defect is bounded to shared
  spatial timing defaults, preview phase quantization, and the existing editor control.
- **Root cause confirmed**: Snake and Pac-Man completed approximately 305-placement paths
  in 8 and 7 seconds while API-2 can accept only one complete frame per 500 ms, causing
  roughly twenty-placement jumps. The 10 FPS preview displayed poses hardware never saw.
- **Fix**: spatial preview and hardware render from the same 500 ms held poses. Snake and
  Pac-Man now traverse in 120 seconds; Ocean/Matrix/Beach Ball/Pong use 30 seconds and
  Tie-dye/Birds use 45 seconds. The editor exposes a 5–180 second `Cycle time` control.
- **Regression evidence**: the new test failed on the old continuous renderer and short
  defaults, then passed after the repair. Focused spatial/editor tests pass (20 tests).
  Full suite passes (68 files, 422 tests), along with typecheck, lint, and PWA build.
- **Test integrity**: two pre-existing integration tests exceeded the global five-second
  timeout under full-suite contention while passing focused. Their explicit timeout was
  raised to ten seconds; behavior/assertions are unchanged, and the full rerun is green.
- **Bounded inline review**: approved. The diff addresses the measured cadence mismatch,
  preserves saved recipe semantics and capacity limits, and adds direct regression proof.
  Physical pacing remains the operator acceptance check.

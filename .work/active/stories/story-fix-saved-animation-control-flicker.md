---
id: story-fix-saved-animation-control-flicker
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

# Stabilize saved-climb animation controls

## Symptom

While a saved climb effect runs in the PWA, the primary button flashes between `Restart
animation` and `Previewing…` on every frame.

## Root cause

`ClimbDetail` gives transient controller `previewing` operations higher label/disabled
priority than the hook's stable `animationRunning` lifecycle. Each two-FPS complete-scene
write therefore leaks transport state into the user-facing action.

## Fix approach

Give animation lifecycle priority for action label, status, and availability, matching the
existing editor controls. Continue surfacing preview operations when no animation runs.

## Regression test

Climb-detail coverage holds a scheduled animation preview write in flight and proves the
primary action remains enabled and labelled `Restart animation`.

## Implementation notes

- **Execution capability**: host-owned focused UI-state repair at the shared saved-climb
  playback surface.
- **Root cause confirmed**: controller `operation: previewing` replaced the stable label
  and disabled the button during every two-FPS animation frame.
- **Fix**: `animationRunning` now wins label/status precedence, and in-flight animation
  previews do not disable restart. Non-animation preview operations retain existing copy.
  The status states that PWA playback requires CruxControl to remain foregrounded because
  hidden-page timers and Web Bluetooth activity cannot be made reliable by this web app.
- **Regression evidence**: the held-preview test reproduced `Previewing…` before the fix
  and now proves stable `Restart animation` behavior.
- **Verification**: 68 files / 426 tests, typecheck, zero-warning lint, and PWA build pass.
- **Bounded inline review**: approved. The change affects presentation/availability only;
  frame scheduling, cancellation, capacity, and board writes remain unchanged.

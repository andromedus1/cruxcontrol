---
id: story-fix-bird-flock-path-variance
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

# Vary Bird Flock and Snake movement paths

## Symptom

Physical dogfooding found that Bird Flock is recognizable, but every pass follows the
same horizontal line. Snake is recognizable but follows the same bottom-to-top row
serpentine on every circuit, spending too long near the bottom.

## Root cause

The bird recipe translates a V formation across `y = 0.65` on every cycle. Its saved seed
does not influence path altitude, slope, arc, or spread. Snake uses one definition-order
row serpentine without seed- or cycle-driven route choice.

## Fix approach

Derive a deterministic per-cycle flight profile from the saved seed and cycle index.
Vary entry/exit altitude, a bounded arc, and wing spread without changing target masks,
palette behavior, quiet time, direction, or the declared eight-light reserve. Give Snake
seeded vertical and diagonal weave traversals that rotate between circuits without
changing its direction control or seven-light reserve.

## Regression test

Spatial-frame coverage samples the same active phase over consecutive cycles and proves
distinct, deterministic Bird and Snake placement paths that remain within their footprints.

## Implementation notes

- **Execution capability**: host-owned focused procedural-motion repair in the pure spatial
  renderer; persistence and runtime contracts remain unchanged.
- **Root cause confirmed**: Bird used fixed `y = 0.65`; Snake used one bottom-up row
  serpentine. Neither incorporated seed/cycle data into its spatial path.
- **Fix**: Bird derives per-cycle entry/exit altitude, arc, and spread. Snake rotates a
  seed-offset sequence of ascending/descending vertical and two diagonal weaves.
- **Regression evidence**: both consecutive-cycle path tests failed against the repeated
  old paths, then proved at least three distinct deterministic paths across four cycles.
  Existing direction, quiet-interval, palette, target, and exhaustive footprint tests pass.
- **Verification**: 68 files / 428 tests, typecheck, zero-warning lint, and PWA build pass.
- **Bounded inline review**: approved. All variation is deterministic from saved seed and
  cycle index, so save/reload remains reproducible and capacity reservations do not change.

---
id: epic-route-creation-flashy-light-effect-demos
kind: feature
stage: drafting
tags: [ui, ble]
parent: epic-route-creation
depends_on: [epic-route-creation-animated-light-designs, epic-route-creation-kilter-screenshot-import, epic-route-creation-board-light-capacity-envelope]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Flashy Light-Effect Demonstrations

## Brief

After the saved light-effects foundation is complete, add a curated library of flashy
demo designs that can be previewed, edited, saved with a climb, and played on the board:

- an ocean tide lapping in and receding over sand, using blue, purple, teal, foam,
  and warm sand colors;
- a tie-dye rainbow spiral that rotates and continuously morphs through colors;
- a Matrix-inspired green-and-black falling-light effect;
- additional visually distinctive demonstrations that show off coordinated spatial
  animation on the Fullride, including sparse moving beach-ball and snake demonstrations.

These should build on the shared saved-effect/frame engine rather than becoming a
separate animation implementation. Applying a preset should target unused decorative
holds by default while allowing an explicit whole-board override. Presets remain
editable after application: palette, speed, direction, brightness, affected holds,
and layering can all be changed. A saved climb retains its saved preset/effect data
rather than changing unexpectedly when the built-in preset library evolves.

## Strategic decisions

- **Default scope**: presets protect climb holds and apply to unused decorative holds
  by default, with an explicit whole-board override.
- **Editability**: presets are editable recipes rather than fixed rendered frames.
- **Persistence**: saved climbs retain their effect configuration independently of
  later built-in preset changes.
- **Measured reservation**: every preset exposes a deterministic worst-case active-light
  reserve and intended FPS. Playback budgets route lights, static decoration, and the
  effect separately through the measured Fullride capacity policy; it never guesses a
  universal hold-count ceiling or silently drops lights to fit.
- **Independent targeting**: unused background holds can belong to an effect without
  becoming assigned climb holds. Sparse beach-ball and snake presets are the first simple
  physical demonstrations because their maximum lit footprint is small and predictable.

## Simplification opportunity

Express every demo through the existing saved effect groups and shared frame engine.
Do not introduce a second animation runtime, BLE scheduler, or preset-only persistence
format.

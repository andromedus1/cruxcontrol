---
id: epic-route-creation-flashy-light-effect-demos-frogger
kind: story
stage: done
tags: [ui, ble, data]
parent: epic-route-creation-flashy-light-effect-demos
depends_on: [epic-route-creation-flashy-light-effect-demos-game-recipes]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Add a Frogger background preset

## Brief

Add a capacity-bounded Frogger scene: a green frog hops across the board while red cars
and trucks travel up and down in lanes. The frog chooses a deterministic safer track near
each traffic lane so the scene reads as an attempted crossing rather than two unrelated
motions. Default to ten lights, protect route-role holds, and retain recipe/palette edits
through local drafts and portable playlists.

## Design decisions

- **Board choreography**: the frog crosses left-to-right while traffic travels vertically,
  matching the requested board composition and making both motions legible at 2 FPS.
- **Capacity**: reserve two green frog lights and up to eight red vehicle lights; lowering
  the footprint removes vehicles before removing the frog.
- **Persistence**: add a recipe-version-1 `frogger` discriminant with editable lane count.

## Acceptance criteria

- [x] Frog and traffic use distinct semantic palette slots, never exceed the saved reserve,
  avoid route-role holds, and render deterministic two-FPS poses.
- [x] The frog advances across the board and responds to nearby deterministic traffic.
- [x] Draft and portable codecs round-trip the Frogger recipe and reject invalid lanes.

## Implementation notes

The renderer reserves two nearest green frog placements, spends the remaining footprint
on alternating vertical traffic lanes, and selects the frog's next track from the largest
nearby traffic clearance. Palette slots retain frog/vehicle roles after hardware color
quantization and protected-role remapping.

## Verification

Spatial renderer and both persistence codecs have focused coverage. The full 442-test
suite, typecheck, lint, and production PWA build pass.

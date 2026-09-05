---
id: epic-build-effects-hardening-seamless-loops-review-fixes
kind: story
stage: implementing
tags: [ui, ble, tests]
parent: epic-build-effects-hardening-seamless-loops
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
---

# Resolve verified v2 actor and clear-lifecycle review findings

## Brief

Implement the accepted named blocker set in the parent review record. Reverse offsets
must follow travel direction; Pac-Man palette0 is protagonist and palette1 ghost;
Pong's active paddle meets the ball at each impact. Direct explicit controller clears
cancel scheduled playback while intentionally empty preview frames remain valid.

## Verification

Add v2 actor/trail/color/impact and adjacent loop-join tests; direct-clear test must
prove animation is running on the measured API-2 mock before clearing, then prove no
later write. Preserve exact v1 fixtures and all existing data/role/capacity guarantees.
Update SPEC's v1/v2 wording via the bounded documentation owner. Root integrates with
bee renderer additions without concurrent writes, then runs meaningful targeted and
full verification. Child closes directly on verification; parent standard review needs
no second independent pass.

## Named fixes and focused evidence

- Explicit controller `clearing` cancels synchronously in the state subscription;
  measured API-2 lifecycle tests prove playback was active and no later write occurs.
- Reverse path offsets follow signed travel. Pac-Man uses fixed protagonist/ghost
  palette slots. Pong interpolates each paddle between its own successive impacts.
- Actual last-two/first-two frames exposed rank-driven Ocean hue changes and Spiral
  point jumps. Both now project stable parametric samples: three enveloped tide swells
  with periodic foam, and three spiral rotations with radial breathing. Palette offsets
  belong to samples, not changing score ranks. Removed the unused rank-selection helper.
- Focused actor, thematic neighbor-frame, Pong impact and Frogger trajectory suite:
  24 tests pass. These include bird/rain off-board gaps, fixed pulsing star anchors,
  beach-ball cluster continuity, reverse trails and explicit protagonist colors.
- Foundation wording corrected in ca91b6e. Integrated checks pending before closure.

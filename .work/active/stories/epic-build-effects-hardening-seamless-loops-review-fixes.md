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

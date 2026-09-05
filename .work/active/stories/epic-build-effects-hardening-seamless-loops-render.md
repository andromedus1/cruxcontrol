---
id: epic-build-effects-hardening-seamless-loops-render
kind: story
stage: done
tags: [ui, ble]
parent: epic-build-effects-hardening-seamless-loops
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
---

# Closed version-2 thematic renderer

## Brief

Implement feature Unit 1 and the v2 type boundary; capture exact v1 fixtures, prepare immutable geometry, implement all ten closed themed trajectories and shape behavior. Verify continuity through actual join frames, not just equal modulo endpoints.

## Implementation

Parent feature owns exact contracts, implementation units, tests, mockups and risks.
One feature owner implements these sequential checkpoints. This child closes on green
verification; independent review happens at feature level.

## Implementation notes
- Execution capability: GPT-5.6 Luna at xhigh, as selected by the authorized autopilot for this multi-module feature.
- Review weight: standard (project convention).
- Files changed: `web/src/light-effects/spatial-frame.ts`, `spatial-frame-v1.ts`, `spatial-frame-v2.ts`, `spatial-geometry.ts`, `spatial-frame.test.ts`, `spatial-frame-v2.test.ts`, `web/src/board-renderer/types.ts`, and `web/src/light-effects/preset-library.ts`.
- Tests added/removed: v2 loop tests cover all presets × seeds 0/7/42 × default/custom periods, two-cycle joins, exact prepared graph adjacency across every Snake/Pac-Man frame including wrap, negative elapsed time, intensity zero, cache identity, shape controls and deterministic output; existing assertions now explicitly exercise recipeVersion 1 compatibility fixtures.
- Simplification: shared normalized geometry and a bounded DFS path replace per-cycle reseeding for v2; the old renderer remains isolated behind the version dispatcher.
- Discrepancies from design: v2 trajectory helpers keep the public renderer narrow; exact graph placement IDs are carried through Snake/Pac-Man projection so masked nodes are omitted rather than relocated.
- Adjacent issues parked: none.

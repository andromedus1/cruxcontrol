---
id: epic-route-creation-flashy-light-effect-demos-spatial-engine
kind: story
stage: done
tags: [ui, ble]
parent: epic-route-creation-flashy-light-effect-demos
depends_on: [epic-route-creation-flashy-light-effect-demos-contracts]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Spatial effect engine and headline presets

Implement Unit 2 from the parent feature: two-pass composition, capacity reserve proof,
and Ocean, Tie-dye, Matrix, Snake, and Beach Ball recipes.

## Implementation notes

- Execution capability: highest available; deterministic geometry and physical capacity invariants are safety-sensitive.
- Review weight: standard (caller).
- Files changed: shared frame composition, spatial renderer, preset library, capacity planner, focused tests.
- Tests added/removed: exhaustive 41-sample periods for all presets plus masking, layering, semantic color, determinism, and reserve tests; no tests removed.
- Simplification: every recipe shares one scoring/selection renderer and one conservative reserve planner.
- Discrepancies from design: game recipe cases landed in the same pure renderer/preset table to avoid a temporary second registry; their checkpoint is verified separately.
- Adjacent issues parked: none.
- Verification: 19 focused tests and typecheck passed.

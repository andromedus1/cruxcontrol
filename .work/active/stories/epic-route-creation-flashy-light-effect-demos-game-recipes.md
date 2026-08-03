---
id: epic-route-creation-flashy-light-effect-demos-game-recipes
kind: story
stage: done
tags: [ui, ble]
parent: epic-route-creation-flashy-light-effect-demos
depends_on: [epic-route-creation-flashy-light-effect-demos-spatial-engine]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Spatial game and ambient recipes

Implement Unit 3 from the parent feature: Pac-Man, Pong, and Bird Flock recipes through
the shared deterministic spatial engine.

## Implementation notes

- Execution capability: highest available; game motion shares the capacity-critical renderer.
- Review weight: standard (caller).
- Files changed: shared preset library/renderer and spatial-frame tests (landed with the dependency checkpoint for atomic engine coherence).
- Tests added/removed: Pac-Man/Pong direction boundaries, bird quiet interval, seeded determinism, exhaustive footprint and semantic-palette proof; no tests removed.
- Simplification: games are ordinary recipe variants, not a party-mode runtime.
- Discrepancies from design: implementation was committed with the shared engine because separating the exhaustive union switch and registry would leave a knowingly incomplete intermediate contract.
- Adjacent issues parked: none.
- Verification: 19 focused frame/spatial tests and typecheck passed.

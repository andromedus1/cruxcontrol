---
id: epic-route-creation-animated-light-designs-engine
kind: story
stage: done
tags: [ui, ble]
parent: epic-route-creation-animated-light-designs
depends_on: [epic-route-creation-animated-light-designs-persistence]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Deterministic light-effect frame engine

Implement Unit 2 from the parent feature: pure deterministic Pulse, Color Cycle,
Wave, Twinkle, and Alternate frame generation.

## Implementation notes

- Execution capability: GPT-5.6 high; deterministic color math and effect semantics are the shared preview/hardware boundary.
- Review weight: standard (project default); not applicable to this child-story checkpoint.
- Files changed: `web/src/light-effects/contracts.ts`, `web/src/light-effects/frame.ts`, and `web/src/light-effects/frame.test.ts`.
- Tests added/removed: eight deterministic frame tests cover all five effects, exact boundaries/wrap, order, static holds, palettes, intensity, invalid elapsed time, and missing groups; none removed.
- Simplification: one pure frame generator owns color interpolation, brightness modulation, placement phasing, and output ordering.
- Discrepancies from design: twinkle uses a stable placement-ID phase instead of randomness so repeated timestamps are exactly reproducible.
- Adjacent issues parked: none.
- Verification: focused frame tests (8 tests) and TypeScript typecheck pass.

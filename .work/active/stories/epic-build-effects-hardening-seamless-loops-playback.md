---
id: epic-build-effects-hardening-seamless-loops-playback
kind: story
stage: done
tags: [ui, ble]
parent: epic-build-effects-hardening-seamless-loops
depends_on: [epic-build-effects-hardening-seamless-loops-render]
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
---

# Color-safe efficient spatial playback

## Brief

Implement feature Unit 2: API-2-aware final color guard, black semantics, bounded prepared/held-frame reuse, diagnostic computation evidence and empty-frame playback lifecycle repair.

## Implementation

Parent feature owns exact contracts, implementation units, tests, mockups and risks.
One feature owner implements these sequential checkpoints. This child closes on green
verification; independent review happens at feature level.

## Implementation notes
- Execution capability: GPT-5.6 Luna at xhigh, as selected by the authorized autopilot for this multi-module feature.
- Review weight: standard (project convention).
- Files changed: `web/src/light-effects/spatial-colors.ts`, `spatial-colors.test.ts`, `web/src/light-effects/spatial-frame-v2.ts`, `web/src/route-editor/use-editor-lighting.ts`, `web/src/route-editor/use-editor-lighting.test.tsx`, and `web/src/light-effects/spatial-frame-v2.test.ts`; Frogger planning helpers are integrated from root-owned commit `1c66bf2`.
- Tests added/removed: exhaustive 256-byte API-2 color protection, black semantics, cache identity/invalidation, graph preparation, planned Frogger crossing/traffic safety, per-member bird clipping, and empty birds playback coverage; existing latest-frame, capacity, visibility, disconnect, stop and unmount checks remain green.
- Simplification: v2 output caches one held scene per immutable group and reuses definition geometry; assignment effects and mixed animation frames remain uncached.
- Discrepancies from design: color protection is exact encoded-byte separation, as specified; it does not claim perceptual contrast.
- Diagnostic evidence: on macOS 26.3 arm64, Node v25.9.0, 1,000 repeated held-frame calls with a shared empty assignment array measured cold/warm (ms per call): Snake 21.596/0.000387, Pac-Man 1.664/0.000142, Ocean control 0.324/0.000135. The first Snake call includes path preparation; geometry is shared thereafter. These are local computation measurements only.
- Adjacent issues parked: none.

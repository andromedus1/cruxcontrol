---
id: epic-route-creation-animated-light-designs-editor-runtime
kind: story
stage: done
tags: [ui, ble]
parent: epic-route-creation-animated-light-designs
depends_on: [epic-route-creation-animated-light-designs-engine]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Author and play saved effects

Implement Units 3 and 4 from the parent feature: effect editing and painting,
simplified Hold Tool/autosave UI, shared preview, and bounded BLE playback.

## Implementation notes

- Execution capability: GPT-5.6 high; this story spans reducer semantics, responsive UI, shared SVG frames, and asynchronous BLE lifecycle behavior.
- Review weight: standard (project default); not applicable to this child-story checkpoint.
- Files changed: route-editor tool/reducer/workspace/effects panel/styles/hooks/tests, renderer scene override/tests, animation clock/tests, and affected app integration tests.
- Tests added/removed: effect group authoring and painting, simplified toolbar/autosave behavior, shared renderer frames, animation cadence, slow-write bounding, stop/static settlement, and clear/disconnect/visibility/unmount cancellation; stale direct-tool/manual-save assertions were rewritten, none removed.
- Simplification: removed four direct semantic role controls and the manual Save now action; Cycle and autosave remain authoritative.
- Discrepancies from design: mockup generation was skipped because the effects section extends the already approved editor with existing controls/patterns; hardware cadence is conservatively scheduled after each completed preview write, so slow writes reduce frame rate instead of accumulating work.
- Adjacent issues parked: none.
- Verification: complete Vitest suite (256 tests), ESLint, TypeScript, and production Vite/PWA build pass. Pixel 8 physical animation confirmation remains a feature-level manual acceptance check.

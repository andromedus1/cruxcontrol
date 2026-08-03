---
id: epic-route-creation-flashy-light-effect-demos-editor-runtime
kind: story
stage: done
tags: [ui, ble]
parent: epic-route-creation-flashy-light-effect-demos
depends_on: [epic-route-creation-flashy-light-effect-demos-game-recipes]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Spatial preset editor and measured playback

Implement Unit 4 from the parent feature: editable saved presets, independent target
painting/layering, capacity breakdown, and safe complete-scene board playback.

## Implementation notes

- Execution capability: highest available; mobile authoring and BLE preflight cross persistence, rendering, and hardware safety.
- Review weight: standard (caller).
- Files changed: effect panel/workspace/CSS, reducer/tools, lighting hook/tests, codec parameter validation, foundation docs.
- Tests added/removed: spatial preset authoring/target painting and zero-fake-assignment component coverage; pre-first-write 21-light refusal; stale schema fixtures updated; no tests removed.
- Simplification: existing panel, reducer, autosave, renderer, and controller scheduler were extended; no new screen, runtime, or persistence authority.
- Discrepancies from design: typed recipe editing uses one context-sensitive Direction and Shape control rather than eight separate forms. Physical Snake/Beach Ball/Pong observation remains an operator checkpoint; the production build is open on the connected Android phone.
- Adjacent issues parked: none.
- Verification: 420 tests, typecheck, lint, production/PWA build, and Playwright phone smoke passed.

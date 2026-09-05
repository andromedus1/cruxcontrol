---
id: epic-build-effects-hardening-seamless-loops-adoption
kind: story
stage: done
tags: [ui, ble]
parent: epic-build-effects-hardening-seamless-loops
depends_on: [epic-build-effects-hardening-seamless-loops-playback]
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
---

# Explicit saved-loop upgrades and persistence

## Brief

Implement feature Unit 3: both-version codecs, new defaults, explicit in-panel adoption with shown longer timing, and persisted/portable/browser regression coverage. Preserve authored IDs and all unrelated settings.

## Implementation

Parent feature owns exact contracts, implementation units, tests, mockups and risks.
One feature owner implements these sequential checkpoints. This child closes on green
verification; independent review happens at feature level.

## Implementation notes
- Execution capability: GPT-5.6 Luna at xhigh, as selected by the authorized autopilot for this multi-module feature.
- Review weight: standard (project convention).
- Files changed: `web/src/board-renderer/types.ts`, `web/src/light-effects/preset-library.ts`, `web/src/drafts/codec.ts`, `web/src/playlists/portable-codec.ts`, `web/src/route-editor/LightEffectsPanel.tsx`, `web/src/route-editor/RouteEditorWorkspace.test.tsx`, `web/src/drafts/codec.test.ts`, and `web/src/playlists/portable-codec.test.ts`.
- Tests added/removed: stored and portable round trips cover recipeVersion 1 and 2, future embedded versions fail explicitly, and the editor test verifies the displayed 150-second adoption plus dirty autosave state.
- Simplification: adoption dispatches the existing `update-effect-group` action and keeps current draft/playlist schema versions; no read-time migration or duplicate storage path was added.
- Discrepancies from design: the panel uses existing effect controls and inline status text rather than introducing a modal.
- Adjacent issues parked: none.

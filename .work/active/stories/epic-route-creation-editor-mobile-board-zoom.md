---
id: epic-route-creation-editor-mobile-board-zoom
kind: story
stage: done
parent: epic-route-creation-editor-workspace
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
tags: [ui]
---

# Mobile climb-editor board navigation

## Brief

On a phone, the interactive board in the climb editor is initially too zoomed in to
be useful. Start with the whole board fitted, then support pinch-to-zoom and panning
inside the editor so the user can inspect and select individual holds. Provide compact
Fit, zoom-out, and zoom-in controls as a visible and keyboard-accessible equivalent.

The behavior is editor-only; read-only climb board renderings retain their existing
presentation. Zoom stays within the renderer's supported 1×–3× range and must not
accidentally select a hold after a pinch or drag.

## Simplification opportunity

Remove the viewport-media-query state and hard-coded compact 2.5× scale. One explicit
editor zoom state replaces that indirect responsive behavior.

## Verification

- The editor initially renders the whole board at 1× on phone and desktop.
- Pinching changes scale; dragging pans a zoomed board.
- Fit and zoom buttons expose the same behavior without touch gestures.
- A completed gesture does not activate a hold.
- Existing keyboard hold selection remains intact.

## Implementation evidence

- Replaced the compact-screen 2.5× default with a fitted 1× editor view.
- Added editor-scoped 1×–3× pinch zoom, drag panning, gesture click suppression,
  and accessible Fit/−/+ controls.
- Added interaction coverage; `npm test` passes 228 tests, with lint, typecheck, and
  production build green.
- Verified on the attached Pixel 8: fit, pinch, pan, hold selection, and reset all
  behave as intended.

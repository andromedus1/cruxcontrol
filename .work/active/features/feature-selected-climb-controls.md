---
id: feature-selected-climb-controls
kind: feature
stage: drafting
tags: [ui, ble]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-12
updated: 2026-09-12
---

# Selected climb lighting and controls

## Brief

Light the selected climb automatically in the library, playlist play-through, and
editor. Remove the Live Preview opt-in and required Light action. Make board
connection and editing available throughout climb navigation, including playlists.

## Design decisions

- The user explicitly wants selection and edits to drive connected board lighting,
  including saved effects. Connection still starts from the existing Connect gesture.
- Reuse the existing detail, editor, connection bar, and playlist action patterns.
  No new surface or visual structure; mocks are skipped under AGENTS.md's reuse exception.
- Keep capacity checks, complete-scene serialization, errors, and foreground-only
  animation. Explicit stop remains stopped until a new scene, reconnect, or restart.
- Editing a playlist climb returns to the same list and play-through position.
- No new persistence, external API, or research dependency. Existing controller,
  editor, and playlist contracts provide the grounding. No unanswered directional choices.

## Simplification

Remove the opt-in preview state and duplicate static preview path. One shared
lighting hook handles selection and edits for both detail and editor.

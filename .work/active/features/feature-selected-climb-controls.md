---
id: feature-selected-climb-controls
kind: feature
stage: implementing
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

## Architectural choice

Use `useEditorLighting` as the shared automatic scene owner. A top-level selection
service would duplicate editor state; independent per-screen effects would duplicate
capacity and lifecycle policy. The existing controller already serializes and coalesces
preview writes, so reuse that boundary for automatic complete scenes.

## Implementation units

1. `web/src/route-editor/use-editor-lighting.ts`: debounce scene changes, send on
   connection, start saved effects, and invalidate stale async playback starts on
   scene changes, stop, disconnect, visibility loss, and unmount. This is the trickiest
   unit: an old in-flight write must never restart an animation after navigation.
2. `web/src/climb-browser/ClimbDetail.tsx` and
   `web/src/route-editor/RouteEditorWorkspace.tsx`: automatic lighting, existing
   `BoardControlBar`, status and retry/restart/stop controls; no Live Preview checkbox
   or normal Light action. Key detail by climb identity for a fresh selection lifetime.
3. `web/src/playlists/PlaylistLibrary.tsx`, `PlaylistPlayThrough.tsx`, and
   `web/src/app/CruxControlWorkspace.tsx`: pass typed local-draft edit callbacks,
   connection controls for management/unavailable entries, and ephemeral return
   context `{ playlistId: PlaylistId; entryKey?: string }` for editor round trips.

## Acceptance criteria

- [ ] Selecting a saved climb, advancing a playlist, or editing holds lights the
  latest scene automatically; a disconnected selection never launches a chooser.
- [ ] Connecting with a selection sends that scene and starts any supported effects.
- [ ] Rapid changes coalesce; stale async work cannot restart previous playback.
- [ ] Stop/clear, hidden documents, disconnect, and unmount cancel playback;
  capacity rejection stays visible without automatic retry loops.
- [ ] Edit is available for compatible local climbs in detail, playlist rows, and
  play-through; Back returns to the same list/entry. Unavailable entries stay guarded.
- [ ] Connect is accessible in library/detail, editor, playlist management, and
  play-through, including unavailable entries.
- [ ] Required lint, typecheck, unit/integration, browser, build, and PR CI checks pass.

## Testing and risks

Use real controller/mock transport tests for automatic writes, connection transitions,
effect playback, capacity, and delayed-write cancellation. Exercise edit and return
through the real workspace/repositories and a mobile browser playlist flow. The main
risk is async write completion crossing a selection lifetime; generation invalidation
and regression tests guard it. Preserve existing foreground and capacity constraints.

## Execution

One inline owner; no child stories because these tightly related seams fit one stride.
Execution capability: current Codex agent. Review weight: standard (project convention),
one independent feature review after integrated verification.

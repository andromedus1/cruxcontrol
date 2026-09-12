---
id: feature-selected-climb-controls
kind: feature
stage: review
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

## Implementation notes

- Shared lighting now schedules connected scene changes after 180 ms and uses the
  controller's serialized latest-scene preview path for static and animated scenes.
  Semantic scene comparison avoids restarting effects on repository refreshes.
- Generation guards prevent a delayed first write from restarting an animation
  after selection changes, visibility loss, clearing, or unmount.
- Connection bars appear in library, detail, editor, list management, and unavailable
  play-through entries. The initial Connect remains a direct gesture.
- Playlist rows and play-through edit the original local climb; ephemeral return
  context preserves the selected list and entry across editor autosave and Back.
- Removed Live Preview state/UI/CSS and the duplicate static-only preview path.
  Retry, restart, stop, capacity validation, and disconnected browsing remain.
- Tests updated for automatic selection semantics and named connection/list status
  regions. Added real-controller delayed-write regressions and workspace edit/return
  integration; expanded the phone browser playlist flow to edit, save, and return.
- Discrepancies: normal lighting no longer connects inside the hook. The existing
  connection control owns pairing; its state transition triggers the selected scene.
- Adjacent production issues: none. Obsolete tests were repaired in-session.

## Verification

- `npm test`: 84 files, 636 tests passed.
- `npm run build`: TypeScript and production PWA build passed.
- `npm run lint`, `git diff --check`: passed.
- Production browser suite: 11/12 initially passed; one stale mobile control
  assertion repaired, then all four local-route-editor browser workflows passed.
  Combined results cover all 12 browser workflows, including mobile playlist editing.
- Physical Bluetooth hardware awaits the user's dogfooding session.
- PR CI and standard independent review are pending. Claude peer authentication
  expired; review uses the allowed same-harness fresh-context fallback.

## Review findings and fixes

Standard same-harness fresh-context review (GPT-5.6 Sol) found two material issues
and one stale message. All are accepted and handled in this feature:

- A cancelled animation tick could pollute the next animation's timing samples.
  Timing history now updates only inside the live generation guard. The new delayed
  tick → animated scene change regression was confirmed red against the pre-fix code.
- Automatic playback could write between capacity diagnostic frames. The controller
  now publishes a `diagnosing` operation for the full case lifetime, cancels lighting
  owner timers synchronously, supersedes preview requests, and rejects explicit
  writes during that lifetime. A real-controller test covers animation cancellation,
  edits during the case, rejected writes, and the final clear with no later relight.
- The diagnostic panel now names Connect, disables Start during board operations,
  and reports a rejected start instead of leaving an unhandled promise.
- CI exposed a browser-platform assumption in the mobile assertion: Web Bluetooth
  availability differs between local macOS and Linux Chromium. The responsive test
  now asserts the named board connection status; pairing behavior remains covered
  through the real-controller/workspace tests.

Closure requires fix verification and green CI, with no second independent pass
under the project's standard review weight.

Fix verification: 638 tests across 84 files, all 12 production browser workflows,
lint, TypeScript, and production build pass. Both material findings are resolved;
the same-climb slow-frame test was confirmed failing before its fix. Final PR CI
remains the completion gate.

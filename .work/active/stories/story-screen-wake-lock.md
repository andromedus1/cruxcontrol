---
id: story-screen-wake-lock
kind: story
stage: implementing
tags: [ui]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
---

# Keep the screen awake during a CruxControl session

## Brief

Andrew wants an opt-in control to prevent automatic screen timeout from stopping
animation playback. Provide a session-scoped, default-off “Keep screen awake”
checkbox, available throughout the running app, with actual acquisition status.
Preserve all authored climbs, playlists, identities and effect recipes.

## Design and acceptance

- Use the native Screen Wake Lock API; no media tricks, dependencies or storage writes.
- Mount one control at the application workspace boundary so navigation between editor,
  library and playlists preserves the current session's choice.
- Reuse existing checkbox/button/token styling. This is a minor existing-pattern UI
  extension; the project's mockup exception applies.
- Show off, requesting, held, suspended/released and denied/unsupported states honestly.
  Explicit retry is available after denial or system release; never retry in a busy loop.
- Acquire only when opted in and visible. Release on disable, visibility loss and
  unmount; dispose a late acquisition after its request becomes obsolete.
- Reacquire when the document becomes visible if the session choice is still enabled.
  Do not automatically resume BLE animation or change the existing stop-on-hide policy.
- Tell the user that CruxControl must remain open/visible and screen-awake uses more battery.
- Unsupported browsers stay fully usable, with a disabled control and clear explanation.
- Verify default off, acquisition, manual release, system release/retry, rejection,
  visibility transitions, pending-request races, cleanup, and session continuity through
  app navigation. Run the application checks and browser scenarios.

## Grounding

The existing `useEditorLighting` stops playback when `document.hidden` becomes true.
A screen lock prevents automatic dim/lock only while the document is active; it is not
background execution and cannot override manual screen locking or OS power policy.

- [MDN Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
- [Chrome Screen Wake Lock guide](https://developer.chrome.com/docs/capabilities/web-apis/wake-lock)

## Simplification opportunity

One app-owned lock lifecycle avoids duplicating acquisition across editor and playlist
playback. Keep wake-lock state separate from saved climbs and board transport.

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

## Implementation notes

- Execution capability: inline owner; focused browser lifecycle with no domain/storage changes.
- Review weight: standard from `.work/CONVENTIONS.md`; bounded standalone-story review.
- `ScreenAwakeControl.tsx` owns one session checkbox, native lock, request generation,
  actual status and explicit retry. `App.tsx` keeps it mounted across workspace changes.
- Reused existing tokens, checkbox and button patterns; CSS adapts to narrow widths.
- Added nine unit cases covering acquire/release, system release, denial/retry,
  visibility recovery, stale pending requests, unmount, already-released responses,
  and unsupported clients. Added one browser scenario for navigation continuity and
  saving/reloading a climb while using the toggle.
- README documents the capability and limits. The documentation-update skill's
  bounded edit agent verified existing foundation foreground assertions remain true.
- No dependencies added, storage accessed, schemas migrated, or animation behavior changed.
- Simplification: one mounted owner, no duplicate lock acquisition per playback surface.
- Adjacent review improvements and longer seamless loops are captured in
  `epic-build-effects-hardening`, rather than folded into this control.

## Verification

- 452 tests in 69 Vitest files passed.
- ESLint and production build (including TypeScript) passed.
- All six Playwright Chromium scenarios passed against the production build.
- Native headless Chromium exposed the API but refused acquisition; the UI truthfully
  showed that the screen can sleep and offered retry. Mocked acquisition/lifecycle tests
  passed; screen-timeout prevention has not been validated on Andrew's physical phone.
- Phone (390×844) and desktop (1440×900) screenshots inspected; phone has no horizontal overflow.
- `git diff --check` passed.
- PR/remote CI unavailable: `gh repo view` cannot resolve configured origin
  `andromedus1/cruxcontrol`. No deployment performed.

## Review (2026-09-05)

**Verdict**: Block — local implementation review passed; required PR/CI delivery is unavailable.

**Blockers**: GitHub cannot resolve the configured repository, preventing a pull request
and required remote checks. Restore access or correct the remote before completing delivery.

**Notes**: Bounded inline standalone-story review at standard weight. Reviewed opt-in
behavior, truthful held/requested distinction, concurrent pending requests, visibility
and unmount cleanup, cross-view session ownership, browser denial, accessibility and
data preservation. No code blockers found. No auth/network/storage boundary is introduced.
Existing animation cancellation remains intact. Local tests/build/lint and browser
validation passed as recorded above; physical phone acceptance remains unverified.
Keep this story active until the PR/CI requirement is met. Verify those checks and close
administratively; another independent review is not required for an unchanged patch.

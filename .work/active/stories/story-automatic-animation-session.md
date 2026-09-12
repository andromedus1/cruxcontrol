---
id: story-automatic-animation-session
kind: story
stage: done
tags: [ui, ble]
parent: null
depends_on: [feature-selected-climb-controls]
release_binding: null
gate_origin: null
created: 2026-09-12
updated: 2026-09-12
---

# Keep animation automatic without manual playback controls

## Brief

Andrew considers Stop animation and Restart animation unnecessary now that the
selected climb lights automatically. Remove them from viewer and editor, showing
Retry lighting only for a blocked or failed scene. Automatic lighting should
resume the selected scene when the app returns to the foreground, since there
will no longer be a normal restart button after visibility pauses playback.

## Design

- Remove normal playback buttons and the unused stop-and-settle hook command.
- Preserve automatic scene selection, debounce, capacity guards, single-frame
  replacement, teardown cancellation, and explicit Bluetooth connection.
- Cancel on hiding; on becoming visible, relight the selected scene through the
  same guarded lightDraft path. Never initiate Bluetooth pairing automatically.
- Retain explicit recovery for a lighting error; a running animation with an
  informational capacity warning does not need a restart control.

## Simplification opportunity

Delete the unused manual stop path and tests whose only contract was that path.
Keep lifecycle and transport tests that protect cancellation and resumption.

## Mockups

Skipped: removal of redundant buttons from existing components under the
project's small-UI-change exception.

## Acceptance and verification

- Normal editor and climb details have no Stop/Restart animation buttons.
- Failed or blocked lighting can still be retried.
- Visibility loss produces no further writes; returning to the foreground
  resumes the current scene while connected, through existing capacity guards.
- Retain real cancellation, reconnect, capacity, and empty-frame coverage.

## Implementation notes

- Execution capability: inline, one existing lighting hook and its two UI callers.
- Review weight: standard; bounded standalone review.
- Dependency is merged/archived. No library records or schema are modified.

## Verification results

- Updated visibility contract failed against the hidden-only implementation,
  then passed after guarded automatic foreground relighting was added.
- Lighting-hook lifecycle/transport/capacity tests pass. A component test verifies
  an actual rejected scene exposes Retry lighting and successful retry removes it.
- Full unit/integration suite: 636 tests passed before adding the retry case;
  the final six ClimbDetail tests passed afterward. All 12 browser workflows passed.
- Removed obsolete manual-stop/static-settle and restart-button-busy assertions;
  retained empty animation frame and teardown/visibility/clear cancellation tests.
- README, SPEC, and ARCHITECTURE were updated. Independent focused documentation
  review found no issues; all 15 local links and generated index lint passed.

## Review (2026-09-12)

**Verdict**: Approve.

**Blockers**: none.

**Notes**: Bounded inline standalone-story review, standard weight; no independent
code-review lane required. Reviewed foreground relighting through the existing guard/queue/capacity path, hidden-page cancellation, explicit pairing, stale-write sequence guards, diagnostics admission, and error-only recovery UI. Removed unused stop code and obsolete tests. Current scene data and storage are unchanged.

## Completion

Required CI passed on reviewed head `7623f0c`: lint, typecheck, unit/integration
tests, production build, and all browser workflows. Run:
https://github.com/andromedus1/cruxcontrol/actions/runs/34714635797

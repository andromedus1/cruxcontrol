---
id: story-playlist-save-status-race
kind: story
stage: done
parent: epic-build-effects-hardening-safe-updates
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
tags: [ui, tests]
---

# Preserve playlist save confirmation across refresh

## Brief

Full integrated unit run at de09b41: PlaylistLibrary metadata save completed but the
Saved status was blank. The selected-record hydration effect resets status whenever
name/notes change, racing the successful mutation status after refreshed props arrive.
Captured in /tmp/cruxcontrol-final-unit.log; the native PWA browser scenario also relies
on this real save-completion signal. Preserve the confirmation across metadata refresh
and clear it when intentionally selecting another list.

## Design and acceptance

Remove status clearing from data hydration, which owns only the form values. Clear
the old status in the explicit list-selection action. A test holds parent propagation
until after save completion, then supplies the updated record and verifies confirmation
persists; selecting another list clears it. Existing mutation status/errors remain.
No storage, update-admission, API or visual-structure changes; existing controls apply.
Simplification: remove unrelated status side effect from form hydration. Child closes
on meaningful verification without its own independent review.

## Implementation notes

- Execution capability: Luna xhigh, selected for the parent feature's persistence and
  update-safety risk.
- Review weight: standard, inherited from the parent feature; child closes directly on
  meaningful verification.
- Files changed: `web/src/playlists/PlaylistLibrary.tsx` and its focused test, plus this
  story record.
- Tests added: delayed parent-propagation regression that preserves `Saved` after the
  updated record hydrates and clears it when another list is selected.
- Simplification: form hydration now owns only `name` and `notes`; explicit list
  selection owns status reset.
- Discrepancies from design: none.
- Adjacent issues parked: none.
- Verification: the new assertion reproduced the pre-fix blank status; focused playlist
  coverage passed 15 tests, with TypeScript and ESLint passing for the owned files.

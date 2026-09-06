---
id: story-playlist-save-status-race
kind: story
stage: implementing
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

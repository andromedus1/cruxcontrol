---
id: epic-playlists-consume-cancelled-import-fragment
kind: story
stage: done
tags: [ui]
parent: epic-playlists
depends_on: [epic-playlists-portable-sharing]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Consume a canceled startup import fragment

## Verified bug

Canceling a startup `#playlist=` import cleared the browser hash through
`history.replaceState`, but the workspace did not rerender and continued passing the
original fragment prop. Reopening **Import list** in the same session remounted the dialog
with that stale value and resurrected the canceled preview or validation error. No writes
occurred without confirmation, but cancel did not fully dismiss the payload.

## Repair

`PlaylistLibrary` now owns the pending startup fragment as one-shot React state. Closing
the import dialog consumes that state before restoring trigger focus, so manual reopen
starts with the ordinary file-import surface even when the parent has not rerendered.

## Verification

- Added a regression that starts with an invalid startup fragment, closes the resulting
  recoverable error, reopens Import list, and proves the stale alert does not return.
- Focused PlaylistLibrary tests pass; no repository write or storage contract changed.

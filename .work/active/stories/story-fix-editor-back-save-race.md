---
id: story-fix-editor-back-save-race
kind: story
stage: done
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-10-18
updated: 2026-10-18
tags: [ui]
---

# Back can be ignored when autosave finishes

Android-parity independent review reproduced the intermittent workspace CI failure:
Back after the saved indicator renders but before the editor identity effect runs
sets editing to null, then the delayed identity callback reopens the editor. Native
Back is consumed without navigating. Saved content is preserved. The existing test
is valid; waiting longer only masks the product race. Review identified
`CruxControlWorkspace.adoptDraftIdentity` as the cause and reproduced both button
and native-dispatch paths. Capture before the required focused repair.

## Scope and root cause

One callback unconditionally sets the editing identity from a passive editor effect.
The DOM can already show saved when Back queues editing=null, before the pending
effect queues the old id. Keep navigation closed when the callback arrives after
Back, while still replacing the saved draft and following identity changes during
active editing. Do not delay Back or alter autosave scheduling.

## Regression and acceptance

`CruxControlWorkspace.test.tsx` observes the save indicator's DOM transition and
immediately requests Back through each real ingress: button click and native
dispatcher. Both fail before the fix (2 failed, 34 unrelated skipped), with the
editor still visible instead of the named playlist edit button. Both must return
to the list with saved content/revision retained; native Back reports consumed.
Existing create/edit and conflict-copy tests protect active identity adoption.

## Execution

Host-owned focused fix during Android feature-review adjudication. No independent
story review; bounded inline review follows verification. No data schema, save
behavior, BLE or phone maintenance change.

## Implementation notes

Changed only `adoptDraftIdentity` to use a functional update that preserves null
editing state. New drafts still open through the unchanged create path; active
Save-a-copy adoption remains covered by the existing workspace test.

Both regression cases fail against the original callback and pass against the fix.
All 36 workspace tests pass. The complete web suite passes: 101 files, 893 tests,
with the existing one skipped file/test unchanged. Lint and TypeScript/build pass.
An initial full-suite run exposed a test-harness deadline: the default 1-second
element search overlapped the real 800ms autosave debounce under parallel load.
The regression now awaits the observer's Back-request signal before asserting the
destination; Back itself still executes at the saved DOM transition. No arbitrary
delay, assertion weakening, or production scheduling change was introduced.

No phone update was performed; the installed build does not contain this fix yet.

## Bounded inline review

Approved from the narrow callback/test diff and red/green evidence. The functional
update retains completed navigation, preserves active Save-a-copy identity adoption,
and does not change the independent create path or persisted content. The final
observer-based tests still fail twice with the original callback and pass twice
after restoring the fix. No independent story review or additional findings.

---
id: idea-editor-back-save-race
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

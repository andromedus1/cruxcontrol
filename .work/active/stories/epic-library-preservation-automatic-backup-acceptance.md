---
id: epic-library-preservation-automatic-backup-acceptance
kind: story
stage: implementing
tags: [data, security, ui]
parent: epic-library-preservation-automatic-backup
depends_on: [epic-library-preservation-automatic-backup-surfaces]
release_binding: null
gate_origin: null
created: 2026-10-11
updated: 2026-10-11
---

# Prove automatic protection and clean-install app recovery

## Brief

Implement Unit 4 acceptance in reserved synthetic test pools. Demonstrate real automatic offline/restart retry and entirely in-app clean-install discovery/recovery. Compare exact complete library after relaunch, structured large-library behavior, signed packaging and required integrated checks. Root owns live acceptance.

## Implementation

The [parent feature](../features/epic-library-preservation-automatic-backup.md#application-backup-design-2026-10-11)
owns exact contracts, units, acceptance, risks and tests. Close this child directly
on verified completion. Feature review follows all checkpoints; no real authored
library or device identity enters Git. Dependency readiness must be checked before
implementation.

## Native scale prerequisite verified

SignedProof22 preserves the existing empty and eight-climb/three-list emulator
libraries through SQLite v1→v2 upgrade; a relaunch retains exact canonical fields
and ordered memberships. The read-only `android-preservation-evidence.mjs` helper
uses bounded pages/byte ranges and checks an unchanged aggregate revision, so its
comparison does not rely on a giant native callback or a truncated record list.

`android-structured-storage-proof.mjs` exercises the actual production native
opener/adapter through Android's SQLite plugin in a separate new synthetic
database. Restore, verified capture, close/reopen and a second capture pass for
26,178,902 bytes: 10,000 climbs, 1,000 playlists and 100,000 references, including
a generated playlist over 32 KiB. Both canonical digests equal
`8fa1829f77989397a9b4c39817b16f86027b3918268007586d588cd6e7b83f2c`;
aggregate revision is one and the recovery barrier is clear. Elapsed restore and
verification/reopen time is about 67 seconds on this emulator, not a physical-phone
performance claim. The real app's eight-climb library is unchanged afterward.

Private evidence lives in `.private-firebase/review-update-acceptance/`.
`createStructuredContinuation` keeps an existing synthetic baseline intact while
growing a future UI fixture to the limits, avoiding emulator clearing or record
overwrites. The original structured transport fixture remains byte-identical.

## Integrated small-library recovery verified

SignedProof24 in reserved pool `acceptance-v1/r002` passes real Manage admission,
automatic grade edits and playlist reorder, offline save/process exit/reopen,
and automatic foreground reconnection. The UI stops acknowledging the earlier
receipt as soon as a new revision saves. Every unrelated field remains exactly
equal to the synthetic baseline; snapshots include drafts, finished climbs,
Trash, grades, effects, ordered local/provider/unavailable memberships.

The test slows actual emulator cellular networking, waits for committed pending
metadata plus the visible uploading phase, then force-stops the synthetic app.
The sealed file remains present. Relaunch with normal networking resolves the
same slot, digest, byte length and captured revision, adding exactly one receipt.
No transport/coordinator mock or injected restore is used.

A different installation, verified empty beforehand, discovers and reviews the
latest copy in Manage and restores through its normal button. All eight climbs,
three playlists and ten memberships match the source canonically before and
after relaunch. The selected retained source receipt protects the restored
revision without a duplicate upload. Source aggregate revision is five;
recovery revision is one. Evidence is outside Git in
`.private-firebase/automatic-app-acceptance/ui24b/`.

The first driver attempt reached initial protection and saved a grade, then
stopped because Android's CSS-transformed `innerText` read `Saved` rather than
`saved`. The driver was corrected; the continuation used a fresh preserved
baseline without resetting or rolling back data. That earlier boundary remains
in `ui24/`. Acceptance also found and separately tracked/fixed the real compact
status width defect in the mobile-status child. SignedProof26 preserves both
libraries exactly and verifies the corrected real WebView geometry/screenshot.

Shared web typecheck/lint and 878 tests pass; prototype typecheck/lint and 110
tests plus 11 packaging checks pass. Configured signedProof24/26 package checks,
non-debuggable release25 `library-v1` isolation, packaged-browser smoke (one test),
and six Playwright library backup/editor/read-resilience checks pass. No physical
phone or board is included in these results.

Next verify older-copy conflict/cancel preservation and the preserving 10,000-
climb/1,000-list cloud UI recovery, then complete standard feature review. No
operator import counts as cloud recovery.

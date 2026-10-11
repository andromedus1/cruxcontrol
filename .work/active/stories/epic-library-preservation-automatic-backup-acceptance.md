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

This prerequisite does **not** close the integrated recovery gate. Next use a fresh
reserved cloud pool with the real coordinator/UI: source admission, an edit and
playlist reorder, automatic protection, offline save/restart/retry, retained
pending staging across restart, and independent empty-installation UI recovery.
Then review/restore the preserving large fixture through the cloud UI and compare
complete records after relaunch. No operator import counts as cloud recovery.

---
id: epic-library-preservation-automatic-backup-review-fixes
kind: story
stage: done
tags: [data, security, ui]
parent: epic-library-preservation-automatic-backup
depends_on: [epic-library-preservation-automatic-backup-acceptance]
release_binding: null
gate_origin: null
created: 2026-10-11
updated: 2026-10-11
---

# Resolve automatic-backup review findings

## Brief and confirmed causes

The parent's one standard Claude pass (`20261011T172817Z-7aa47a5e`) identified
the following receiver-confirmed gaps. Root verified the cited paths; this child
owns their regression reproduction, bounded correction and verification.

1. `drive` checks connectivity before local `verifyRecovery`. An interrupted
   committed restore therefore cannot clear its local verification hold offline.
   Run local verification before network admission on foreground start/retry;
   retain the hold on a genuine mismatch/failure. Provide a retry control while
   verification remains pending. No network/auth work is needed to verify SQLite.
2. `refreshAndDrive` publishes after its final awaited full capture without a
   session-generation check. Sign-out during that await can be overwritten by a
   stale protected/account status. Read only the current preservation record when
   only revision is needed, and assert the epoch after the await before publishing.
3. `recoverOrUploadPending` returns refreshed history that its caller discards.
   A concurrent edit during pending-resolution readback can select the just-used
   slot from stale history, failing local CAS and staging unnecessarily. Carry
   `resolved.listing` forward and test the relevant interleaving.
4. An admitted library emptied by local deletion with retained cloud copies stays
   active/pending. The explicit design instead requires discovery/recovery admission
   before a later new climb uploads. Preserve all copies; transition empty capture
   with history to discovery/recovery-required without silently readmitting it.
5. Service `not-admitted` means the selected account is not enabled, but current
   copy tells that account to review inaccessible history. Give actionable account
   guidance and stop reusing that error code for unresolved pending local recovery.

## Meaningful verification

Add failing regression tests for the confirmed interleavings before fixes. Cover
offline verification success and failure/retry, delayed final-read sign-out/close,
an edit while resolving pending history, deletion-to-empty discovery, and 403
account guidance versus unresolved pending recovery. Strengthen boundary coverage
with changed native installation and pool over copied active/pending state,
different-account binding, and CAS/SQL acknowledgement failure after a real fake
remote commit: no false protection or new slot; retry reconciles the retained copy.
Corrupt staged bytes must not be acknowledged or replace prior good copies.

Run focused checks then required full web/native suites, typecheck/lint and signed
packaging. Root owns emulator updates with fresh external backups, actual maximum
structured automatic upload, and a non-destructive local-hold/offline runtime
proof if feasible. No real phone, app clearing, existing-record overwrite, or
deployment is authorized to the worker. Product UI reuses the approved surfaces;
these state/copy corrections do not need new mockups. Close this child directly on
verified completion. Standard parent review requires fix verification only, not
a second independent pass.

## Implementation notes

- Foreground start and retry now verify the local recovery barrier before checking
  connectivity or requesting account state. A failed or mismatched verification
  keeps the coordinator in `verifying-recovery`; Manage offers a local verification
  retry even while signed out.
- The final coordinator refresh reads only the preservation record and checks the
  session epoch before publishing. Pending reconciliation carries its refreshed
  listing into the next capture. An active, empty library with retained history is
  persisted back to discovery and recovery-required status.
- Account `not-admitted` guidance now explains that the connected account is not
  enabled for private backup. A failed pending recovery returns a separate local
  pending error rather than reusing the account policy error.
- Regression coverage also checks copied installation and pool bindings, a
  different account, remote commit followed by local CAS acknowledgement failure,
  corrupt staged metadata, and late sign-out/close completions.

## Verification

- Before production edits, the focused coordinator suite reproduced six failures
  across offline verification, empty-library admission, late sign-out publication,
  stale pending history, account-policy copy, and unresolved pending recovery.
- After the fixes, the focused coordinator and Manage suites passed: 40 tests.
- Full web suite passed: 102 files, 892 tests. Web typecheck and lint passed.
- Native prototype suite passed: 110 tests plus 11 Android package tests. Prototype
  typecheck and lint passed.
- Root owns signed packaging and live emulator acceptance; this child made no
  device, build, or deployment changes.

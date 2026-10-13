---
id: epic-library-preservation-automatic-backup-coordinator
kind: story
stage: done
tags: [data, security, ui]
parent: epic-library-preservation-automatic-backup
depends_on: [epic-library-preservation-automatic-backup-durable-state]
release_binding: null
gate_origin: null
created: 2026-10-11
updated: 2026-10-11
---

# Retry automatic backups without overstating protection

## Brief

Implement Unit 2 against the verified native vault port. Bind immutable receipts to exact pending revision and owner/install/pool, enforce discovery admission, reconcile lost responses and stage files, schedule foreground retries, and expose honest observable status.

## Implementation

The [parent feature](../features/epic-library-preservation-automatic-backup.md#application-backup-design-2026-10-11)
owns exact contracts, units, acceptance, risks and tests. Close this child directly
on verified completion. Feature review follows all checkpoints; no real authored
library or device identity enters Git. Dependency readiness must be checked before
implementation.

### Verified implementation

Added the observable coordinator and bounded status copy. It validates account,
installation and pool bindings; requires explicit admission for nonempty or
retained-history installs; persists pending metadata before upload; reconciles
lost responses and missing stage files; retains unknown snapshots; and only
acknowledges the captured revision after a verified receipt. Timer-driven
30-second coalescing, a 60-second maximum wait, foreground resume and bounded
5/15/60-second retry now execute captures without manual retry. A committed local
restore remains reported as complete if later cloud refresh or receipt bookkeeping
fails, while backup status exposes that later failure.

Coordinator tests cover admission, retained/unknown history, exact pending retry,
lost responses, missing staged files, same-account sign-out races, CAS retry,
R+1 pending state, timers/resume/backoff, source restore, post-commit outage,
recovery barriers, and capacity. Verification: focused coordinator suite 19/19;
full web suite 865/865 across 100 files; web typecheck and lint green. The
independent feature review and integrated live acceptance remain with the parent
feature owner.

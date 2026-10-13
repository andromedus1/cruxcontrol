---
id: epic-library-preservation-automatic-backup-surfaces
kind: story
stage: done
tags: [data, security, ui]
parent: epic-library-preservation-automatic-backup
depends_on: [epic-library-preservation-automatic-backup-coordinator]
release_binding: null
gate_origin: null
created: 2026-10-11
updated: 2026-10-11
---

# Connect accounts and recover copies inside the Android app

## Brief

Implement Unit 3 using the existing preservation mocks and primitives. Compose native-only coordinator lifecycle; add compact protection status and Manage/history/review/recovery surfaces; preserve portable delivery, focus/back/update guards and offline authoring.

## Implementation

The [parent feature](../features/epic-library-preservation-automatic-backup.md#application-backup-design-2026-10-11)
owns exact contracts, units, acceptance, risks and tests. Close this child directly
on verified completion. Feature review follows all checkpoints; no real authored
library or device identity enters Git. Dependency readiness must be checked before
implementation.

## Verification

Implemented the optional native-only automatic-backup runtime port, Android
foreground/connectivity lifecycle, compact status line, Manage/history/review/
recovery dialog, portable-file entry, focus return and recovery/update guards.
PWA and iOS retain the existing portable-file path. Recovery review shows counts
only after the selected copy has been downloaded and validated; raw provider,
SQL and account identifiers are not displayed.

Verified in `web` with `npm test` (878 tests), `npm run typecheck` and
`npm run lint`; in `prototypes/ios` with `npm test` (110 tests and 11 package
checks), `npm run typecheck` and `npm run lint`; also `git diff --check`. Focused
coverage includes rejected history loading without retry loops, local conflicts
and restore review, post-commit view-refresh retry without repeating restore,
dialog Back/Escape during restore versus ordinary queued cloud work, native-only
composition, foreground/connectivity events, focus return, and update admission
during an active recovery commit.

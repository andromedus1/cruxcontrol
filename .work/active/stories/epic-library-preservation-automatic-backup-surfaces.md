---
id: epic-library-preservation-automatic-backup-surfaces
kind: story
stage: implementing
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

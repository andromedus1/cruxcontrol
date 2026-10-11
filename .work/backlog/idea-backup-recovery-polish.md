---
id: idea-backup-recovery-polish
created: 2026-10-11
updated: 2026-10-11
tags: [data, ui]
---

Automatic-backup review (`20261011T172817Z-7aa47a5e`, findings 8–9) identifies
two bounded recovery improvements. Manage cannot currently bind a reviewed
identical copy when there are zero additions; after interrupted recovery, choosing
the local library can consume a duplicate snapshot slot. Existing copies and
authored records remain intact. Separately, a native restore preflight conflict,
invalid snapshot or verification hold can emit the generic recent-save-failed
notice although no ordinary edit was attempted. Distinguish those outcomes without
hiding real save failures. These do not invalidate verified missing-only recovery,
and are parked below the first dogfood data-integrity blockers; retain source
copies and truthful admission if later implemented.

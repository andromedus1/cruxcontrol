---
id: epic-library-preservation-automatic-backup-durable-state
kind: story
stage: done
tags: [data, security, ui]
parent: epic-library-preservation-automatic-backup
depends_on: [epic-library-preservation-native-library, epic-library-preservation-private-vault]
release_binding: null
gate_origin: null
created: 2026-10-11
updated: 2026-10-11
---

# Bind saved changes and recovery to durable native revisions

## Brief

Implement Unit 1 of the parent design: preserving schema migration, committed aggregate revision, bounded native SQL transfer, coherent capture, CAS control and atomic whole-library restore with durable verification barrier. Validate against real SQLite, fault injection and reopen.

## Implementation

The [parent feature](../features/epic-library-preservation-automatic-backup.md#application-backup-design-2026-10-11)
owns exact contracts, units, acceptance, risks and tests. Close this child directly
on verified completion. Feature review follows all checkpoints; no real authored
library or device identity enters Git. Dependency readiness must be checked before
implementation.

## Implementation notes

- Execution capability: GPT-6 Luna xhigh, as directed by the orchestrator; the
  cross-layer SQLite/restore boundary needs high reasoning.
- Review weight: standard, from project convention; child checkpoint closes on
  verification and the feature receives its single independent review later.
- Files changed: `web/src/automatic-backup/{types,state}.ts`,
  `web/src/app/library.ts`, `web/src/library-backup/{types,service}.ts`,
  `web/src/library-backup/LibraryBackupDialog.{tsx,test.tsx}`,
  `prototypes/ios/src/native-library.{ts,test.ts}`.
- Tests added: strict state-decoder tests cover owner binding, immutable history,
  pending-slot collisions, receipt/revision matching and exact persisted fields.
  Real-SQLite tests cover preserving v1 migration, mutation
  revisions/events and control CAS, atomic cross-table restore/conflict,
  post-commit verification hold/reopen, bounded paging and large payload
  transfer. Dialog coverage verifies truthful counts after committed restore
  with an incomplete recovery barrier.
- Verification: native-library tests 18/18; state/service/dialog tests 40/40;
  full web suite 846/846; web and prototype TypeScript checks and both package
  lint checks pass.
  The broader prototype suite currently includes a root-owned intentional RED
  regression in the native-vault test while its separate review fix is in
  progress; this checkpoint's focused tests pass.
- Simplification: kept portable recovery on the existing dialog and shared
  backup service; native atomic restore is an optional store capability, so the
  browser's existing two-store behavior remains unchanged.
- Discrepancies from design: `open-native-library.ts` needed no change; the
  existing plugin connection already omits an upgrade object and delegates the
  preserving v1→v2 migration to `createNativeLibrary`.
- Adjacent issues parked: none.

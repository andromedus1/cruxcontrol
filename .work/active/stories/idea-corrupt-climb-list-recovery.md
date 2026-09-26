---
id: idea-corrupt-climb-list-recovery
kind: story
stage: done
tags: [data]
parent: feature-library-read-resilience
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-09-26
---

# Corrupt climb list recovery

## Brief
A single undecodable local climb row currently rejects the entire repository list,
hiding otherwise healthy climbs and recoverable Trash entries behind an error. Make
listing corruption-tolerant by preserving the bad row as recovery evidence while
returning healthy rows and surfacing a targeted warning. Preserve corrupt and
unknown-version records without silently deleting data. Trash remains until explicit
permanent deletion; library backups do not yet provide raw corrupt-row salvage.

## Delivery scope
Authorized in the everyday-reliability cleanup. Preserve stored library data and existing visual structure. Add focused regression evidence and complete the applicable review lane.

## Simplification opportunity
Repair the existing path directly; no new subsystem.

## Implementation notes (2026-09-26)
Root cause: the indexed list cursor rejected on the first corrupt decoded row and could miss rows without index metadata. Added explicit opt-in read diagnostics; full-store enumeration preserves ordering, reports corrupt/future records, and leaves bytes unchanged. Strict reads still reject incomplete input. Repository regression failed before fix and passes afterward, including healthy active/Trash rows, unindexed corruption, future versions, raw preservation and real storage failures.

Verification: `npm -w web test -- src/drafts/indexeddb-repository.test.ts src/app/CruxControlWorkspace.test.tsx` — 33 tests pass. TypeScript passed after integration. Child checkpoint closes directly; parent owns standard independent review. Inline host capability chosen for data-preservation contract. Full repository/CI checks follow before parent completion.

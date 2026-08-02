---
id: epic-route-creation-climb-lifecycle-persistence
kind: story
stage: done
tags: [ui, data]
parent: epic-route-creation-climb-lifecycle
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Persist Draft, Finished, and Trash Lifecycle

## Brief

Implement Unit 1 from the parent feature: schema-v3 lifecycle migration, typed
Draft/Finished state, revision-checked trash/restore/permanent deletion, collection
filters, and deterministic 30-day expired-trash cleanup in the existing IndexedDB
aggregate repository.

## Implementation

See the parent feature's `## Implementation Units` Unit 1 and its acceptance criteria.

## Implementation notes

- Execution capability: GPT-5.6 Sol at xhigh reasoning, selected by the autopilot caller for the versioned persistence migration and concurrency-sensitive lifecycle commands.
- Review weight: standard (caller override).
- Files changed: `web/src/drafts/types.ts`, `codec.ts`, `repository.ts`, `indexeddb-repository.ts`, draft fixtures/tests, and compile-time consumers of the schema-v3 repository contract in app/editor tests and state construction.
- Tests added/removed: added codec coverage for pure v1/v2 migration, v3 lifecycle round-trip, and invalid lifecycle values; added repository contract/regression coverage for collection partitioning, stable identity through trash/restore, optimistic revisions, rejected Trash saves, permanent deletion, and the inclusive 30-day purge boundary while preserving active/corrupt/unknown-version rows. No tests removed.
- Simplification: consolidated revision-checked aggregate replacements behind one atomic repository mutation path and shared manual/automatic physical deletion through one primitive; removed the old hard-delete repository contract.
- Discrepancies from design: none.
- Adjacent issues parked: none.
- Verification: `npm test -- --run src/drafts` (5 files, 44 tests passed); `npm run typecheck` (passed).

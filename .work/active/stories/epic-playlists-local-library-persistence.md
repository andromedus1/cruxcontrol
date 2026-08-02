---
id: epic-playlists-local-library-persistence
kind: story
stage: done
tags: [ui, data]
parent: epic-playlists-local-library
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Persist Local Playlists and Ordered Climb References

## Brief

Implement Unit 1 from the parent feature: versioned playlist/reference contracts,
strict codec validation, and an atomic optimistic IndexedDB repository with complete
contract and adapter tests.

## Implementation

See the parent feature's Unit 1 and acceptance criteria.

## Implementation notes

- Execution capability: GPT-5.6 Sol at xhigh reasoning, selected by the caller for
  the new persistence and runtime scope; direct-read implementation kept one owner
  across the feature checkpoints.
- Review weight: standard (caller and project convention).
- Files changed: new `web/src/playlists/` domain types, strict codec, typed errors,
  repository port, native IndexedDB adapter/opening lifecycle, public exports, and
  focused fixtures/tests.
- Tests added/removed: added 18 codec, repository, and database-open tests protecting
  local/provider reference order, corruption paths, duplicate rejection, stable
  identity, optimistic revisions, timestamp-tie ordering, reopen persistence, and
  retryable storage failures; removed none.
- Simplification: reused the established native IndexedDB port/adapter shape while
  keeping playlist storage in one independent database and omitting climb-store joins
  from persistence.
- Discrepancies from design: none.
- Adjacent issues parked: none.

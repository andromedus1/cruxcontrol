---
id: epic-playlists-local-library-management
kind: story
stage: done
tags: [ui, data]
parent: epic-playlists-local-library
depends_on: [epic-playlists-local-library-persistence]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Manage Flexible Lists in the Climb Workspace

## Brief

Implement Unit 2 from the parent feature: runtime composition, reference resolution,
Lists navigation and CRUD, multi-list climb membership, accessible manual reordering,
and Trash-safe unavailable entry handling.

## Implementation

See the parent feature's Unit 2 and acceptance criteria.

## Implementation notes

- Execution capability: GPT-5.6 Sol at xhigh reasoning, selected by the caller for
  the coupled runtime, persistence-resolution, and responsive workspace scope;
  direct-read implementation preserved one owner across both story checkpoints.
- Review weight: standard (caller and project convention).
- Files changed: playlist resolver and responsive management/membership components;
  app runtime/database lifecycle; workspace navigation and climb-detail integration;
  focused component/runtime/integration/e2e tests; current-state playlist assertions
  in `docs/SPEC.md` and `docs/ARCHITECTURE.md`.
- Tests added/removed: added resolver coverage, runtime partial-startup cleanup,
  CRUD/notes/delete confirmation, independent multi-list checkbox mutations, inline
  list creation, reordering/removal boundaries, retry errors, Trash/missing
  availability, and a production-build Chromium reload journey; updated runtime test
  fixtures for the new playlist port; removed none.
- Simplification: kept membership as ordered references in one playlist aggregate,
  used read-time resolution rather than lifecycle hooks or cross-database transaction
  machinery, and reused the existing workspace/detail responsive patterns.
- Discrepancies from design: none. Parent-tier mockups remain explicitly deferred by
  the feature design; implementation reused the locked design tokens and existing
  workspace composition.
- Adjacent issues parked: none.

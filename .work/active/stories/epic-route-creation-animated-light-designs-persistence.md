---
id: epic-route-creation-animated-light-designs-persistence
kind: story
stage: done
tags: [data, ui]
parent: epic-route-creation-animated-light-designs
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Persist effect groups and membership

Implement Unit 1 from the parent feature: normalized effect contracts, v1 migration,
v2 encoding/decoding, and boundary validation.

## Implementation notes

- Execution capability: GPT-5.6 high; versioned persistence changes cross the renderer, codec, repository, and existing fixtures.
- Review weight: standard (project default); not applicable to this child-story checkpoint.
- Files changed: `web/src/board-renderer/types.ts`, draft types/codec/repository fixtures, and affected v2 test fixtures.
- Tests added/removed: v1 migration, exact v2 round-trip, corrupt group/dangling membership validation, and repository persistence coverage; none removed.
- Simplification: effect configuration is normalized once at draft level and assignments store only an optional branded group ID.
- Discrepancies from design: none.
- Adjacent issues parked: none.
- Verification: focused draft/repository/autosave/workspace tests (40 tests) and TypeScript typecheck pass.

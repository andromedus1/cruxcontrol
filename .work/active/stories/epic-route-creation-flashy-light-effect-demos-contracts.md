---
id: epic-route-creation-flashy-light-effect-demos-contracts
kind: story
stage: done
tags: [ui, ble, data]
parent: epic-route-creation-flashy-light-effect-demos
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Spatial effect contracts and migrations

Implement Unit 1 from the parent feature: versioned discriminated groups, draft v4, and
portable v2 with lossless old-version migration.

## Implementation notes

- Execution capability: highest available; versioned local/share persistence and BLE-facing contracts require strict migration behavior.
- Review weight: standard (caller).
- Files changed: board renderer effect types; draft v4 types/codec/tests; portable playlist v2 types/codec/tests and export fixture.
- Tests added/removed: spatial snapshot round trips, legacy migration, dangling spatial assignment rejection; no tests removed.
- Simplification: one discriminated saved group union serves drafts, playlists, editor, and runtime; no parallel background store.
- Discrepancies from design: legacy in-memory assigned groups with an omitted discriminator are accepted and normalized to `model: assigned`; persisted v4/v2 output is explicit.
- Adjacent issues parked: none.
- Verification: typecheck and 55 focused codec/export/import tests passed.

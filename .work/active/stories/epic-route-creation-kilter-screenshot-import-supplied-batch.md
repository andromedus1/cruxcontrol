---
id: epic-route-creation-kilter-screenshot-import-supplied-batch
kind: story
stage: done
tags: [data, ui]
parent: epic-route-creation-kilter-screenshot-import
depends_on: [epic-route-creation-kilter-screenshot-import-review-persistence]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Supplied 16-Climb Migration

## Brief

Implement Unit 3 from the parent feature: expose and verify the private/local one-action
review/import path for all 16 derived climbs without bundling their source PNGs.

## Implementation notes

- Execution capability: focused inline implementation; the pixel-free candidate factory,
  existing review-flow entry, migration integration tests, and private-source verifier
  are one cohesive final unit.
- Review weight: standard (project convention); the parent feature is advanced to its
  independent review boundary after this child completes.
- Files changed: `web/src/screenshot-import/supplied-batch.ts`, the existing dialog and
  exports, focused unit/private-source tests, and `web/e2e/screenshot-import.spec.ts`.
- Tests added: exactly 16 checksum-linked candidates, no-write review entry, exact names
  and definition-derived assignment counts, first import of 16 ordinary 40° drafts,
  second import skipping all 16, and a 390×844 Chromium overflow/navigation smoke.
- Private-source verification: the opt-in-capable test decoded all 16 local PNGs read-only,
  recomputed every SHA-256, linked every authoritative title, and passed every image
  through the production detector. All detected role/lattice tuples exactly matched the
  checked-in manifest; only expected off-board/status-bar components were warnings.
- Build/privacy verification: production/PWA build contains no `Screenshot_*.png` asset;
  the only emitted PNG remains the private Fullride hold reference. Source screenshots
  remain unmodified, untracked, and outside application imports.
- Simplification: supplied migration reuses the same editable review and batch service;
  no synthetic files, source pixels, alternate persistence schema, or installation lookup
  were introduced.
- Discrepancies from design: none.
- Adjacent issues parked: none.

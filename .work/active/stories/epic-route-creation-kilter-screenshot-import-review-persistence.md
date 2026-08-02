---
id: epic-route-creation-kilter-screenshot-import-review-persistence
kind: story
stage: done
tags: [data, ui]
parent: epic-route-creation-kilter-screenshot-import
depends_on: [epic-route-creation-kilter-screenshot-import-recognition-core]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Screenshot Review and Persistence

## Brief

Implement Unit 2 from the parent feature: transient file analysis, editable local review,
resource cleanup, idempotent batch persistence, and workspace integration.

## Implementation notes

- Execution capability: focused inline implementation; the browser resource lifecycle,
  review dialog, repository batch boundary, and workspace entry form one integrated unit.
- Review weight: standard (project convention); the parent feature retains the
  independent review boundary.
- Files changed: `web/src/screenshot-import/file-analysis.ts`, `import-batch.ts`,
  `KilterScreenshotImportDialog.tsx` and CSS, shared screenshot-import types/exports,
  `web/src/app/CruxControlWorkspace.tsx` and CSS, plus focused tests.
- Tests added: known-checksum decode bypass; bitmap/canvas cleanup on success and every
  allocation/extraction failure; exact active/Trash duplicate semantics, partial failure,
  same-batch idempotence, and immutable inputs; sequential dialog analysis, write-free
  cancel, URL cleanup, required title/warning confirmation, keyboard correction, retry,
  and workspace entry. The full 64-file suite also passed.
- Simplification: source pixels are reduced to facts immediately and never enter state;
  one object URL exists only for the current title evidence. The batch service creates
  ordinary repository drafts and adds no import schema, image cache, or OCR dependency.
- Discrepancies from design: direct visual inspection corrected the authoritative
  `Screenshot_20260802-141819.png` title from typographic quotes to the screenshot's
  straight ASCII quotes (`"do a kick flip" 4+`). No supplied-batch action was added;
  that remains Unit 3.
- Adjacent issues parked: none.

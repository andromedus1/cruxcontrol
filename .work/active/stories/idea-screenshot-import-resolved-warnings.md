---
id: idea-screenshot-import-resolved-warnings
kind: story
stage: done
tags: [ui, data]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-09-26
---

# Screenshot import resolved warnings

## Brief

Reconcile screenshot-import recognition warnings after manual hold correction. Today a
low-confidence/off-grid warning remains visible and requires the explicit reviewed/
accepted checkbox even after the user fixes the interpreted board. Preserve the original
evidence, but distinguish warnings that the current corrected assignments have resolved.

## Delivery scope

Authorized in the everyday-reliability cleanup. Preserve stored library data and existing visual structure. Add focused regression evidence and complete the applicable review lane.

## Simplification opportunity

Repair the existing path directly; no new subsystem.

## Root cause

The dialog used the immutable recognition warning array as both historical evidence and the current import gate. It did not compare edited assignments with the candidate's original assignment list, so it could not tell whether the board cell associated with a low-confidence or duplicate warning had been corrected; arbitrary edits could also have been treated as resolving an off-grid candidate.

## Design and acceptance

- Keep `candidate.warnings` unchanged as original recognition evidence and derive the current unresolved warning list for display and import readiness.
- Resolve `title-required` when the current title is non-blank after trimming.
- Resolve `low-confidence` and `duplicate-cell` only when the assignment at their uniquely mapped board cell differs from its initial recognized assignment. Unrelated edits do not resolve them.
- Keep `unsupported-profile`, `unresolved-cell`, and `off-grid` warnings unresolved because they have no safe current board-cell mapping. The existing reviewed/accepted checkbox remains the explicit acknowledgment path for those warnings; an arbitrary hold edit cannot falsely clear off-grid evidence.
- Preserve the existing review surface and import payload shape; automatically resolved warnings no longer require the blanket acknowledgment, while acknowledged unresolved warnings continue to do so.

## Regression test

- `web/src/screenshot-import/warning-reconciliation.test.ts` covers title resolution without mutating evidence, mapped-cell correction, unrelated edits, and off-grid persistence.
- `web/src/screenshot-import/KilterScreenshotImportDialog.test.tsx` updates the existing title-warning behavior to assert an honest `warningsOverridden: false` import once the title is filled and the hold is corrected.

## Implementation notes

- Execution capability: inline standalone fix; the reconciliation is a local pure helper consumed by the existing dialog.
- Review weight: standard from `.work/CONVENTIONS.md`; bounded inline standalone review applies and no independent reviewer was used.
- Files changed: `web/src/screenshot-import/warning-reconciliation.ts`, `KilterScreenshotImportDialog.tsx`, the reconciliation test, and the existing dialog test.
- Tests added/updated: focused warning regressions, then green screenshot-import suite (29 tests), web lint, and Prettier checks on touched files, including the dialog-level unrelated/relevant/reverted cell flow.
- Red-green evidence: the original dialog behavior required a checkbox after title entry; the new integration assertion failed until readiness used reconciled warnings. The pure reconciliation tests then passed for mapped corrections and correctly retained off-grid warnings.
- Inline review: the helper compares only the warning's uniquely mapped placement against the candidate's immutable original assignments, retains original warning objects, and leaves centroid-only off-grid evidence behind the existing acknowledgment. The current repository typecheck is blocked by the unrelated host edit in `web/src/route-editor/LightEffectsPanel.tsx` (`velocityX`/`velocityY` access on the `SpatialRecipe` union); screenshot-import tests and lint remain green. Stage remains `review` for host integrated checks/CI.
- Adjacent issues parked: none.

## Review closure (2026-09-26)

**Verdict**: Approve.

Bounded inline standalone review: immutable candidate evidence is retained; only title or corresponding changed cell resolves its warning. Unrelated edits and reverting a correction retain/restore warnings; centroid-only off-grid warnings still need acknowledgment.

**Blockers**: none unresolved. **Important**: none. **Review weight**: standard, from project convention (standalone stories use bounded inline review).

**Verification**: 85 Vitest files / 662 tests; lint; TypeScript/Vite/PWA production build; all 13 Chromium workflows. GitHub CI run [36249285638](https://github.com/andromedus1/cruxcontrol/actions/runs/36249285638) passed for application commit `93cda6a`. No phone maintenance or user-data migration occurred.

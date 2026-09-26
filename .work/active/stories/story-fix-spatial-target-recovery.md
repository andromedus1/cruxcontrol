---
id: story-fix-spatial-target-recovery
kind: story
stage: done
tags: [bug, data]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-26
updated: 2026-09-26
---

# Preserve incompatible saved spatial targets for recovery

## Symptom
The route-creation aggregate review found that saved or backup-restored spatial recipes with unavailable include/exclude placements silently lose those targets during rendering and remain editable.

## Root cause
Workspace compatibility checks validate assignment placements but omit spatial target placement references. The codec is intentionally definition-independent; the renderer enumerates current placements.

## Fix approach
Extend the existing definition-aware workspace check to both spatial target lists. Reuse Recovery needed and retain the stored recipe unchanged. No migration or renderer changes.

## Regression test
`web/src/app/CruxControlWorkspace.test.tsx` covers unavailable include and exclude targets, recovery actions, absence of editing/writes, and unchanged input. Before the fix both cases failed because Recovery needed was absent; the other 19 workspace tests passed.

## Review policy
Focused inline correction at standard weight; bounded standalone-story review and epic fix verification, no repeated independent epic review.

## Implementation notes
Baseline inline capability: a bounded compatibility check with two regression cases. Extended the existing check without changing codecs, persisted data, rendering, or UI structure. Both initially failing cases now pass; full verification passes 85 files/664 tests, lint, TypeScript/Vite/PWA build, and 13 production Chromium workflows. Documentation check confirms existing SPEC/README recovery assertions now hold; no new contract or documentation surface. No adjacent findings.

## Bounded inline review
Approve on local evidence: both spatial target lists use the active definition, assignment and non-spatial behavior remains intact, and recovery preserves authored records without opening the editor. CI run 36250137466 passed for application commit 2a7fb76; the bounded inline review is approved and complete.

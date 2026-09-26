---
id: story-fix-spatial-target-recovery
kind: story
stage: implementing
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

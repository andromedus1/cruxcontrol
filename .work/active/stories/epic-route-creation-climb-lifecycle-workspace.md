---
id: epic-route-creation-climb-lifecycle-workspace
kind: story
stage: done
tags: [ui, data]
parent: epic-route-creation-climb-lifecycle
depends_on: [epic-route-creation-climb-lifecycle-persistence]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Add Lifecycle-Aware Library and Editor Controls

## Brief

Implement Unit 2 from the parent feature: My Climbs, Drafts, and Trash collections;
unrestricted autosaved Draft/Finished transitions; and confirmed trash, restore, and
permanent-delete actions composed through the lifecycle repository contract.

## Implementation

See the parent feature's `## Implementation Units` Unit 2 and its acceptance criteria.

## Implementation notes

- Execution capability: GPT-5.6 Sol at xhigh reasoning, selected by the autopilot caller for the cross-cutting workspace, editor, autosave, and browser acceptance surface.
- Review weight: standard (caller override).
- Files changed: `web/src/app/CruxControlWorkspace*`, `web/src/climb-browser/ClimbDetail.tsx`, `LocalClimbViewer*`, route-editor state/workspace/autosave files and tests, `web/src/App*`, `web/e2e/local-route-editor.spec.ts`, plus stale lifecycle assertions in `docs/SPEC.md` and `docs/ARCHITECTURE.md`.
- Tests added/removed: added component coverage for collection partitioning/counts, Draft creation, status movement, confirmations, retryable destructive/cleanup errors, incompatible-record recovery actions, contextual viewer actions, unrestricted reducer transitions, and cross-tab Trash-safe autosave recovery; replaced the stale Playwright route test with Draft → Finished → Trash → restore → reload identity/content coverage and retained compact-phone interaction coverage. No behavioral coverage was removed.
- Simplification: kept one authoritative local-climb array in the workspace and derived all three views/counts from lifecycle state; reused the editor's existing autosave content/recovery path for status rather than adding a second persistence channel.
- Discrepancies from design: none.
- Adjacent issues parked: none.
- Verification: targeted Vitest UI/editor suite (34 tests passed); `npm run typecheck` (passed); `npm run lint` (passed); `npm run build` (passed); `npm run test:e2e -- e2e/local-route-editor.spec.ts` (2 Chromium tests passed).

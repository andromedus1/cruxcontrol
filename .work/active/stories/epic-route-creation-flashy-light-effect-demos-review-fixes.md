---
id: epic-route-creation-flashy-light-effect-demos-review-fixes
kind: story
stage: done
tags: [bug, ui, ble, data]
parent: epic-route-creation-flashy-light-effect-demos
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-26
updated: 2026-09-26
---

# Correct effects feature review findings

## Brief
Close material findings from the single required standard feature review: respect explicitly assigned effects on semantic holds when no spatial background is present; enforce unused scope even for included custom assignments in both recipe versions; make Layer up move toward the topmost/later array position; reject unknown spatial include/exclude IDs at the definition-aware portable-import boundary; expose Beach Ball authored direction through existing recipe controls.

## Adjudication
All five findings reproduce concrete mismatches with the accepted contracts. Role protection under spatial backgrounds remains exact and static per the newer effects contract; assignment-only animation must retain its earlier explicit opt-in behavior. This qualification reconciles the earlier animation acceptance with the current protected-background requirement. No change to stored recipes, capacity, controller protocol, or reserved colors. Fix verification only after this standard pass, no repeated independent feature review.

## Verification
Add focused regressions before fixes and run relevant renderer, editor and import suites. Existing v1 fixtures, versioned codecs and role-protection tests must remain green. Final integration includes full tests, typecheck, lint, production build, browser tests, and CI.

## Implementation notes
- Execution capability: standard inline fix; five confirmed review regressions share the existing frame, spatial-target, panel, and portable-preview boundaries.
- Review weight: standard feature review already completed; no independent re-review repeated per adjudication.
- Files changed: `web/src/light-effects/frame.ts`, `web/src/light-effects/frame.test.ts`, `web/src/light-effects/spatial-frame-v1.ts`, `web/src/light-effects/spatial-frame-v2.ts`, `web/src/light-effects/spatial-frame.test.ts`, `web/src/route-editor/LightEffectsPanel.tsx`, `web/src/route-editor/RouteEditorWorkspace.test.tsx`, `web/src/playlists/portable-import.ts`, `web/src/playlists/portable-import.test.ts`.
- Tests added: role assignment-only animation and spatial role protection; v1/v2 unused-scope include exclusion for assigned custom holds; unknown spatial include/exclude import targets with concrete paths; Layer up ordering; Beach Ball horizontal/vertical direction editing, nonzero magnitude preservation, and zero-velocity direction initialization.
- Red evidence: before fixes, the focused run failed the assignment-only role assertion (`received role color`), both unknown spatial-target cases (`expected function to throw`), and Beach Ball controls (`Unable to find a label`); the initial layer-order regression setup selected the already-topmost group and was corrected to select the lower group before asserting the movement.
- Green evidence: `npm -w web test -- --run src/light-effects/frame.test.ts src/light-effects/spatial-frame.test.ts src/playlists/portable-import.test.ts src/route-editor/RouteEditorWorkspace.test.tsx` — 4 files / 63 tests passed; `npm -w web run typecheck` passed; scoped ESLint passed for all changed source/test files.
- Fix behavior: assigned role effects animate only when no spatial group is present; any spatial group keeps semantic roles exact and topmost. `unused` excludes every assigned hold even when included. Layer up moves toward later/topmost array entries. Portable import rejects unknown spatial target IDs before writes. Beach Ball controls edit velocity signs while preserving magnitudes, using unit magnitude when an authored velocity is zero.
- Simplification: reused the existing target validation error code, panel update path, recipe shape, and layer array reducer; no new persistence or runtime boundary.
- Discrepancies from design: none.
- Adjacent issues parked: none.

---
id: idea-screenshot-import-dimension-limit
kind: story
stage: done
tags: [security, data]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-09-26
---

# Screenshot import dimension limit

## Brief

Add an explicit maximum pixel/dimension bound to Kilter screenshot import before canvas
allocation and detector typed-array work. The importer currently rejects wrong aspect
ratios and browser canvas limits fail safely, but a locally selected, correctly
proportioned enormous PNG could still create avoidable memory pressure before rejection.

## Delivery scope

Authorized in the everyday-reliability cleanup. Preserve stored library data and existing visual structure. Add focused regression evidence and complete the applicable review lane.

## Simplification opportunity

Repair the existing path directly; no new subsystem.

## Root cause

The decoded bitmap dimensions were copied into a canvas before the detector's profile check. A correctly proportioned but enormous local PNG could therefore allocate canvas storage and, after pixel extraction, detector typed arrays before the importer rejected it.

## Design and acceptance

- Bound analysis to twice the 1080×2400 reference profile in each axis: 2160×4800, about 10.4 megapixels. This includes the supplied screenshots and ordinary high-resolution phone screenshots while keeping the proportional detector model intact.
- Reject an oversized decoded bitmap before canvas allocation, and close it through the existing `finally` cleanup path.
- Apply the same upper bound in the detector's profile guard so direct detector callers return an `unsupported-profile` warning before typed-array allocation.
- Keep the existing lower dimensions and aspect-ratio checks and preserve the transient-pixel behavior.

## Regression test

- `web/src/screenshot-import/file-analysis.test.ts` proves a 2161×4800 bitmap rejects before `createCanvas` and closes the bitmap.
- `web/src/screenshot-import/ring-detector.test.ts` proves dimensions above the shared cap are rejected by the detector profile guard.

## Implementation notes

- Execution capability: inline standalone fix; both changes are confined to the screenshot-import boundary and share one small profile contract.
- Review weight: standard from `.work/CONVENTIONS.md`; bounded inline standalone review applies and no independent reviewer was used.
- Files changed: `web/src/screenshot-import/file-analysis.ts`, `web/src/screenshot-import/ring-detector.ts`, and their focused tests.
- Tests added/updated: red dimension and cleanup regressions, then green screenshot-import suite (29 tests), web lint, and Prettier checks on touched files.
- Red-green evidence: the new oversized-bitmap test first reached canvas setup (`Cannot set properties of undefined`); after the pre-allocation guard was implemented, the dimension regressions passed and the full screenshot-import suite remained green.
- Inline review: the cap is checked before `createCanvas`, detector profile validation precedes `connectedComponents`, and the decoded bitmap remains closed on both rejection and extraction errors. The current repository typecheck is blocked by the unrelated host edit in `web/src/route-editor/LightEffectsPanel.tsx` (`velocityX`/`velocityY` access on the `SpatialRecipe` union); screenshot-import tests and lint remain green. Stage remains `review` for host integrated checks/CI.
- Adjacent issues parked: none.

## Review closure (2026-09-26)

**Verdict**: Approve.

Bounded inline standalone review: dimension checks precede canvas and detector pixel access, resources close on failure, and normal/supplied screenshots retain their path.

**Blockers**: none unresolved. **Important**: none. **Review weight**: standard, from project convention (standalone stories use bounded inline review).

**Verification**: 85 Vitest files / 662 tests; lint; TypeScript/Vite/PWA production build; all 13 Chromium workflows. GitHub CI run [36249285638](https://github.com/andromedus1/cruxcontrol/actions/runs/36249285638) passed for application commit `93cda6a`. No phone maintenance or user-data migration occurred.

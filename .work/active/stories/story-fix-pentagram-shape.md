---
id: story-fix-pentagram-shape
kind: story
stage: done
tags: [bug, ui, ble]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Render the complete circled pentagram

## Symptom

Physical board dogfooding shows the fading pentagram as a V rather than a recognizable
five-point star with a circle around it.

## Root cause

The renderer globally ranks holds by distance to any star chord. The irregular Fullride
placement density lets most of the 15 winners cluster around the two densest strokes, and
the recipe does not generate a surrounding circle at all.

## Fix approach

Generate evenly distributed target anchors around the circumference and along every star
chord, then independently snap each anchor to its nearest unused eligible hold. Use the
full measured 20-light scene for ten circle anchors and ten star anchors; preserve the
existing synchronized red fade and route-role protection.

## Regression test

`web/src/light-effects/spatial-frame.test.ts` proves the preset reserves 20 lights and
that each emitted placement tracks its corresponding circle/star anchor around the full
symbol rather than clustering on the locally densest strokes.

## Implementation notes

- **Execution capability**: host implementation at high reasoning; this was a focused,
  geometry-local repair with no need for independent delegation.
- **Files changed**: the spatial renderer now snaps evenly distributed circle and star
  anchors; the preset library reserves the measured 20-light maximum; the active feature
  record reflects the corrected capacity contract.
- **Regression evidence**: the new test failed against the 15-light globally ranked V,
  then passed with ten circle and ten star anchors. The original fade, unique-placement,
  protected-color, and footprint tests remain green.
- **Confirmation**: 443 tests pass, followed by typecheck, lint, and production PWA build.
- **Adjacent issues**: none discovered.

## Review

Bounded standalone review approved. The diff is confined to pentagram geometry, its
declared reserve, regression coverage, and the owning feature record. Anchor selection is
deterministic, unique, capacity-bounded, and retains the existing target and role-color
protection paths. No correctness or test-integrity findings remain.

## Dogfood bounce

The first anchor-distribution repair is closer but still does not read on the physical
board as the requested point-down pentagram enclosed by a circle. Reopened for a visual-
topology regression that verifies ordered star vertices/crossings and the enclosing ring
after snapping to actual Fullride placements.

## Second repair

The first repair sampled only the quarter and three-quarter positions of each chord. It
therefore omitted all five defining star vertices and inset the star away from the circle.
The corrected 20-light topology uses ten ring anchors offset between the star vertices,
five explicit point-down star vertices on the ring, and five inner chord midpoints. Actual
snapped Fullride coordinates were inspected for centered bottom point, symmetric upper and
side points, inner crossings, and an enclosing ring.

The second regression pass is green with 443 tests, typecheck, lint, and production build.

## Second review

Bounded review approved the bounced repair. The rendered set now contains the five actual
point-down star vertices, five chord midpoints, and an offset ten-light enclosing ring.
The regression checks the snapped Fullride coordinates and explicitly proves the centered
downward point; fade, capacity, uniqueness, and protected colors remain covered.

## Second dogfood bounce

The corrected topology is recognizable, but its 0.48 normalized radius snaps the left and
right vertices/ring anchors onto extreme edge holds. Physical framing clips those edges
and weakens the silhouette. Reopened to scale the complete symbol inward uniformly and
prove a visible margin using actual snapped Fullride coordinates.

The complete symbol now uses a 0.40 normalized radius. Its snapped bounds are X ±36 on
the board's ±44 range and Y 36–128 on the board's 24–144 range, preserving the point-down
topology while keeping every outer light visibly in frame.

The framing regression and full 443-test suite pass, followed by typecheck, lint, and the
production PWA build.

## Framing review

Bounded review approved. The repair changes only the common star/ring radius and adds
post-snap margin assertions on every emitted light. It preserves the previously approved
topology, fade, deterministic placement, uniqueness, protected colors, and 20-light cap.

## Inner-point dogfood adjustment

Move the five inner chord lights one physical hold spacing radially outward: the bottom
light down, the left/right lights sideways, and both upper lights up. Preserve the outer
five star vertices, enclosing ring, framing margins, and fade.

The regression first showed that shifting abstract anchors retained the same snapped
holds. The renderer now shifts from each actual base placement and the test proves the
five exact eight-unit coordinate changes. The full 443-test suite, typecheck, focused
spatial suite, lint, and production build pass.

## Inner-point review

Bounded review approved. The change is limited to the five chord anchors, derives one
physical eight-unit step from the already-snapped base placement, and has exact-coordinate
coverage. The other fifteen lights and all existing effect invariants are unchanged.

## Inner-point refinement

Keep the two upper inner chord lights one spacing up, but return the left, right, and
bottom inner lights to their original centerward positions. No other light changes.

Exact-coordinate regression, all 443 tests, typecheck, lint, and production build pass.

## Refinement review

Bounded review approved. Only the two upper chord anchors retain outward displacement;
the other three resolve through their original centerward targets. Exact physical
coordinates are covered and the remaining fifteen lights are unchanged.

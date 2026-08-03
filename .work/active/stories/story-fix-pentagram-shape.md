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

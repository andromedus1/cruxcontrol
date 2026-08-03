---
id: story-fix-pac-man-path-variance
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

# Vary Pac-Man maze paths

## Symptom

Pac-Man is physically recognizable, but each circuit repeats the same movement pattern.

## Root cause

Pac-Man still walks the original fixed bottom-up row serpentine and ignores its saved seed
and cycle index when choosing a route.

## Fix approach

Select deterministic vertical and diagonal maze weaves per circuit using a Pac-Man-specific
seed offset. Preserve direction, mouth/color behavior, target masks, and seven-light reserve.

## Regression test

Spatial-frame coverage proves at least three distinct deterministic paths across four
consecutive circuits and retains the footprint bound.

## Implementation notes

- **Execution capability**: host-owned focused procedural-motion repair in the shared
  spatial renderer.
- **Root cause confirmed**: Pac-Man ignored its saved seed/cycle when selecting the fixed
  row-serpentine route.
- **Fix**: Pac-Man now rotates through the shared vertical/diagonal weave vocabulary using
  a Pac-Man-specific seed offset, distinct from Snake's route sequence.
- **Regression evidence**: the path-variance test failed with one repeated path before the
  fix and now proves at least three deterministic routes across four circuits.
- **Verification**: 68 files / 429 tests, typecheck, zero-warning lint, and PWA build pass.
- **Bounded inline review**: approved. Direction, palette, target masks, cadence, saved
  reproducibility, and seven-light reserve remain unchanged.

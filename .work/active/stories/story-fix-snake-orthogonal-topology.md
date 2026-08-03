---
id: story-fix-snake-orthogonal-topology
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

# Give Snake and Pac-Man orthogonal grid movement

## Symptom

Snake and Pac-Man are recognizable and varied, but their diagonal weave does not move like
the classic grid games. Movement should follow horizontal/vertical segments and turn at
90° angles.

## Root cause

The variance repair uses diagonal definition-wide weave orderings. The Fullride grid is
checkerboard-staggered, so traversing every adjacent row also inherently creates diagonal
links.

## Fix approach

Build shared row/column serpentines on alternating parity sub-grids. Each sub-grid has
axis-aligned 8-unit neighbors, enabling strict Manhattan steps and 90° turns. Give Snake
and Pac-Man independent seeded rotations through parity, axis, and direction variants
while preserving their seven-light reserves.

## Regression test

Sample successive Snake and Pac-Man heads across board frames and prove every changed step
has either zero X delta or zero Y delta, never both, while consecutive circuits still vary.

## Implementation notes

Both games now use seeded depth-first walks over the board's nearest horizontal/vertical
neighbors. Every 500 ms board pose advances at most one graph edge, while each new circuit
changes its start and turn preference without introducing diagonal movement.

## Verification

Dedicated 80-frame topology regressions pass for Snake and Pac-Man. The full 442-test
suite, typecheck, lint, and production PWA build also pass.

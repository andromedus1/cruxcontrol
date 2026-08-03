---
id: story-fix-matrix-ball-pong-variance
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

# Vary Matrix Rain, Beach Ball, and Pong motion

## Symptom

Physical dogfooding found Matrix Rain, Beach Ball, and Pong visually successful but too
repetitive across cycles.

## Root cause

All three recipes reduce elapsed time to a repeating phase while using fixed column
phases or trajectory ratios. Their saved seed and cycle index do not vary later passes.

## Fix approach

Derive deterministic per-cycle profiles from each saved seed: Matrix column timing and
wind, Beach Ball X/Y bounce rates and offsets, and Pong rally angle/vertical rhythm.
Keep recipe controls, cadence, targeting, palettes, and light reserves unchanged.

## Regression test

Spatial-frame coverage samples identical phases across four cycles for all three recipes,
proving at least three distinct deterministic paths within each declared footprint.

## Implementation notes

Matrix now varies column phases and wind by saved seed and cycle. Beach Ball varies its
two bounce rates and offsets; Pong varies its vertical rally rhythm and entry offset.
All remain deterministic for a saved seed and preserve their declared reserves.

## Verification

Focused spatial coverage and the full 442-test suite pass, along with typecheck, lint,
and production PWA build.

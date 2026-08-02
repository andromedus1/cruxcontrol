---
id: story-fix-fullride-artwork-ring-contrast
kind: story
stage: done
tags: [bug, ui]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Give private Fullride artwork a dark LED backdrop

## Symptom

The recognizable Fullride artwork is useful, but its white background makes white and
yellow LED rings difficult to see on the hold map.

## Root cause

`BoardRenderer` displays the immutable reference PNG without a presentation transform.
The source's near-white sheet therefore sits directly beneath bright semantic/custom
selection rings and collapses their luminance contrast.

## Fix approach

Apply a renderer-only dark-background color treatment to the exact private raster. Keep
the source bytes, calibration, semantic overlays, and schematic fallback unchanged. The
treatment inverts luminance while rotating hue back toward the source hold colors so the
pale sheet becomes dark and the photographed silhouettes remain recognizable.

## Regression test

`web/src/board-renderer/BoardRenderer.fullride.test.tsx` asserts that the private raster
uses the dedicated dark-background treatment while a non-matching definition continues
to use only the schematic renderer.

## Implementation notes

- Execution capability: GPT-5.6 Codex xhigh; bounded renderer/CSS defect with one visual
  surface and no public-interface or persistence change.
- Files changed: `BoardRenderer.tsx`, `BoardRenderer.css`, focused renderer test, and
  current-state SPEC/ARCHITECTURE wording.
- The regression test failed before the fix because the raster lacked the dedicated
  dark-background class, then passed after the renderer-only filter was applied.
- Focused tests, typecheck, and production/PWA build pass. A 390×844 Chromium smoke shows
  recognizable hold silhouettes on a black field; a real foot-only/yellow selection is
  clearly visible above it. The immutable PNG, calibration, fallbacks, hit testing, and
  overlay colors are unchanged.
- Adjacent issues parked: none.

## Review

**Verdict**: Ready. Bounded standalone-story review found the change limited to the
private raster presentation layer. It preserves the exact source bytes, calibration,
schematic fallback, semantic overlays, and interaction authority. The regression test,
full 376-test suite, typecheck, lint, production/PWA build, and phone-sized visual
reproduction are green; no blocking or follow-up findings.

---
id: epic-route-creation-flashy-light-effect-demos-pentagram
kind: story
stage: done
tags: [ui, ble, data]
parent: epic-route-creation-flashy-light-effect-demos
depends_on: [epic-route-creation-flashy-light-effect-demos-spatial-engine]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-09-26
---

# Add a fading red pentagram preset

## Brief

Trace a circled inverted five-point pentagram with red lights and fade the complete
symbol in and out. The default 20-light reserve uses the full measured API-2 scene
budget; additional route/static lights require a smaller effect reserve.

## Design decisions

- **Geometry**: score placements by distance to the five normalized star chords, keeping
  the symbol definition-derived and portable across board geometry.
- **Fade**: all selected holds share one quantized red brightness at each 500 ms pose so
  the star breathes as a coherent symbol rather than chasing colors around its outline.
- **Persistence**: add a recipe-version-1 `pentagram` discriminant with editable fade rate.

## Acceptance criteria

- [x] The default pose selects at most 20 unique eligible placements around the circle and five star
  chords and uses red-only colors outside exact protected role-color values.
- [x] Brightness changes coherently over time while placement geometry stays stable.
- [x] Draft and portable codecs round-trip the recipe and reject invalid fade rates.

## Implementation notes

The renderer scores board placements against five normalized star chords, keeps the
nearest declared footprint stable, and applies one shared interpolated palette color to
the whole outline. The default 20-light reserve covers ten circle anchors and ten star-stroke anchors.
This matches the parent feature and physical-board refinement; review reconciled the stale reserve description.

## Verification

Focused coverage proves stable geometry, synchronized red-only fading, capacity bounds,
and both persistence round trips. The full 442-test suite, typecheck, lint, and production
PWA build pass.

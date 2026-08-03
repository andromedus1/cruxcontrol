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
updated: 2026-08-02
---

# Add a fading red pentagram preset

## Brief

Trace a five-point pentagram across the board with a sparse, capacity-safe set of red
lights and fade the complete symbol in and out. Default to a 15-light reserve so the shape
remains readable while leaving five measured API-2 lights available for a climb or other
decoration; users may edit the reserve up to the full 20-light ceiling.

## Design decisions

- **Geometry**: score placements by distance to the five normalized star chords, keeping
  the symbol definition-derived and portable across board geometry.
- **Fade**: all selected holds share one quantized red brightness at each 500 ms pose so
  the star breathes as a coherent symbol rather than chasing colors around its outline.
- **Persistence**: add a recipe-version-1 `pentagram` discriminant with editable fade rate.

## Acceptance criteria

- [x] The default pose selects at most 15 unique eligible placements around all five star
  chords and uses red-only colors outside exact protected role-color values.
- [x] Brightness changes coherently over time while placement geometry stays stable.
- [x] Draft and portable codecs round-trip the recipe and reject invalid fade rates.

## Implementation notes

The renderer scores board placements against five normalized star chords, keeps the
nearest declared footprint stable, and applies one shared interpolated palette color to
the whole outline. The default 15-light reserve leaves five measured API-2 scene slots.

## Verification

Focused coverage proves stable geometry, synchronized red-only fading, capacity bounds,
and both persistence round trips. The full 442-test suite, typecheck, lint, and production
PWA build pass.

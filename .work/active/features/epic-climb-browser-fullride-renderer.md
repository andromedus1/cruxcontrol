---
id: epic-climb-browser-fullride-renderer
kind: feature
stage: drafting
tags: [ui]
parent: epic-climb-browser
depends_on: [epic-universal-board-platform-domain-definition]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Fullride Definition-Driven Renderer

## Brief

Deliver the shared, responsive board renderer that turns the normalized Fullride
7x10 definition and a climb/light scene into a recognizable physical hold layout.
Catalog placement coordinates are authoritative for geometry and hit targets; the
complete source screenshot is preserved unchanged as a visual reference for hold
shape, orientation, spacing, and calibration. The rendered board always keeps
unselected physical holds visible and subdued while selected placements use green
start, blue middle, red/pink finish, and gold/yellow foot-only overlays.

This feature establishes one renderer that the climb viewer and route editor can
reuse, including optional hit testing needed by later editing. It does not query a
community catalog, persist drafts, encode Bluetooth commands, or introduce
additional board definitions. It must not make the screenshot's pixel positions the
domain source of truth or mutate the checked-in reference image.

## Epic context

- Parent epic: `epic-climb-browser`
- Position in epic: foundation feature; the local climb viewer and route editor
  consume its definition-driven visual and interaction surface.

## Inherited design decisions

- Render the complete recognizable Fullride physical hold layout; a colored-dot
  grid is not acceptable.
- Use catalog-backed placement coordinates as geometry authority and
  `docs/kilter_fullride_7x10.png` only as the preserved visual/calibration reference.
- Keep every unselected hold visible but subdued and support all four semantic
  roles: green start, blue middle, red/pink finish, gold/yellow foot-only.
- Consume a board definition rather than embedding vendor coordinates in the React
  component, while validating only the Fullride 7x10 in this milestone.
- Follow the locked Sumi & Plywood / Wave Console tokens and productive, calm,
  reduced-motion-compatible interaction language.

## Research briefs

- `docs/briefs/board-rendering-and-filtering.md` — definition geometry, SVG/overlay
  prior art, coordinate scaling, and renderer reuse.
- `docs/briefs/data-model.md` — placement-to-hole coordinate resolution and role
  semantics.
- `.research/analysis/landscapes/climbing-board-ecosystem.md` — provider/board
  boundary context.

## Foundation references

- `docs/ARCHITECTURE.md` — Board Renderer and definition-driven geometry.
- `docs/SPEC.md` — Climb Browser, Hold/Placement/Hole, and Fullride-first scope.
- `docs/PRINCIPLES.md` — definitions are data; provider details stay at adapters.

## Mockups

- Inherits design system: `.mockups/design-system/tokens.css`
- Selected responsive board treatment:
  `.mockups/screens/epic-climb-browser/option-hybrid.html`
- Physical visual reference: `docs/kilter_fullride_7x10.png`


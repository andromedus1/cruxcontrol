---
id: epic-climb-browser
kind: epic
stage: drafting
tags: [ui]
parent: null
depends_on: [epic-universal-board-platform]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-08-02
research_refs:
  - docs/briefs/data-model.md
  - docs/briefs/board-rendering-and-filtering.md
  - .research/analysis/landscapes/climbing-board-ecosystem.md
---

# Climb Browser: Browse, Render, Filter, Share

## Mockups

- Design system: `.mockups/design-system/`
  - Palette: Sumi & Plywood — Kanagawa Wave dark / Garage Floodlight light
  - Typography: Wave Console — IBM Plex Sans + IBM Plex Mono
  - Tokens locked: 2026-08-02
  - Components: compact touch-safe primitives + climb/domain components, locked 2026-08-02
  - Motion: productive + calm, motion-light, reduced-motion required, locked 2026-08-02
  - Screens: `.mockups/screens/epic-climb-browser/index.html`
  - Selected: responsive hybrid — option 1 on phone, option 3 on wide screens,
    option 2 as the dedicated full-detail route; option 4 reserved for Session mode.
- Fullride visual reference: `docs/kilter_fullride_7x10.png` (1126×1584,
  straight-on complete layout). Preserve the source image; derive renderer assets and
  align them to authoritative catalog placement/LED coordinates during implementation.

## Design decisions

- **Primary mobile surface**: list/search leads. Selecting a climb opens a detail
  surface with a large definition-driven board diagram and persistent “Light this
  climb” action.
- **Compatibility**: results default to the configured Fullride 7x10 installation and
  selected angle; incompatible layouts do not appear in ordinary browsing.
- **Visual system**: use the locked Sumi & Plywood / Wave Console design system,
  compact touch-safe components, and productive/calm motion.
- **Board rendering anatomy**: always show the complete physical hold layout using the
  verified Fullride reference image/hold assets. Overlay selected climb placements in
  their role colors; unselected holds remain visible but visually subdued. A colored-dot
  grid without physical holds is not an acceptable renderer. — confirmed 2026-08-02.
- **Kilter hold roles**: every rendered climb and its legend represent all four roles:
  green start, blue middle, red/pink finish, and gold/yellow foot-only. — confirmed
  2026-08-02.

## Brief

The core "view" capability and the official app's biggest weakness to beat: a fast,
responsive browser over the local catalog, a definition-driven 2D board renderer first
validated on the Fullride 7x10, powerful filtering, and shareable per-climb URLs.

When done, a user can browse the full catalog with grade/angle/quality/setter/etc.
filters, see any climb rendered on a board diagram, and share a link to a specific
climb. It does NOT cover lighting the physical board (epic-board-control), editing
climbs (epic-route-creation), or logging (epic-logbook) — but it provides the
selection + renderer surface those reuse.

## Research briefs

- `docs/briefs/data-model.md` — frames encoding, hold roles/colors, `holes`
  coordinates, `climb_stats` for filterable fields.
- **[brief written]** [board-rendering-and-filtering.md](../../../docs/briefs/board-rendering-and-filtering.md)
  — *Board rendering & catalog filtering.* The schema is covered but
  the rendering approach is not: mapping `holes`/placements (x, y) to a 2D board
  diagram for the Fullride 7x10 layout (Mainline + Auxiliary sets), role-color
  rendering, and responsive filtering over a local SQLite catalog of tens of thousands
  of climbs. **Climbdex** is the prime prior-art reference (search/query patterns +
  board rendering). Run `/research-pipeline:brief` before `/epic-design`.

## Foundation references

- `docs/ARCHITECTURE.md` — Module Map §4 (Board Renderer), §5 (Climb Browser).
- `docs/SPEC.md` — Capability 2 (Climb Browser); domain model (Climb, Hold/Placement,
  ClimbStats); shareable-URL constraint.

## Anticipated child features

Provisional:
- 2D board renderer for the Fullride 7x10 layout
- Catalog query + filter layer (grade/angle/quality/setter/hold-count/…)
- Browser UI (list + detail)
- Shareable climb-URL routing

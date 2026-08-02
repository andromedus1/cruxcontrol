---
id: epic-climb-browser
kind: epic
stage: review
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

The first-milestone "view" capability: a definition-driven 2D board renderer first
validated on the Fullride 7x10, plus a responsive local climb list and detail surface
that route creation and board control can compose into the create-save-light loop.

When done, a user can select a local climb and see it on a recognizable Fullride
diagram. It does NOT cover lighting the physical board (epic-board-control), editing
or persisting climbs (epic-route-creation), or logging (epic-logbook), but it provides
the selection and renderer surfaces those reuse. The broad community-catalog filter
matrix and shareable provider-climb URLs are deferred until catalog acquisition is
back in scope; this decomposition keeps their normalized input and routing seams open.

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

## Decomposition

Split at the reusable visual boundary. The renderer owns definition geometry,
recognizable hold artwork, role overlays, responsive scaling, and optional hit
testing. The local viewer owns list/detail composition and navigation over normalized
climb inputs. This is intentionally smaller than the provisional community-browser
plan: catalog filtering and provider-climb sharing are not required to create, save,
and light a local climb and would pull catalog bootstrap into the critical path.

### Child features

- `epic-climb-browser-fullride-renderer` — recognizable definition-driven Fullride
  renderer and interaction surface — depends on:
  `[epic-universal-board-platform-domain-definition]`
- `epic-climb-browser-local-climb-viewer` — responsive local climb list/detail shell
  over normalized climbs — depends on: `[epic-climb-browser-fullride-renderer]`

### Decomposition risks

- **Geometry/visual drift is the trickiest risk.** The catalog mapping must remain
  authoritative while the screenshot is used to validate recognizable silhouettes
  and alignment. Visual extraction must not silently replace placement identity or
  LED mapping.
- **Reference-image rights remain distinct from technical access.** Preserve the
  source unchanged and keep derived renderer assets separable so public distribution
  can use independently produced artwork or pause if redistribution provenance is
  not established.
- **Deferred catalog scope could leak into the local viewer.** The viewer must consume
  normalized records through a narrow source boundary rather than query provider SQL,
  preserving a clean later path to filtering and shareable provider-climb URLs.

## Child features reviewed and complete

- `epic-climb-browser-fullride-renderer` — definition-driven 305-hold Fullride
  rendering, role/custom overlays, view/select accessibility, and responsive geometry
  approved.
- `epic-climb-browser-local-climb-viewer` — source-neutral controlled list/detail,
  responsive split/modal lifecycle, explicit board-control status/actions, and honest
  local empty state approved.

Both direct child features are done, so this epic is ready for its separate aggregate
review.

---
id: epic-climb-browser
kind: epic
stage: drafting
tags: [ui, needs-brief]
parent: null
depends_on: [epic-foundation]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
---

# Climb Browser: Browse, Render, Filter, Share

## Brief

The core "view" capability and the official app's biggest weakness to beat: a fast,
responsive browser over the local catalog, a 2D board renderer showing hold positions
and roles for the Fullride 7x10, powerful filtering, and shareable per-climb URLs.

When done, a user can browse the full catalog with grade/angle/quality/setter/etc.
filters, see any climb rendered on a board diagram, and share a link to a specific
climb. It does NOT cover lighting the physical board (epic-board-control), editing
climbs (epic-route-creation), or logging (epic-logbook) — but it provides the
selection + renderer surface those reuse.

## Research briefs

- `docs/briefs/data-model.md` — frames encoding, hold roles/colors, `holes`
  coordinates, `climb_stats` for filterable fields.
- **[needs-brief]** — *Board rendering & catalog filtering.* The schema is covered but
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

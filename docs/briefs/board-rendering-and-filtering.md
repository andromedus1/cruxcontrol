---
description: Read before designing epic-climb-browser — how to render the 2D board and filter the catalog, grounded in Climbdex prior art
type: brief
kind: research
slug: board-rendering-and-filtering
research_method: /brief
verification_status: attested
provenance: agent-synthesis
updated: 2026-06-13
nav_priority: high
blocks_phase: epic-climb-browser
summary: |
  Curates the climb-browser layer: Climbdex is the prime prior-art reference for
  board rendering (image + positioned hold overlays driven by the holes/placements
  coordinates) and filter-by-hold (URL-param-encoded, bookmarkable). Establishes the
  rendering data flow from the schema and flags that exact coordinate-mapping math
  must be read from Climbdex's source rather than any doc.
key_findings:
  - "Climbdex is the prior-art reference: filter-by-hold over a BoardLib SQLite DB, filter state encoded in URL query params (bookmarkable)."
  - "Rendering = a board background image + holds positioned by their holes (x,y) coordinates per the layout/product_size."
  - "Climbdex stack is Flask/Python + Jinja + JS; our renderer is client-side over the local OPFS SQLite read path instead."
  - "Filtering runs as SQL over the local catalog — grade/angle/quality/setter plus hold-presence; shareable URLs fall out of URL-encoded filter + climb id."
  - "Exact hold coordinate→screen mapping and image assets must be read from Climbdex's source; the README does not specify them."
status: draft
---

# Brief: Board Rendering & Catalog Filtering (Climb Browser)

## Purpose

Unblocks **epic-climb-browser** (`[needs-brief]`). [data-model.md](data-model.md)
owns the schema (climbs, `frames`, `holes` coordinates, `climb_stats`, layouts/
product sizes). This brief curates the two things that brief doesn't: how to **render**
the Fullride 7x10 board in 2D, and how to **filter** the catalog responsively — both
grounded in the prime prior-art implementation, Climbdex.

---

## 1. Climbdex as prior art

**Climbdex** (`lemeryfertitta/Climbdex`) is an open-source search engine for Aurora
boards whose headline feature is exactly what the official app lacks: "a 'filter by
hold' feature" `[climbdex]{2}`. Its mechanics to mirror:

- **Filter by hold:** "select holds to require them to be present in the resulting
  climbs, and click multiple times on a hold to change the color. Filters are stored
  in query params such that a specific search or setup can be bookmarked"
  `[climbdex]{2}`. This *is* the shareable-URL mechanism — filter + selection live in
  the URL.
- **Data source:** "The climb databases are downloaded and synchronized using the
  BoardLib Python library" `[climbdex]{2}` — same catalog we use.
- **Stack (theirs):** Flask/Python backend + Jinja templates + JavaScript frontend
  `[climbdex]{2}`. **Ours differs:** a client-only SPA querying the local OPFS SQLite
  directly (foundation brief) — no Flask server. Climbdex is a reference for *what*
  to render/query, not a stack to copy.

> The README does not specify the exact hold coordinate→pixel mapping or where the
> board background images come from. **Read Climbdex's source** (its templates + JS
> + how it uses the `holes`/`product_sizes` tables) for the concrete rendering math.

## 2. Rendering the board (data flow)

From the schema (data-model.md): a board layout for a given product size has holds
at `holes` (x, y) coordinates; a climb's `frames` string encodes which placements
are lit and in which role (start/middle/finish/foot-only) with role colors.

Rendering approach (the established pattern):
1. Draw the **board background image** for the Fullride 7x10 layout (Mainline +
   Auxiliary sets).
2. Overlay a **positioned marker per hold** using the `holes` (x, y) coordinates,
   scaled to the rendered image dimensions.
3. For a given climb, color the markers of its `frames` placements by role; dim/hide
   the rest. The same renderer serves browse, editor (epic-route-creation), and
   playlist play-through (epic-playlists).

An SVG/absolute-positioned-overlay over the image is the natural fit (crisp scaling,
hit-testing for the editor's tap-to-place). Confirm coordinate origin/scale against
Climbdex's source and the actual `holes` values.

## 3. Filtering over the local catalog

Filters are **SQL queries over the local OPFS SQLite** (no server): grade range,
angle, quality, ascent count, setter, hold count, grade-consensus accuracy (SPEC
Capability 2), plus **hold-presence** filtering (the Climbdex feature — climbs whose
`frames` include selected placements in selected roles). Index/optimize for the
common filters; the read path is in a Web Worker (foundation brief), so keep filter
queries parameterized and paged for responsiveness over tens of thousands of climbs.

Shareable per-climb URLs and shareable filter state both fall out of URL encoding
(climb id; filter params) — the same approach Climbdex uses `[climbdex]{2}`.

---

## Implementation Notes

- **Read Climbdex source** for: board image assets, the hold coordinate→screen
  transform, and its hold-filter SQL. It is the single best reference; budget time to
  read it before designing the renderer.
- **Shared renderer component.** Build the 2D board renderer once (image + role-colored
  hold overlay + optional hit-testing); reuse across browser, editor, and playlists.
- **Filter = parameterized SQL.** Run filters against the Worker-hosted SQLite via the
  data-layer port; page results; debounce hold-selection changes.
- **URL is state.** Encode the active filter and selected climb in the URL → shareable
  + bookmarkable for free, matching Climbdex.
- **Layout-specific.** Target the Fullride 7x10 layout (Mainline + Auxiliary) per SPEC;
  pull its holds/placements from the layout/product_size rows.
- **Cross-reference:** [data-model.md](data-model.md) (schema, frames, holes,
  climb_stats) and [foundation-pwa-sqlite.md](foundation-pwa-sqlite.md) (the Worker
  SQLite read path the filters run on).

---

## Sources

1. lemeryfertitta/Climbdex — search engine for training-board climbs. `[climbdex]{2}` — https://github.com/lemeryfertitta/Climbdex
2. lemeryfertitta/BoardLib — catalog source. `[boardlib]{1}` — https://github.com/lemeryfertitta/BoardLib
3. (cross-ref) [data-model.md](data-model.md), [foundation-pwa-sqlite.md](foundation-pwa-sqlite.md).

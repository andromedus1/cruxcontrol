---
id: epic-climb-browser-local-climb-viewer
kind: feature
stage: drafting
tags: [ui]
parent: epic-climb-browser
depends_on: [epic-climb-browser-fullride-renderer]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Local Climb List and Detail Viewer

## Brief

Deliver the first-milestone responsive climb-viewing surface: a compact local list,
selection state, and climb detail built around the shared Fullride renderer. On a
phone, the list leads into a bottom-sheet or dedicated detail surface; wider screens
use the approved split field-console layout. The detail keeps the board prominent
and exposes the persistent light action through the board-control integration point.

The viewer consumes normalized climb records so locally created drafts can appear
without a community catalog or Kilter account. It establishes routing/state shapes
that can later admit namespaced community climbs, but this feature does not implement
the full community-catalog query/filter matrix, Kilter sync, publication, playlists,
sessions, or cross-provider browsing. Draft persistence and authoring belong to
`epic-route-creation`; physical lighting belongs to `epic-board-control`.

## Epic context

- Parent epic: `epic-climb-browser`
- Position in epic: consumer of `epic-climb-browser-fullride-renderer`; supplies the
  reusable selection/detail shell composed later by local draft creation and board
  control.

## Inherited design decisions

- Mobile is list-led with a board-forward detail and persistent “Light this climb”
  action; wide screens use the approved split console and full detail remains a
  dedicated route.
- Show only the configured Fullride 7x10 installation/angle in the first milestone.
- Always show the recognizable full hold layout and all four role colors in the
  board and legend.
- Keep the input boundary normalized and namespaced so adding community catalog
  records later does not change the viewer contract.
- Full community catalog filters and shareable provider-climb URLs are deliberately
  deferred so they do not block the local create-save-light loop.

## Research briefs

- `docs/briefs/board-rendering-and-filtering.md` — responsive list/detail prior art,
  URL-state direction, and renderer composition.
- `docs/briefs/data-model.md` — normalized climb metadata and placement roles.

## Foundation references

- `docs/ARCHITECTURE.md` — Climb Browser and Board Renderer module boundaries.
- `docs/SPEC.md` — Climb Browser and namespaced climb identities.

## Mockups

- Inherits design system: `.mockups/design-system/tokens.css`
- Selected responsive composition:
  `.mockups/screens/epic-climb-browser/option-hybrid.html`
- Dedicated detail reference:
  `.mockups/screens/epic-climb-browser/option-2.html`


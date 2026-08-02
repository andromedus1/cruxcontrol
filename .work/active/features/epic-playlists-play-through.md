---
id: epic-playlists-play-through
kind: feature
stage: drafting
tags: [ui, ble]
parent: epic-playlists
depends_on: [epic-playlists-local-library, epic-board-control]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Playlist Board Play-Through

## Brief

Let a connected user step forward and backward through a playlist, inspect each climb,
and light it on the configured board through the existing controller. Without a board
connection the same ordered browsing flow remains usable. Missing provider climbs and
trashed local climbs stay visibly unavailable and are skipped only by explicit user
navigation; play-through never rewrites membership.

## Epic context

- Parent epic: `epic-playlists`
- Position in epic: consumer of the verified playlist library and board controller.

## Inherited design decisions

- Board connection is optional; browsing and ordering remain useful offline.
- Unavailable entries remain in the list and retain their order.
- Mockups pending under active autopilot; reuse existing climb detail and board-control
  patterns.

## Research briefs

- `docs/briefs/board-control-web-bluetooth.md`

## Foundation references

- `docs/SPEC.md` — Playlist play-through and board control.
- `docs/ARCHITECTURE.md` — Playlists consuming renderer/controller boundaries.

## Mockups

- Inherits design system: `.mockups/design-system/`
- Parent UI alignment: `.work/active/epics/epic-playlists.md`

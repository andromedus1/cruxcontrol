---
id: swipe-between-climbs
kind: feature
stage: drafting
tags: [ui]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-10-20
updated: 2026-10-20
---

# Swipe between climbs

## Brief

When a climb is up but not in the edit screen, Andrew wants to swipe left or right to
get the next or previous climb in the list it was opened from (promoted from
`idea-swipe-between-climbs`, 2026-10-20; queued as the next feature after the
catalog-sync arc). The viewing surfaces today are the catalog climb detail
(`web/src/catalog/CatalogBrowser.tsx` → `web/src/climb-browser/ClimbDetail.tsx`), the
local climb viewer for My Climbs (`web/src/climb-browser/LocalClimbViewer.tsx`), and
playlist play-through (`web/src/playlists/PlaylistPlayThrough.tsx`), which already has
explicit previous/next controls.

Moving to a neighbor should behave like selecting it from the list: the detail updates,
and when the board is connected the selected climb lights as it does today. "The list"
means the list as currently shown (filters, sort and angle), including catalog results
beyond the loaded page. The edit screen is out of scope, and nothing changes saved
climbs or playlists.

The gesture must coexist with the board view's existing touch handling
(`web/src/board-renderer/BoardRenderer.tsx`) and with vertical scrolling, and needs a
non-gesture equivalent for keyboard and accessibility users.

## Simplification opportunity

Play-through already implements ordered previous/next with boundary focus handling; a
shared "position in list" navigator could serve play-through, catalog detail and the
local viewer instead of three variants. Decide in feature design whether play-through
adopts it or only gains the gesture.

---
id: idea-playlist-play-through-boundary-focus
kind: story
stage: implementing
tags: [ui]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-09-26
---

# Playlist play through boundary focus

## Brief
Improve keyboard focus at playlist play-through boundaries. When Previous or Next becomes
disabled while it owns focus, move focus predictably to the sibling navigation control or
the position status instead of allowing it to fall back to the document body. Consider
including the current climb identity in the live position announcement. This was accepted
as a low-severity accessibility follow-up during the standard review of
`epic-playlists-play-through`; exact-order navigation and board-light safety are unaffected.

## Delivery scope
Authorized in the everyday-reliability cleanup. Preserve stored library data and existing visual structure. Add focused regression evidence and complete the applicable review lane.

## Simplification opportunity
Repair the existing path directly; no new subsystem.

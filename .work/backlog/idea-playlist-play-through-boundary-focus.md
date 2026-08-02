---
id: idea-playlist-play-through-boundary-focus
created: 2026-08-02
updated: 2026-08-02
tags: [ui]
---

Improve keyboard focus at playlist play-through boundaries. When Previous or Next becomes
disabled while it owns focus, move focus predictably to the sibling navigation control or
the position status instead of allowing it to fall back to the document body. Consider
including the current climb identity in the live position announcement. This was accepted
as a low-severity accessibility follow-up during the standard review of
`epic-playlists-play-through`; exact-order navigation and board-light safety are unaffected.

---
id: idea-playlist-play-through-boundary-focus
kind: story
stage: done
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

## Implementation notes (2026-09-26)
Root cause: navigation disabled the focused button at the ends without assigning a new focus target. Capture focus ownership on navigation and use a layout effect after the state commit to focus the enabled sibling, with a status fallback. Position status also announces the climb identity.

Regression: PlaylistPlayThrough.test.tsx first failed when Next stayed focused after becoming disabled; all 6 tests now pass, including both boundaries and not stealing focus elsewhere. The production-browser playlist journey now exercises Enter-based navigation/focus at both boundaries. Bounded inline review confirms stable entry order, no writes, and no controller semantics changed.

Execution: cohesive inline host implementation, project standard weight with bounded standalone review (no independent story reviewer). Full repository/browser/CI verification pending final integration; no adjacent issues bundled.

## Review closure (2026-09-26)

**Verdict**: Approve.

Bounded inline standalone review: focus follows the enabled sibling only when navigation owns focus; exact order and persistence are unchanged. Chromium keyboard regression passes.

**Blockers**: none unresolved. **Important**: none. **Review weight**: standard, from project convention (standalone stories use bounded inline review).

**Verification**: 85 Vitest files / 662 tests; lint; TypeScript/Vite/PWA production build; all 13 Chromium workflows. GitHub CI run [36249285638](https://github.com/andromedus1/cruxcontrol/actions/runs/36249285638) passed for application commit `93cda6a`. No phone maintenance or user-data migration occurred.

---
id: swipe-between-climbs-playthrough
kind: story
stage: done
tags: [ui]
parent: swipe-between-climbs
depends_on: [swipe-between-climbs-core]
release_binding: null
gate_origin: null
created: 2026-10-20
updated: 2026-10-20
---

# Play-through swipe and keys

## Brief
See the parent feature `swipe-between-climbs`, Unit 3.

## Implementation
Parent feature, Unit 3.

## Evidence

- `PlaylistPlayThrough` builds a `ClimbNavigation` from its existing `move`/bounds and
  feeds it to the shared `useClimbNavigationInput` on a body wrapper around its own
  navigation and the current entry, so swipes and ArrowLeft/ArrowRight work on available
  climbs and unavailable placeholders alike. The inner `ClimbDetail` gets no navigation,
  so no second set of ‹ › controls appears. Key moves reuse the buttons' boundary focus
  rule; "First climb"/"Last climb" is appended to the existing polite status; the end
  nudge is shared (suppressed under reduced motion).
- Design note: the gesture zone is the play-through body rather than `ClimbDetail`
  itself, because placeholders are not `ClimbDetail`s; the path is still the single
  `move` the buttons use.
- Tests: two new cases (swipe order/bounds incl. placeholders and end announcements;
  arrow keys, focus kept in the body, boundary focus). All six existing play-through
  tests unchanged and green. `npm test`: 1025 passed, 1 skipped; lint and typecheck clean.


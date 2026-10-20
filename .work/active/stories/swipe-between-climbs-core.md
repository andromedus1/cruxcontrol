---
id: swipe-between-climbs-core
kind: story
stage: done
tags: [ui]
parent: swipe-between-climbs
depends_on: []
release_binding: null
gate_origin: null
created: 2026-10-20
updated: 2026-10-20
---

# Shared climb navigation and My Climbs

## Brief
See the parent feature `swipe-between-climbs`, Unit 1.

## Implementation
Parent feature, Unit 1.

## Evidence

- `web/src/climb-browser/navigation.ts` (`listNavigation`, `ClimbNavigation`; moves may
  return `Promise<boolean>` so a paging surface can report a late-discovered end),
  `use-horizontal-swipe.ts` (56 px / 0.4 px/ms over 24 px flick, 1.5× dominance,
  ignored targets, post-swipe click suppression), `use-climb-navigation-input.ts`
  (shared swipe + ArrowLeft/ArrowRight + nudge + "First climb"/"Last climb").
- `ClimbDetail` is now a persistent shell (board bar, ‹ › header with polite position
  status, swipe zone, keys) around per-climb content keyed by climb key, so lighting
  restarts per climb while focus and the gesture zone survive the move. End buttons use
  `aria-disabled` (still focusable, so activating them gives the end feedback).
- `LocalClimbViewer` builds navigation from `climbs` (My Climbs = `compatibleDrafts`
  order) with an optional `navigationOverride`; Close returns focus to the climb now shown.
- Tests: `navigation.test.ts`, `use-horizontal-swipe.test.tsx`, new `ClimbDetail` and
  `LocalClimbViewer` cases (neighbor selection, keys, swipes, ends, reduced motion,
  relight and debounced relight on fast moves). `npm test`: 1015 passed, 1 skipped;
  lint and typecheck clean.


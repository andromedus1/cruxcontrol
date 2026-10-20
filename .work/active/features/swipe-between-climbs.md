---
id: swipe-between-climbs
kind: feature
stage: implementing
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

## Design decisions

Operator answers, 2026-10-20:

- **Surfaces**: everywhere a climb is shown — catalog climb detail (next/previous result
  in the current search, across pages), My Climbs viewer (the visible list), and playlist
  play-through (gesture added beside the existing ‹ › buttons).
- **Gesture zone**: anywhere on a viewed climb unless the board is zoomed. Viewed climbs
  never pass `scale`/`onScaleChange` to `BoardRenderer`, so the board there has no touch
  handlers and is always at scale 1 — the swipe owns horizontal drags on the whole detail.
  If a zoomable board is ever added to the viewer, its pan wins while `scale > 1`.
- **Ends**: stop with a short nudge (suppressed under reduced motion) and announce "First
  climb" / "Last climb". Catalog swiping forward loads the next page.
- **Buttons**: compact ‹ › in the detail header with a position ("12 of 340"; catalog
  "12 of 50+" while later pages exist), plus ArrowLeft/ArrowRight keys.

Derived:

- Moving behaves like selecting from the list: the detail remounts for the new climb and
  existing auto-lighting relights it (180 ms debounce, so fast swipes light only where
  you stop). Saved climbs, playlists and Back behavior are unchanged.
- Swipe recognition: pointer events (touch/pen) on the detail container; horizontal
  travel ≥ 56 px or a fast flick (≥ 0.4 px/ms over ≥ 24 px) with horizontal dominance
  (|dx| ≥ 1.5·|dy|); vertical scrolling and taps are untouched; ignored when the gesture
  starts in a text field, slider, select or another element marked `data-no-swipe`.
- Arrow keys act only when focus is within the detail and not in a text input, so they
  never collide with list or form keyboard use.
- No mockups: the change is two compact header buttons and a position label on the
  existing detail sheet, reusing existing button and status styles.

## Architectural choice

A small shared layer — `useClimbNavigation` (bounds, position label, announcements) and
`useHorizontalSwipe` (gesture recognition) — feeds an optional `navigation` prop on
`ClimbDetail`, which renders the ‹ › header and wires swipe/keys. Each surface supplies
only its own "go to neighbor" behavior. Alternatives: (B) per-surface gesture code —
three divergent implementations of the same thresholds; (C) a CSS scroll-snap carousel
of neighboring details — would mount several boards and fight auto-lighting.

## Implementation Units

### Unit 1 (story `swipe-between-climbs-core`): shared navigation and My Climbs
- `web/src/climb-browser/use-horizontal-swipe.ts`
  ```ts
  export interface SwipeOptions {
    readonly enabled: boolean;
    readonly onSwipe: (direction: 'previous' | 'next') => void;
  }
  export function useHorizontalSwipe<T extends HTMLElement>(options: SwipeOptions): React.RefCallback<T>;
  ```
- `web/src/climb-browser/navigation.ts`
  ```ts
  export interface ClimbNavigation {
    readonly positionLabel: string;          // "12 of 340" | "12 of 50+"
    readonly canPrevious: boolean;
    readonly canNext: boolean;
    readonly onPrevious: () => void;
    readonly onNext: () => void;
  }
  export function listNavigation<K>(keys: readonly K[], current: K, select: (key: K) => void,
    options?: { readonly more?: boolean; readonly onNextBeyond?: () => void;
                readonly onPreviousBeyond?: () => void; readonly offset?: number }): ClimbNavigation | null;
  ```
- `ClimbDetail.tsx`: optional `navigation?: ClimbNavigation`; header ‹ › buttons with
  accessible names ("Previous climb" / "Next climb"), position in a polite status
  region, swipe + ArrowLeft/ArrowRight, end nudge (`climb-detail--nudge` class, reduced
  motion respected) and "First climb"/"Last climb" announcement.
- `LocalClimbViewer.tsx`: builds navigation from its `climbs` order and
  `onSelectedKeyChange`; optional `navigationOverride` prop for callers with paging.
- Tests: swipe thresholds/dominance/ignored targets, keys, bounds/announcements, My
  Climbs neighbor selection and relight on change.

### Unit 2 (story `swipe-between-climbs-catalog`): catalog across pages
- `CatalogBrowser.tsx`: navigation over `visibleRows`; at the last row with
  `nextCursor`, advance the page and select its first row; at the first row of page > 1,
  go back a page and select its last row. A pending-selection ref (`'first' | 'last'`)
  survives the page query that currently clears selection; manual page buttons keep
  today's clearing. Position offset = rows on earlier pages in this query's history; label
  shows "+" while `nextCursor` exists. Empty next pages (all rows excluded) continue to the
  following page, consistent with existing continuation.
- Tests: within-page moves, forward and backward page crossing, end of results, query
  changes cancel pending selection, stale responses ignored.

### Unit 3 (story `swipe-between-climbs-playthrough`): play-through
- `PlaylistPlayThrough.tsx`: pass a `ClimbNavigation` built from its existing
  `move`/bounds so swipe, keys and the header share one path; keep its existing buttons,
  boundary focus behavior and unavailable-entry placeholders (swipe works on placeholder
  entries too). Avoid duplicate controls: the detail header shows ‹ › only when the
  surface does not already render its own.
- Tests: swipe moves and respects bounds; existing play-through tests stay green.

### Unit 4: docs
- `docs/SPEC.md` §2/§8 and README "What works now" mention swipe/‹ › navigation.

## Implementation Order

Core (shared hook, detail header, My Climbs) → catalog paging → play-through → docs.

## Testing

Vitest + Testing Library with `fireEvent.pointerDown/Move/Up` (pointerType `touch`) for
gestures; keyboard via `fireEvent.keyDown`. Playwright: one phone-viewport check that a
swipe on catalog detail advances to the next result (touch emulation), plus desktop arrow
keys. Existing catalog/play-through e2e remain green.

## Risks

- **Gesture false positives while scrolling** — dominance ratio and thresholds; tests on
  diagonal drags. **Fallback**: buttons and keys always work.
- **Catalog page crossing races** — pending selection keyed to the query adapter and page
  request; superseded responses are discarded as today.
- **Least sure**: feel of thresholds on the real phone; tune during the phone check.

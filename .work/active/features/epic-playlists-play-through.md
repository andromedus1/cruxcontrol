---
id: epic-playlists-play-through
kind: feature
stage: review
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

## Design decisions

- **Explicit lighting**: entering play-through and moving between entries never sends
  Bluetooth writes. The existing `Light this climb` action remains the deliberate
  hardware boundary, preventing a navigation tap or restored session from changing the
  wall unexpectedly.
- **Exact-order navigation**: Previous and Next move one persisted entry at a time,
  including Trash, missing, provider-unresolved, and incompatible entries. An unavailable
  entry has truthful recovery copy and disabled light/view actions; it is never silently
  skipped or removed.
- **Ephemeral position**: play-through position is component state keyed by the stable
  playlist reference key. It is not persisted into the playlist aggregate and therefore
  cannot conflict with list edits or turn browsing into a playlist write.
- **Connection optionality**: the current board-control bar and climb-detail lighting
  state remain the only controller UI. Play-through works disconnected; Connect remains
  a direct user-gesture action and lighting becomes available when the shared controller
  reports connected and idle.
- **One active list**: Start play-through applies to the selected list. Exit returns to
  its management view without changing selection, order, metadata, or membership.
- **UI fallback**: the parent explicitly pins reuse of the selected playlist workspace,
  climb detail, board-control bar, and locked design system. This is a bounded mode of an
  existing surface, so no additional mockup is required during autopilot.

## Architectural choice

Three shapes were considered. Routing every entry through the global climb library would
lose playlist-local position and cannot represent unresolved rows. Teaching
`LocalClimbViewer` about playlists would couple a general collection viewer to playlist
ordering and recovery semantics. A separate persistent session aggregate would add a
second consistency contract for state the user did not ask to resume.

The chosen shape is one playlist-owned play-through component. It receives already
resolved ordered entries, owns only an ephemeral reference key, and delegates render and
hardware behavior to the existing `ClimbDetail` and `BoardLightController`. This keeps
membership/order authoritative in `LocalPlaylist`, unavailable-row semantics authoritative
in `resolvePlaylistEntries`, and serialized BLE writes authoritative in the controller.

The trickiest unit is reconciliation while the selected playlist changes. Navigation uses
the stable `ResolvedPlaylistEntry.key`, derives the current index on every render, and falls
back to the entry at the prior bounded index only when that key disappears. It never writes
that repair back to IndexedDB.

## Implementation Units

### Unit 1: Ordered play-through state and accessible surface

**Files**: new `web/src/playlists/PlaylistPlayThrough.tsx`,
`web/src/playlists/PlaylistPlayThrough.test.tsx`, and `web/src/playlists/playlists.css`

```typescript
export interface PlaylistPlayThroughProps {
  readonly playlist: LocalPlaylist;
  readonly entries: readonly ResolvedPlaylistEntry[];
  readonly definition: BoardDefinition;
  readonly controller?: BoardLightController | null;
  readonly compatibilityIssue: (entry: ResolvedPlaylistEntry) => string | null;
  readonly onExit: () => void;
}

export function PlaylistPlayThrough(props: PlaylistPlayThroughProps): JSX.Element;
```

Render list name, `N of M`, Previous, Next, and Exit controls with 44px targets. Available
entries render the shared `ClimbDetail`, including its connection and explicit Light action.
Unavailable entries render the stored/resolved label, reference, reason, and navigation but
no fabricated board preview or controller action. Initial position is the first persisted
entry, not the first available entry. Empty lists cannot enter the mode.

**Acceptance Criteria**:

- [ ] Start, Previous, and Next traverse exact persisted order with truthful boundaries and
  position announcements; no navigation action mutates the repository or lights the board.
- [ ] Available entries reuse the full climb preview, connection state, and serialized
  explicit Light action; disconnected browsing remains complete.
- [ ] Trash, missing, unresolved-provider, and board-incompatible entries retain position
  and identity with clear unavailable reasons and no enabled light action.
- [ ] Entry removal/reorder received through props reconciles by stable key without a crash,
  stale climb, or playlist write.

### Unit 2: Playlist-library integration

**Files**: `web/src/playlists/PlaylistLibrary.tsx`,
`web/src/playlists/PlaylistLibrary.test.tsx`, `web/src/app/CruxControlWorkspace.tsx`,
and `web/e2e/local-route-editor.spec.ts`

```typescript
export interface PlaylistLibraryProps {
  // existing props remain
  readonly definition: BoardDefinition;
  readonly controller?: BoardLightController | null;
}
```

Add a `Play list` action for the selected non-empty list and compose the play-through
surface in place of metadata/reorder controls while active. The library continues resolving
entries from current repository/draft truth. Exiting restores management state; switching or
deleting the selected list exits safely.

**Acceptance Criteria**:

- [ ] A selected non-empty list can enter and exit play-through without changing list or
  climb data; empty lists present no enabled start action.
- [ ] Existing list CRUD, notes, membership, reorder, Trash/restore, edit, and direct-light
  flows remain available outside play-through.
- [ ] Compact Android and wide layouts keep the current entry, position, navigation, board
  status, and primary Light action legible without horizontal overflow.

## Implementation Order

1. Ordered play-through state and surface — prove unavailable-entry and reconciliation
   semantics before wiring the workspace.
2. Playlist-library integration — expose the mode through the existing selected-list shell.

No child stories are created: both units form one tightly coupled, single-stride UI feature
over stable repository and controller ports.

## Testing

- Component tests start at the first entry, traverse both boundaries, visit unavailable rows,
  exit, and reconcile reorder/removal by stable key.
- A mock `BoardLightController` proves navigation emits no writes, disconnected state keeps
  browsing active, and the explicit Light action sends exactly the current available climb.
- Playlist-library tests cover disabled empty start, mode entry/exit, and preserved management
  state. Existing CRUD and membership tests remain regression coverage.
- The production Chromium journey adds a compact play-through pass across two local climbs and
  verifies position/order survive reload without adding a persisted session field.

## Risks

- **Wrong climb lit after rapid navigation**: `ClimbDetail` is keyed to the current entry and
  its handler derives that entry's immutable assignments; controller writes remain serialized.
  **Fallback**: disable navigation only during the controller operation if testing reveals a
  stale closure, without persisting session state.
- **Selected entry disappears**: repository refresh can remove the current key. Reconcile to a
  bounded adjacent index and announce the new position rather than retaining a stale object.
- **Unavailable-entry ambiguity**: never infer availability from missing display fields; use the
  resolver status plus installation compatibility and show the specific reason.
- **Hardware verification**: CI proves controller calls through the mock port. Final physical
  confirmation remains a proportional smoke test on the home Fullride, not a reason to bypass
  the automated contract.

## Implementation notes

- Execution capability: GPT-5.6 Sol at xhigh reasoning, selected by the caller because
  the feature integrates exact-order resolver truth, responsive Android UI, and the
  serialized BLE controller boundary. Direct reading was sufficient for the cohesive
  implementation surface; no exploratory delegation was needed.
- Review weight: standard (caller and project convention); implementation stops at
  feature `stage: review` for the root agent's independent pass.
- Files changed: new `web/src/playlists/PlaylistPlayThrough.tsx` and focused tests;
  playlist-library composition/tests/CSS/export; workspace controller/definition wiring;
  the production Chromium journey; current-state `docs/SPEC.md` and
  `docs/ARCHITECTURE.md` assertions.
- Tests added/removed: added four component tests for exact-order unavailable traversal,
  explicit current-climb lighting, stable-key reorder/removal reconciliation, and
  incompatible-board suppression; extended the library test for empty gating and
  write-free entry/switch/exit behavior; extended the Chromium journey with compact
  play-through, overflow, immutable-storage, and ephemeral reload assertions. Removed none.
- Test integrity: observable headings, status text, button states, controller calls,
  repository calls, IndexedDB records, and viewport geometry are asserted. No tests were
  skipped, weakened, deleted, or made implementation-conditional.
- Simplification: play-through owns only one `{playlistId, key, index}` cursor and derives
  each render from current resolver props. It adds no repository, session aggregate,
  storage field, Bluetooth queue, preview path, or duplicated climb renderer/controller.
- Discrepancies from design: none. The compact active mode hides the list selector to keep
  list identity, position, navigation, board status, and Light action in the phone viewport;
  Exit restores management, while the wide selector remains available and switching exits.
- Adjacent issues parked: none.

## Integrated verification

- `npm test` — 49 files and 309 tests passed.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run build` — TypeScript and Vite production/PWA build passed.
- `npx playwright test` — all 3 Chromium journeys passed, including a 390×844
  two-climb play-through with no horizontal overflow, unchanged playlist membership/order,
  no persisted position/session field, and first-entry reset after reload.
- Acceptance walk-through: first persisted entry (including unavailable) starts at 1 of N;
  Previous/Next visit every Trash, missing-local, unresolved-provider, incompatible, and
  available row in order with truthful boundaries and announcements; stable keys survive
  reorder and bounded-index fallback handles removal; available rows reuse `ClimbDetail`,
  disconnected browsing remains complete, and only explicit Connect/Light actions touch the
  controller. Empty lists cannot enter, exit/switch restores management, and no play-through
  action changes playlist or climb data.

---
id: epic-climb-browser-local-climb-viewer
kind: feature
stage: implementing
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

## Design decisions

- **Read-model boundary**: the viewer accepts an immutable `ClimbViewRecord[]` and
  never imports SQLite, draft storage, provider SQL, or Kilter frame encoding. Route
  creation can project its locally authoritative drafts into this record without
  giving the viewer persistence ownership; future catalog adapters can do the same.
- **Identity and selection**: every record carries one opaque, stable `ClimbViewKey`.
  The list/detail component is controlled by `selectedKey` and `onSelectedKeyChange`,
  so its parent owns URL/history or draft-store integration. This milestone does not
  invent provider-climb URLs before a provider catalog exists.
- **Responsive composition**: one semantic list and one detail component serve both
  layouts. At `min-width: 900px` they form the approved split console; below it the
  selected detail becomes a modal bottom sheet. A dedicated `ClimbDetail` export
  provides the accepted board-forward full-detail composition for a later router
  without introducing a routing dependency now.
- **Renderable scene**: records carry placement-addressed `BoardHoldAssignment[]`.
  Empty and unconventional drafts are valid. The board is always present, all
  unselected physical holds stay visible, and role/custom colors are passed unchanged
  to the completed `BoardRenderer`.
- **Board-control seam**: the viewer consumes the existing `BoardLightController`
  directly when one is supplied; it does not duplicate controller state or methods.
  Connection remains an explicit top-bar action. “Light this climb” is persistent but
  disabled until connected, then sends a `LightScene` derived from role presets or
  the exact custom color. Unsupported, busy, disconnected, and error states are
  announced in place. The viewer does not acquire or construct a controller.
- **First empty/source states**: an empty record array explains that saved drafts will
  appear here and offers an injected “Create climb” action when available. No catalog
  install, sync, sample community climbs, filters, ratings, ascent counts, playlist
  action, or fabricated local data are required for this milestone.

## Architectural choice

Use a small controlled React feature module with a normalized presentation read model,
pure assignment-to-light conversion, and two components: `LocalClimbViewer` for list
selection/responsive composition and `ClimbDetail` for the board-forward detail. The
feature receives its board definition, records, selection, and optional existing light
controller as dependencies. It neither establishes another application service nor
reaches through those contracts to persistence, protocol bytes, Web Bluetooth, or
provider-native fields.

Three shapes were considered. A viewer that queries SQLite itself would provide data
immediately but couple the first local-only slice to a deferred community catalog and
make draft composition awkward. A route-specific page model with browser URLs would
prematurely choose serialization for local draft IDs and provider identities. A fully
generic render-prop shell would avoid ownership mistakes but move ordinary product
behavior into every caller. The chosen typed read model is the smallest stable seam:
one projection per source, one rendering implementation, and controlled selection
that a future router can adopt additively.

The trickiest unit is lighting the same visual scene without semantic or color drift.
`BoardRenderer` accepts role and custom appearances, while `BoardLightController`
accepts quantized hardware colors. One pure `lightSceneFromAssignments` converter
therefore validates placement identity through the definition, maps semantic roles
through `definition.rolePresets`, preserves custom `ApiLevel3Color` values exactly,
and rejects duplicate/unknown assignments before any controller write. Both preview
and hardware output are derived from the same immutable assignments.

## Implementation Units

### Unit 1: Local climb read model and light-scene projection

**Files**:

- `web/src/climb-browser/types.ts`
- `web/src/climb-browser/light-scene.ts`
- `web/src/climb-browser/index.ts`

```typescript
import type { BoardHoldAssignment } from '../board-renderer/types.ts';
import type { BoardDefinition } from '../domain/boards/definition.ts';
import type { Brand } from '../domain/boards/types.ts';
import type { LightScene } from '../domain/boards/light-scene.ts';

export type ClimbViewKey = Brand<string, 'ClimbViewKey'>;
export function climbViewKey(value: string): ClimbViewKey;

export interface ClimbViewRecord {
  readonly key: ClimbViewKey;
  readonly name: string;
  readonly angle: number;
  readonly assignments: readonly BoardHoldAssignment[];
  readonly origin: 'local-draft' | 'provider';
  readonly grade?: string;
  readonly setter?: string;
  readonly description?: string;
}

export function lightSceneFromAssignments(
  definition: BoardDefinition,
  assignments: readonly BoardHoldAssignment[],
): LightScene;
```

**Implementation Notes**:

- `climbViewKey` rejects empty/whitespace-only input and preserves the opaque value;
  source adapters own how local or provider identity becomes a stable key.
- `ClimbViewRecord` contains only detail/list fields justified by the local milestone.
  Optional future catalog metadata is added only when a real consumer needs it.
- `lightSceneFromAssignments` delegates duplicate/unknown placement validation to
  `createAssignmentIndex`, iterates assignments in input order, maps roles via the
  definition, and freezes the returned scene and entries. It accepts an empty scene
  and places no start/finish-count restrictions on drafts.

**Acceptance Criteria**:

- [ ] Local drafts and later provider climbs can satisfy one read contract without a
  bare numeric vendor ID or a viewer dependency on either storage implementation.
- [ ] All four semantic roles map to the definition's hardware colors, every custom
  API-level-3 color is unchanged, and empty/unconventional scenes remain valid.
- [ ] Duplicate and unknown placement IDs fail synchronously before controller I/O.

### Unit 2: Board-forward detail and controller status/action

**Files**:

- `web/src/climb-browser/ClimbDetail.tsx`
- `web/src/climb-browser/BoardControlBar.tsx`
- `web/src/climb-browser/use-board-light-state.ts`

```typescript
import type { BoardLightController } from '../board-control/light-controller.ts';
import type { BoardDefinition } from '../domain/boards/definition.ts';
import type { ClimbViewRecord } from './types.ts';

export interface ClimbDetailProps {
  readonly definition: BoardDefinition;
  readonly climb: ClimbViewRecord;
  readonly controller?: BoardLightController | null;
  readonly headingLevel?: 1 | 2;
}

export function ClimbDetail(props: ClimbDetailProps): JSX.Element;

export interface BoardControlBarProps {
  readonly controller?: BoardLightController | null;
}

export function BoardControlBar(props: BoardControlBarProps): JSX.Element;
```

**Implementation Notes**:

- `useBoardLightState(controller)` uses `useSyncExternalStore`; its subscribe and
  snapshot functions are stable for the current controller and return an inert
  unsupported snapshot when none is configured.
- `BoardControlBar` renders status text and an explicit Connect/Reconnect action for
  `disconnected`/recoverable `error`, progress labels for selecting/connecting/
  disconnecting, and the connected device name when available. It catches controller
  promises because the subscribed state owns user-facing errors; chooser cancellation
  is not rendered as a fatal page error.
- `ClimbDetail` always renders `BoardRenderer` in view mode with the full assignment
  scene, a four-role legend plus a “Custom colors” legend item only when present, and
  only truthful optional metadata. It renders no fabricated rating/community values.
- “Light this climb” remains in a sticky action region. It is enabled only for a
  connected idle controller, labels lighting/preview/clear work without double-submit,
  calls `controller.light(lightSceneFromAssignments(...))`, and exposes the current
  error through an `aria-live="polite"` status. An empty scene is a valid clear-board
  request and is labelled “Clear board” to make the effect explicit.

**Acceptance Criteria**:

- [ ] The recognizable full board is visible for selected climbs at phone and desktop
  widths, including empty drafts, role colors, and arbitrary custom colors.
- [ ] Connect is a separate explicit user action; rendering the component never opens
  a chooser, connects, writes, or accesses browser Bluetooth.
- [ ] Light is unavailable while unsupported/disconnected/busy, issues exactly one
  controller call when enabled, and every async/error state is visible and announced.
- [ ] Keyboard and screen-reader users can identify the climb, board, role legend,
  connection state, and available action without traversing 305 inactive holds.

### Unit 3: Controlled responsive list/detail shell

**Files**:

- `web/src/climb-browser/LocalClimbViewer.tsx`
- `web/src/climb-browser/LocalClimbViewer.css`
- `web/src/climb-browser/index.ts`

```typescript
import type { BoardLightController } from '../board-control/light-controller.ts';
import type { BoardDefinition } from '../domain/boards/definition.ts';
import type { ClimbViewKey, ClimbViewRecord } from './types.ts';

export interface LocalClimbViewerProps {
  readonly definition: BoardDefinition;
  readonly climbs: readonly ClimbViewRecord[];
  readonly selectedKey: ClimbViewKey | null;
  readonly onSelectedKeyChange: (key: ClimbViewKey | null) => void;
  readonly controller?: BoardLightController | null;
  readonly onCreateClimb?: () => void;
}

export function LocalClimbViewer(props: LocalClimbViewerProps): JSX.Element;
```

**Implementation Notes**:

- Validate unique record keys and that every record angle is finite and supported by
  the supplied definition. An absent/stale `selectedKey` shows the list with no detail
  rather than silently selecting or lighting another climb.
- Rows are native buttons in a labelled list; name, angle, optional grade/setter, and
  hold count are the compact fields. Selection calls the controlled callback once.
- At wide widths, the detail occupies the main pane. At narrow widths it is a native
  `<dialog>`-semantics modal sheet with labelled heading, close control, focus return,
  Escape dismissal, background inertness, and body-scroll containment. Use the
  platform dialog element when available; tests exercise observable semantics rather
  than animation internals.
- Reuse `.mockups/design-system/tokens.css` values as production CSS custom properties
  in this module; do not copy mock-only structure or invent a second palette. Motion
  is limited to opacity/translate under 180ms and removed under
  `prefers-reduced-motion: reduce`.
- Empty state and no-selection state are distinct. Empty state may invoke
  `onCreateClimb`; no-selection prompts the user to choose a saved draft.

**Acceptance Criteria**:

- [ ] Phone selection opens an accessible bottom-sheet detail; close/Escape returns
  focus to the originating row. At 900px and wider, the same selection appears in the
  split console with no duplicated list or detail state.
- [ ] Empty, no-selection, stale-selection, one-record, long-name, missing-optional-
  metadata, and custom-color records render without catalog or network access.
- [ ] Controlled selection never mutates records, owns no persistence, and exposes a
  stable seam for route creation or future browser-history composition.
- [ ] Minimum interactive target height is 44px, focus is visibly distinct, content
  remains usable at 200% zoom, and reduced-motion removes sheet animation.

### Unit 4: Minimal app composition without fake climbs

**Files**:

- `web/src/App.tsx`
- `web/src/App.css`

```typescript
import type { BoardLightController } from './board-control/light-controller.ts';
import type { BoardDefinition } from './domain/boards/definition.ts';
import type { ClimbViewRecord } from './climb-browser/types.ts';

export interface AppProps {
  readonly definition?: BoardDefinition;
  readonly climbs?: readonly ClimbViewRecord[];
  readonly controller?: BoardLightController | null;
  readonly onCreateClimb?: () => void;
}

export function App(props: AppProps): JSX.Element;
```

**Implementation Notes**:

- Default `definition` to the checked-in Fullride 7x10 definition and `climbs` to an
  empty immutable array. Do not manufacture catalog climbs or write draft storage.
- `App` owns only transient controlled selection for this first composition and passes
  optional dependencies through. Route creation later replaces the empty input with
  its local-store projection and create action without rewriting the viewer.
- Add the design-system theme variables, automatic light/dark preference, top-level
  page background, and mobile viewport-safe spacing. Keep service-worker registration
  and application boot behavior unchanged.

**Acceptance Criteria**:

- [ ] The shipped app opens as a responsive Fullride local-climb workspace with an
  honest empty state, no network/database requirement, and no Bluetooth side effects.
- [ ] Injected records/controller render and operate through public contracts; default
  app construction remains deterministic under tests and React Strict Mode.

## Implementation Order

1. **Read model and scene projection** — lock the source-neutral input and prove the
   role/custom-color hardware mapping before UI code can drift from it.
2. **Detail and board-control composition** — build the highest-value board-forward
   surface directly over completed renderer/controller contracts.
3. **Responsive shell** — add controlled selection and accessible split/sheet layouts
   around the proven detail.
4. **App composition** — replace the placeholder without taking ownership from the
   later route-editor or draft-persistence features.

No child stories are spawned: the four units share one compact presentation contract
and form a dependency chain rather than independent write sets. One implementation
owner avoids needless integration overhead.

## Testing

### Read-model and projection tests: `web/src/climb-browser/light-scene.test.ts`

- Empty scene; each semantic role; custom colors at `0` and `255`; preserved input
  order and immutability; duplicate and unknown placement failures; invalid view key.

### Detail tests: `web/src/climb-browser/ClimbDetail.test.tsx`

- Full board and truthful metadata/legend rendering; custom-color legend conditional;
  empty draft clear label; unsupported/disconnected/selecting/connecting/connected/
  busy/error controller states; explicit connect; one light call with the exact scene;
  rejected connect/write behavior and `aria-live` output.
- Use a real `createFullrideLightController` with `MockBoardByteTransport` for the
  integration seam where practical; use a narrow controller fake only for otherwise
  unreachable intermediate snapshots. Do not mock `BoardRenderer` in the primary
  detail test.

### Viewer tests: `web/src/climb-browser/LocalClimbViewer.test.tsx`

- Controlled selection, no implicit fallback on stale keys, duplicate/unsupported
  records, empty/create state, optional fields, close/Escape/focus return, and
  one semantic list/detail tree. CSS breakpoint visuals receive a Playwright/manual
  smoke check if no browser-level suite exists; jsdom tests do not claim layout proof.

### App tests: `web/src/App.test.tsx`

- Honest default empty workspace; injected climb selection/detail; no controller
  construction or call on render; existing heading/landmark and PWA boot assumptions.

### Verification

- Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` in `web/`.
- Manually inspect phone and desktop widths against the locked hybrid mock and verify
  light/dark plus reduced-motion modes before feature review.

## Risks

- **CSS-only responsiveness can hide dialog lifecycle bugs**: an open phone dialog
  cannot simply become a desktop pane when the media query changes. — **Fallback**:
  keep one controlled selection, close/remove modal behavior in a `matchMedia`
  subscription when entering desktop, and test that transition explicitly.
- **Controller state can tear or produce unhandled promise rejections**: BLE state is
  external and async. — **Fallback**: subscribe with `useSyncExternalStore`, keep
  controller promises caught at the interaction boundary, and let its stable state
  remain the sole error authority.
- **Local draft identity is not implemented yet**: choosing its storage encoding here
  would couple epics. — **Fallback**: keep `ClimbViewKey` opaque and require the route
  store adapter to supply stable non-empty values.
- **Long 305-hold SVG plus modal semantics may stress low-end phones**: duplicate
  board trees would double cost. — **Fallback**: render exactly one detail tree at a
  time and move composition by CSS/layout rather than keeping hidden mobile and
  desktop copies.
- **No records exist before route persistence lands**: the app is intentionally an
  empty workspace at this stage. — **Fallback**: test with injected fixtures while
  keeping production honest; the dependent route feature supplies real local data.

## Dispatch rationale

Design used direct repository inspection rather than an explore sub-agent because the
surface is bounded and its two consequential dependencies are already implemented and
typed: `BoardRenderer` and `BoardLightController`. The accepted hybrid mockups and
route-creation ownership decisions resolve the UI direction. Cross-model advisory
review was skipped as this is a reversible, standard-weight presentation feature with
no new persistence, protocol, or external-system boundary.

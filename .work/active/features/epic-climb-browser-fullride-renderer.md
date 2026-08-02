---
id: epic-climb-browser-fullride-renderer
kind: feature
stage: review
tags: [ui]
parent: epic-climb-browser
depends_on: [epic-universal-board-platform-domain-definition]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Fullride Definition-Driven Renderer

## Brief

Deliver the shared, responsive board renderer that turns the normalized Fullride
7x10 definition and a climb/light scene into a recognizable physical hold layout.
Catalog placement coordinates are authoritative for geometry and hit targets; the
complete source screenshot is preserved unchanged as a visual reference for hold
shape, orientation, spacing, and calibration. The rendered board always keeps
unselected physical holds visible and subdued while selected placements use green
start, blue middle, red/pink finish, and gold/yellow foot-only overlays.

This feature establishes one renderer that the climb viewer and route editor can
reuse, including optional hit testing needed by later editing. It does not query a
community catalog, persist drafts, encode Bluetooth commands, or introduce
additional board definitions. It must not make the screenshot's pixel positions the
domain source of truth or mutate the checked-in reference image.

## Epic context

- Parent epic: `epic-climb-browser`
- Position in epic: foundation feature; the local climb viewer and route editor
  consume its definition-driven visual and interaction surface.

## Inherited design decisions

- Render the complete recognizable Fullride physical hold layout; a colored-dot
  grid is not acceptable.
- Use catalog-backed placement coordinates as geometry authority and
  `docs/kilter_fullride_7x10.png` only as the preserved visual/calibration reference.
- Keep every unselected hold visible but subdued and support all four semantic
  roles: green start, blue middle, red/pink finish, gold/yellow foot-only.
- Consume a board definition rather than embedding vendor coordinates in the React
  component, while validating only the Fullride 7x10 in this milestone.
- Follow the locked Sumi & Plywood / Wave Console tokens and productive, calm,
  reduced-motion-compatible interaction language.

## Research briefs

- `docs/briefs/board-rendering-and-filtering.md` — definition geometry, SVG/overlay
  prior art, coordinate scaling, and renderer reuse.
- `docs/briefs/data-model.md` — placement-to-hole coordinate resolution and role
  semantics.
- `.research/analysis/landscapes/climbing-board-ecosystem.md` — provider/board
  boundary context.

## Foundation references

- `docs/ARCHITECTURE.md` — Board Renderer and definition-driven geometry.
- `docs/SPEC.md` — Climb Browser, Hold/Placement/Hole, and Fullride-first scope.
- `docs/PRINCIPLES.md` — definitions are data; provider details stay at adapters.

## Mockups

- Inherits design system: `.mockups/design-system/tokens.css`
- Selected responsive board treatment:
  `.mockups/screens/epic-climb-browser/option-hybrid.html`
- Physical visual reference: `docs/kilter_fullride_7x10.png`

## Design decisions

- **Rendering stack**: use one responsive SVG scene, not a canvas, DOM button grid,
  raster crop atlas, or screenshot underlay. SVG preserves crisp scaling, semantic
  per-hold elements, deterministic testing, and the same placement-addressed surface
  in viewer and editor contexts.
- **Coordinate authority**: transform the definition's catalog bounds into an SVG
  view box with a fixed logical gutter and invert only the vertical axis. Never infer
  placement centers, identity, or LED mapping from screenshot pixels. The transform
  is a pure exported utility so rendering and hit testing cannot drift.
- **Independent artwork**: ship a small, original set of neutral SVG hold archetypes
  and deterministically select scale/rotation/archetype from stable placement metadata.
  This makes all 305 positions visibly read as climbing holds without redistributing,
  tracing, cropping, embedding, or runtime-loading the Kilter reference screenshot.
  The result intentionally represents the physical layout rather than claiming exact
  vendor hold silhouettes.
- **Scene vocabulary**: the renderer accepts placement-addressed visual assignments
  as either one of the four semantic roles or any `ApiLevel3Color`. Role assignments
  use the definition's locked screen colors and distinct marker shapes; custom colors
  preview the quantized hardware color returned by `apiLevel3ColorHex`.
- **Interaction**: view mode renders no keyboard stops. Select mode uses nearest-center
  pointer hit testing over the authoritative placement lattice and a single roving
  keyboard focus, with arrow-key spatial navigation and Enter/Space activation. Every
  placement remains a named SVG grid cell, avoiding 305 tab stops while keeping the
  complete surface reachable.
- **Touch scale**: the SVG is responsive at scale 1 for viewing. Editing consumers can
  request a controlled `scale` up to 3 inside an overflow container; a phone editor
  should use 2.5 so the 305 dense cells approach a 44px touch target. Zoom controls
  belong to the route-editor composition, not this reusable renderer.
- **Reference preservation**: `docs/kilter_fullride_7x10.png` remains byte-for-byte
  unchanged. A regression test records its current 1126x1584 dimensions and SHA-256
  (`a1e17430dd42eb7c81021834405a87d5a90bf9d14bca9af408553380f0a00bb0`).

## Architectural choice

Use a placement-addressed React SVG component backed by pure geometry, scene-index,
artwork, and spatial-navigation helpers. The SVG owns presentation and input-event
translation; pure helpers own all decisions that can be proven without a browser.
This matches the consumer: viewers pass role scenes, the route editor passes role or
custom-color assignments plus an activation callback, and neither imports native
Kilter IDs, screenshot coordinates, Bluetooth codecs, or LED positions.

Three approaches were considered. A raster reference image with colored overlays
would look immediately familiar, but creates a redistribution dependency and makes
unselected holds inseparable from vendor pixels. Canvas would handle many objects but
would require rebuilding accessibility, focus, hit testing, and semantic test hooks.
Hundreds of absolutely positioned HTML buttons would provide native controls but
scale and rotate poorly and produce an unusable tab sequence. SVG gives the best
combination of responsive geometry, independent artwork, accessibility, and testable
per-placement state for a 305-element board.

The trickiest unit is a coordinate and interaction model shared by both visual output
and selection. A visually correct board can still activate the wrong placement after
responsive scaling or Y inversion. One `BoardTransform` therefore owns forward and
inverse transforms, pointer coordinates are converted through the SVG current
transformation matrix, and nearest/directional selection operate only in catalog
space. The regular Fullride lattice has a verified nearest-neighbor distance of
`sqrt(32)` catalog units; hit radius is derived from actual definition geometry rather
than hard-coded screen pixels.

## Implementation Units

### Unit 1: Pure renderer scene and geometry contracts

**Files**:

- `web/src/board-renderer/types.ts`
- `web/src/board-renderer/geometry.ts`
- `web/src/board-renderer/scene.ts`
- `web/src/board-renderer/index.ts`

```typescript
import type { ClimbRole, BoardDefinition, BoardPoint } from '../domain/boards/definition.ts';
import type { ApiLevel3Color, BoardPlacementId } from '../domain/boards/types.ts';

export type BoardHoldAppearance =
  | { readonly kind: 'role'; readonly role: ClimbRole }
  | { readonly kind: 'custom'; readonly color: ApiLevel3Color };

export interface BoardHoldAssignment {
  readonly placementId: BoardPlacementId;
  readonly appearance: BoardHoldAppearance;
}

export interface BoardTransform {
  readonly viewBox: Readonly<{ x: number; y: number; width: number; height: number }>;
  toSvg(point: BoardPoint): BoardPoint;
  toBoard(point: BoardPoint): BoardPoint;
}

export type BoardDirection = 'up' | 'right' | 'down' | 'left';

export function createBoardTransform(
  definition: BoardDefinition,
  gutter?: number,
): BoardTransform;
export function createAssignmentIndex(
  definition: BoardDefinition,
  assignments: readonly BoardHoldAssignment[],
): ReadonlyMap<BoardPlacementId, BoardHoldAppearance>;
export function nearestPlacement(
  definition: BoardDefinition,
  point: BoardPoint,
): BoardPlacementId | null;
export function placementInDirection(
  definition: BoardDefinition,
  from: BoardPlacementId,
  direction: BoardDirection,
): BoardPlacementId;
```

**Implementation Notes**:

- `createBoardTransform` validates a finite non-negative gutter (default `4`), maps
  `left → gutter`, `right → width - gutter`, `top → gutter`, and `bottom → height -
  gutter`, and returns the exact algebraic inverse. Its view box uses definition
  width/height plus twice the gutter; no Fullride constants enter this helper.
- `createAssignmentIndex` returns a new read-only map and throws an indexed error for
  duplicate or unknown placement IDs. An empty scene and arbitrary role composition
  are valid. It performs no route validation.
- `nearestPlacement` calculates the definition's minimum pairwise spacing once per
  definition through a `WeakMap` cache and returns the nearest placement only within
  `0.52 * minimumSpacing`. Tie-breaking follows definition order. This gives adjacent
  cells full practical coverage without allowing taps in the exterior gutter.
- Directional navigation scores only candidates in the requested half-plane, first
  by angular alignment and then distance; at an edge it returns `from` rather than
  wrapping unexpectedly.

**Acceptance Criteria**:

- [ ] Every definition bound and all 305 Fullride points round-trip through the
      transform within floating-point tolerance, with top rendered above bottom.
- [ ] Unknown/duplicate assignments fail before render; empty, unconventional, and
      fully custom 305-placement scenes remain valid.
- [ ] Exact centers resolve to their placement, exterior gutter taps resolve to null,
      and boundary ties are deterministic.
- [ ] Arrow navigation reaches the geometrically adjacent Fullride hold where one
      exists and remains stable at an outer edge.

### Unit 2: Independent Fullride-neutral hold artwork

**Files**:

- `web/src/board-renderer/hold-artwork.tsx`
- `web/src/board-renderer/hold-artwork.test.tsx`

```typescript
import type { BoardPlacementDefinition } from '../domain/boards/definition.ts';

export type HoldArchetype =
  | 'edge' | 'wedge' | 'dish' | 'pinch' | 'pebble' | 'rail' | 'scoop' | 'block';

export interface HoldArtworkChoice {
  readonly archetype: HoldArchetype;
  readonly rotation: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

export function chooseHoldArtwork(
  placement: BoardPlacementDefinition,
): HoldArtworkChoice;
export function HoldArtwork(props: {
  readonly choice: HoldArtworkChoice;
  readonly selected: boolean;
}): React.JSX.Element;
```

**Implementation Notes**:

- Define eight original closed SVG paths around `(0,0)` in a normalized `[-2,2]`
  space, with a shallow highlight, edge shadow, and central bolt mark. Paths are
  authored for CruxControl; do not trace or sample the PNG.
- A stable integer hash of definition-scoped placement ID and native set ID chooses
  archetype, rotation in 15-degree increments, and bounded scale variation. No
  randomness runs at render time, so serverless builds, screenshots, and tests remain
  stable. Mainline and Auxiliary may use slightly different size ranges, but native
  identity must not escape this private artwork choice.
- Neutral holds use plywood-aware subdued fill/stroke tokens in both color schemes.
  Selected color is rendered as a translucent body wash plus an opaque outer ring so
  the original hold silhouette and bolt stay legible.

**Acceptance Criteria**:

- [ ] The same placement always produces the same finite, bounded artwork choice.
- [ ] All eight original archetypes occur across the 305-placement fixture and every
      hold renders a silhouette plus bolt—not a colored dot.
- [ ] Artwork contains no `<image>`, external URL, screenshot crop, vendor asset, or
      runtime randomness.
- [ ] Selected and neutral states remain distinguishable in locked light/dark themes.

### Unit 3: Responsive, accessible React SVG renderer

**Files**:

- `web/src/board-renderer/BoardRenderer.tsx`
- `web/src/board-renderer/BoardRenderer.css`
- `web/src/board-renderer/BoardRenderer.test.tsx`

```typescript
export interface BoardRendererProps {
  readonly definition: BoardDefinition;
  readonly assignments?: readonly BoardHoldAssignment[];
  readonly interactionMode?: 'view' | 'select';
  readonly scale?: number;
  readonly labelledBy?: string;
  readonly onPlacementActivate?: (placementId: BoardPlacementId) => void;
}

export function BoardRenderer(props: BoardRendererProps): React.JSX.Element;
```

**Implementation Notes**:

- Render one plywood panel SVG with `preserveAspectRatio="xMidYMid meet"`, board frame,
  and one stable `<g data-placement-id>` per definition placement. Preserve definition
  order for deterministic layering and never use array position as placement identity.
- The containing element keeps the definition aspect ratio, width `100% * scale`, and
  horizontal/vertical overflow. Validate finite `scale` from `1..3`; default `1`.
- Role colors come from `definition.rolePresets[role].screenColor`. Add a tiny
  non-color marker centered on the bolt: triangle start, circle middle, square finish,
  diamond foot-only. Custom colors use `apiLevel3ColorHex` plus a ring and accessible
  label `Custom #RRGGBB`.
- In view mode the SVG is an image named from manufacturer/model/layout/size and no
  hold is focusable. In select mode it is a grid; each hold is a named gridcell/button
  (`Hold <ordinal>, <role/custom/unselected>`), exactly one has `tabIndex=0`, arrow keys
  move spatial focus, Home/End move to first/last, and Enter/Space invokes the callback.
- Pointer activation uses `svg.createSVGPoint()` and
  `getScreenCTM()?.inverse()` before inverse board transform and nearest placement. If
  CTM is absent or the point falls outside hit radius, do nothing. Pointer and keyboard
  call the same activation helper exactly once.
- Do not animate board geometry. A quick color transition may use locked motion tokens,
  but reduced-motion removes it. Focus is a high-contrast outline independent of role
  color; `aria-live` is intentionally absent because the editor owns assignment
  announcements.

**Acceptance Criteria**:

- [ ] Fullride renders exactly 305 recognizable neutral hold groups at any supported
      container width; unassigned holds never disappear behind selected overlays.
- [ ] Start, middle, finish, foot-only, black/white, and other custom packed colors
      render with accurate labels, stable marker distinctions, and quantized previews.
- [ ] View mode adds no tab stops; select mode exposes one roving tab stop while all
      305 named cells are arrow-reachable and independently activatable.
- [ ] Pointer coordinates select the correct first/middle/last fixture placements
      under responsive scaling and vertical inversion; outside-board taps are ignored.
- [ ] `scale=2.5` produces an editor-ready overflow surface without changing geometry,
      identity, assignment state, or callback values.

### Unit 4: Visual calibration fixture and source-image preservation

**Files**:

- `web/src/board-renderer/fullride-reference.test.ts`
- `web/src/board-renderer/BoardRenderer.fullride.test.tsx`

```typescript
export const FULLRIDE_REFERENCE = {
  path: '../docs/kilter_fullride_7x10.png',
  width: 1126,
  height: 1584,
  sha256: 'a1e17430dd42eb7c81021834405a87d5a90bf9d14bca9af408553380f0a00bb0',
} as const;
```

**Implementation Notes**:

- The preservation test reads the file from repository root using Node test APIs,
  parses the PNG header without a new image dependency, and verifies dimensions and
  SHA. The production bundle never imports the test constant or image.
- Fullride fixture assertions verify the 305 generated centers, deterministic artwork
  assignments, four role markers, and representative arbitrary colors. Add a compact
  inline SVG snapshot only if it remains reviewable; prefer semantic DOM assertions
  and a stable count/hash of artwork choices over a massive serialized snapshot.
- Perform one manual comparison of the implemented board beside the locked selected
  mock and the PNG. Record the result under `## Implementation evidence`; visual
  calibration may tune only gutter and original artwork sizing—not placement centers.

**Acceptance Criteria**:

- [ ] Tests fail if the source PNG bytes, width, or height change accidentally.
- [ ] No production source or build artifact references the PNG path or embeds its
      bytes.
- [ ] The Fullride renderer's 305 center positions match the generated definition,
      and calibration changes cannot replace those positions with screenshot data.

## Implementation Order

1. Pure geometry/scene contracts — first because coordinate inversion and hit
   identity are the feasibility boundary for every visual and editing behavior.
2. Original hold artwork — establish a distributable recognizable board before React
   composition can accidentally depend on the screenshot.
3. React SVG renderer — compose geometry, artwork, scene state, responsive scaling,
   and accessible interaction.
4. Fullride fixture/preservation suite and manual visual calibration — lock evidence
   around the complete 305-hold result and immutable reference.

The feature remains one implementation stride. Geometry, artwork, SVG events, and
tests share one tight visual contract; child stories would create overlapping files
and offer little safe parallelism.

## Testing

### Unit tests

- `web/src/board-renderer/geometry.test.ts`: arbitrary non-zero bounds, both transform
  directions, invalid gutter, Fullride all-point round trips, nearest hit/no-hit/tie,
  and four-direction spatial navigation.
- `web/src/board-renderer/scene.test.ts`: empty and all-role scenes, all 256 custom
  colors through representative assignments, duplicate/unknown placement errors, and
  caller-input immutability.
- `web/src/board-renderer/hold-artwork.test.tsx`: deterministic bounded choices,
  archetype fixture coverage, neutral/selected path anatomy, and no image references.
- `web/src/board-renderer/BoardRenderer.test.tsx`: role/custom presentation, 305 cells,
  view/select semantics, roving focus, directional and activation keys, pointer CTM
  conversion, invalid scale, and callback identity.

### Integration tests

- `web/src/board-renderer/BoardRenderer.fullride.test.tsx` composes the concrete
  generated definition with four roles, custom black/white/teal, empty state, and the
  complete selected state. It asserts definition-scoped placement IDs from the first,
  middle, and last records rather than native Kilter numbers.
- `web/src/board-renderer/fullride-reference.test.ts` guards source-image preservation
  and proves the production renderer has no reference dependency.

## Risks

- **Recognizability without vendor artwork**: original archetypes will represent hold
  character and exact physical centers but not exact Kilter silhouettes. **Fallback**:
  refine the independent archetype library and deterministic sizing/orientation after
  side-by-side review; do not switch to embedding the screenshot without an explicit
  redistribution decision.
- **Dense mobile selection**: 305 holds cannot each have a non-overlapping 44px target
  at fit-to-phone scale. **Fallback**: route editor defaults to `scale=2.5` and supplies
  zoom controls; nearest-center hit regions and spatial keyboard navigation preserve
  complete access.
- **SVG assistive-technology variance**: nested SVG gridcell/button semantics are not
  uniform across every browser/screen reader. **Fallback**: add a synchronized compact
  HTML selection list at the route-editor layer if Android Chromium/manual testing
  shows the SVG semantics are insufficient; keep placement activation contract stable.
- **Algorithmic artwork can imply false physical fidelity**: deterministic shapes may
  be mistaken for exact installed holds. **Fallback**: label the first-milestone visual
  as a board map where context requires and avoid hold-type names/claims in accessible
  copy.

## Design execution notes

- Execution capability: highest-capability/xhigh, inherited from active autopilot due
  to visual/data alignment risk.
- Review weight: standard.
- Advisory review: skipped; the parent epic and user-approved mockups settle the
  consequential direction, while remaining renderer choices are reversible and do
  not change source data or redistribution authority.
- Child stories: none — one tightly coupled visual/interaction implementation stride.

## Implementation notes

- Execution capability: highest-capability/xhigh, inherited from autopilot because
  catalog-space geometry, dense SVG accessibility, and visual identity all meet in
  this feature.
- Review weight: standard, from the feature design and project convention.
- Files changed: `web/src/board-renderer/{types,geometry,scene,hold-artwork,
  BoardRenderer,index}` plus colocated CSS and six focused test files.
- Tests added/removed: added pure transform, nearest-hit, navigation, scene
  validation, deterministic artwork, responsive SVG semantics/interaction,
  generated Fullride integration, and immutable PNG integrity coverage; removed none.
- Simplification: one pure transform serves rendering and hit testing; one scene
  index validates all assignments before rendering; one deterministic artwork
  selector avoids a runtime asset system or screenshot dependency.
- Discrepancies from design: none.
- Adjacent issues parked: none.

## Implementation evidence

- The generated definition renders 305 placement-addressed SVG hold groups, and the
  fixture exercises all eight original archetypes across those positions.
- Side-by-side visual calibration against the selected hybrid mock and preserved
  Fullride screenshot confirms the tall 7x10 proportion, complete placement field,
  subdued neutral context, and high-contrast selected overlays. Calibration retains
  catalog centers and uses only the designed four-unit logical gutter and bounded
  original artwork sizing.
- The checked-in screenshot remains 1126x1584 with SHA-256
  `a1e17430dd42eb7c81021834405a87d5a90bf9d14bca9af408553380f0a00bb0`;
  production renderer source does not import or embed it.

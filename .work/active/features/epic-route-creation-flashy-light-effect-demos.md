---
id: epic-route-creation-flashy-light-effect-demos
kind: feature
stage: implementing
tags: [ui, ble]
parent: epic-route-creation
depends_on: [epic-route-creation-animated-light-designs, epic-route-creation-kilter-screenshot-import, epic-route-creation-board-light-capacity-envelope]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Flashy Light-Effect Demonstrations

## Brief

After the saved light-effects foundation is complete, add a curated library of flashy
demo designs that can be previewed, edited, saved with a climb, and played on the board:

- an ocean tide lapping in and receding over sand, using blue, purple, teal, foam,
  and warm sand colors;
- a tie-dye rainbow spiral that rotates and continuously morphs through colors;
- a Matrix-inspired green-and-black falling-light effect;
- additional visually distinctive demonstrations that show off coordinated spatial
  animation on the Fullride, including sparse moving beach-ball and snake demonstrations.
- a Frogger scene with a green frog crossing through vertically moving red traffic; and
- a board-spanning red pentagram that fades in and out within a declared light reserve.

These should build on the shared saved-effect/frame engine rather than becoming a
separate animation implementation. Applying a preset should target unused decorative
holds by default while allowing an explicit whole-board override. Presets remain
editable after application: palette, speed, direction, brightness, affected holds,
and layering can all be changed. A saved climb retains its saved preset/effect data
rather than changing unexpectedly when the built-in preset library evolves.

## Strategic decisions

- **Default scope**: presets protect climb holds and apply to unused decorative holds
  by default, with an explicit whole-board override.
- **Editability**: presets are editable recipes rather than fixed rendered frames.
- **Persistence**: saved climbs retain their effect configuration independently of
  later built-in preset changes.
- **Measured reservation**: every preset exposes a deterministic worst-case active-light
  reserve and intended FPS. Playback budgets route lights, static decoration, and the
  effect separately through the measured Fullride capacity policy; it never guesses a
  universal hold-count ceiling or silently drops lights to fit.
- **Independent targeting**: unused background holds can belong to an effect without
  becoming assigned climb holds. Sparse beach-ball and snake presets are the first simple
  physical demonstrations because their maximum lit footprint is small and predictable.
- **Grid-game movement**: Snake and Pac-Man traverse only horizontal/vertical nearest-
  neighbor edges at one edge per physical frame; seeded starts and turn preferences vary
  consecutive circuits.
- **Additional demonstrations**: Frogger reserves ten lights for a green crossing frog
  and vertical red traffic. The fading circled pentagram uses ten evenly distributed
  circle anchors plus ten star-stroke anchors, consuming the full measured API-2 scene.

## Simplification opportunity

Express every demo through the existing saved effect groups and shared frame engine.
Do not introduce a second animation runtime, BLE scheduler, or preset-only persistence
format.

## Design decisions

- **Shared saved model**: extend `LightEffectGroup` into an explicit discriminated union
  of existing assignment-bound effects and spatial recipe effects. Do not add a second
  background-effects store or materialize unused holds as fake climb assignments.
- **Frame architecture**: use a two-pass pure renderer. Resolve ordinary assignments and
  their existing effects first, then emit only currently active spatial lights from board
  geometry. Spatial output makes frame length variable, so capacity preflight uses a
  separate worst-case plan rather than `assignments.length` or frame-zero density.
- **Dynamic targets**: `unused` is evaluated at render time; a newly assigned climb hold
  automatically leaves that effect. `background-board` may animate unassigned holds and
  custom-color decorations, but semantic role assignments are always protected. `selected`
  is an independently painted target and never creates a `BoardHoldAssignment`.
- **Protection invariant**: Start, Middle, Finish, and Foot-only holds remain static,
  exact, and topmost for every spatial preset. Background colors are post-quantization
  remapped away from the active definition's four exact packed role colors.
- **Saved snapshots**: applying a built-in creates a complete immutable recipe snapshot—
  recipe kind/version, seed, palette, period, intensity, direction/shape parameters,
  footprint, target scope, and sparse include/exclude overrides. Rendering never looks up
  a saved preset by registry name, so future library edits cannot change stored climbs.
- **Layering**: multiple spatial groups may coexist. Saved effect-group array order is
  bottom-to-top; later spatial layers win overlaps, semantic route colors win last, and
  capacity conservatively sums every spatial footprint rather than assuming overlap.
- **Measured playback**: API-2 worst-case complete scene is ordinary assignment count plus
  all spatial footprints and must be at most 20. Runtime validates actual frames against
  declared reserve and policy. Saving and screen preview remain unrestricted; physical
  playback refuses with a breakdown and never drops or thins lights.
- **Hardware motion language**: physical animations are intentionally discrete at the
  measured 2 FPS. Snake, ball, Pac-Man, Pong, and bird poses are designed as legible board
  steps rather than pretending to be smooth video.
- **UI inheritance**: the user already approved effects in climb settings and the current
  `LightEffectsPanel` composition. Extend it with collapsed Presets and Recipe disclosures,
  capacity breakdown, scope, paint, and layer controls using the locked design system; no
  new page, navigation model, or aesthetic decision requires another mock selection.

## Architectural choice

Three approaches were evaluated. Virtual assignments for every possible background hold
would turn a five-light snake into a 300-light complete scene. A separate
`backgroundEffectLayers` aggregate would duplicate persistence, editing, sharing, and
runtime seams. Replacing the whole route/effect model with a generic scene graph would be
a disproportionate migration of stable climb semantics.

The chosen design is a discriminated effect-group union and a two-pass shared frame
engine. Existing assigned effects retain their behavior. Spatial groups are typed
procedural recipes that select at most their declared footprint from eligible definition
placements at each timestamp. Composition remains one `LightScene`, one controller queue,
and one capacity policy. This is the smallest design that preserves editable recipes,
independent unused-hold targeting, dynamic route protection, and exact saved playback.

The trickiest unit is the spatial renderer plus reserve analyzer. They are one contract:
every deterministic recipe pose must stay within its saved footprint, output unique valid
placements, avoid reserved colors after interpolation/quantization, respect target masks
and layer order, and give runtime a safe worst-case complete-scene count before any write.

## Contracts

```typescript
export interface AssignedLightEffectGroup {
  readonly model: 'assigned';
  readonly id: LightEffectGroupId;
  readonly kind: 'pulse' | 'color-cycle' | 'wave' | 'twinkle' | 'alternate';
  readonly palette: readonly ApiLevel3Color[];
  readonly periodMs: number;
  readonly intensity: number;
}

export type SpatialEffectKind =
  | 'ocean-tide' | 'tie-dye-spiral' | 'matrix-rain' | 'snake'
  | 'beach-ball' | 'pac-man' | 'pong' | 'bird-flock';

export type SpatialRecipe =
  | { readonly kind: 'ocean-tide'; readonly direction: 'in' | 'out'; readonly foam: number }
  | { readonly kind: 'tie-dye-spiral'; readonly direction: 'clockwise' | 'counterclockwise'; readonly arms: 2 | 3 | 4 }
  | { readonly kind: 'matrix-rain'; readonly direction: 'down' | 'up'; readonly columns: number }
  | { readonly kind: 'snake'; readonly direction: 'forward' | 'reverse'; readonly bodyLength: number }
  | { readonly kind: 'beach-ball'; readonly velocityX: number; readonly velocityY: number; readonly size: number }
  | { readonly kind: 'pac-man'; readonly direction: 'forward' | 'reverse'; readonly mouthBeat: number }
  | { readonly kind: 'pong'; readonly direction: 'forward' | 'reverse'; readonly paddleSize: number }
  | { readonly kind: 'bird-flock'; readonly direction: 'left' | 'right'; readonly quietFraction: number };

export interface SpatialEffectTarget {
  readonly scope: 'unused' | 'background-board' | 'selected';
  readonly include: readonly BoardPlacementId[];
  readonly exclude: readonly BoardPlacementId[];
}

export interface SpatialLightEffectGroup {
  readonly model: 'spatial';
  readonly id: LightEffectGroupId;
  readonly recipeVersion: 1;
  readonly recipe: SpatialRecipe;
  readonly seed: number;
  readonly palette: readonly ApiLevel3Color[];
  readonly periodMs: number;
  readonly intensity: number;
  readonly footprint: number;
  readonly target: SpatialEffectTarget;
}

export type LightEffectGroup = AssignedLightEffectGroup | SpatialLightEffectGroup;

export interface SpatialCapacityPlan {
  readonly assignmentLights: number;
  readonly spatialReserves: readonly Readonly<{ id: LightEffectGroupId; lights: number }>[];
  readonly worstCaseLights: number;
  readonly intendedFps: number;
}
```

Recipe path semantics are deterministic and definition-derived. Snake and Pac-Man walk
a serpentine lattice path sorted by board row, alternating row direction, with definition
order as the final tie-break; they do not require a new adjacency graph. Beach ball and
Pong use reflected normalized board coordinates and choose nearest eligible placements.
Birds use a translated V formation with seeded quiet intervals. Ocean uses a traveling
front, tie-dye uses polar angle/radius, and Matrix uses seeded column phases. Black/off is
omitted from the complete scene and therefore extinguished by API-2 replacement semantics.

## Implementation Units

### Unit 1: Versioned spatial recipe contracts

**Story**: `epic-route-creation-flashy-light-effect-demos-contracts`

**Files**: `web/src/board-renderer/types.ts`; `web/src/drafts/{types,codec}.ts` and tests;
`web/src/playlists/portable-{types,codec,export,import}.ts` and tests/fixtures.

Bump local draft records to v4 and portable playlist snapshots to v2. Decode v1–v3
draft groups and portable v1 groups as explicit `model: 'assigned'` without writing until
normal user persistence. Validate recipe discriminants/parameters, finite integer seed,
footprint 1–20, palette/period/intensity, unique known include/exclude placements, no
include/exclude overlap, and forbid assignment references to spatial groups. IndexedDB
store versions remain unchanged because payload migration is codec-owned.

**Acceptance Criteria**:

- [x] Draft v1/v2/v3 and portable v1 content migrate losslessly to assigned groups; v4/v2
  spatial recipes round-trip exactly and corrupt/dangling data fails closed.
- [x] Existing climb/effect behavior and exported playlist order/content remain unchanged.
- [x] Spatial recipes are self-contained snapshots and contain no registry dependency.

### Unit 2: Spatial engine, preset library, and reserve proof

**Story**: `epic-route-creation-flashy-light-effect-demos-spatial-engine`

**Files**: `web/src/light-effects/{spatial-frame,capacity-plan,preset-library}.ts`, tests,
and `frame.ts` integration.

Implement the two-pass composition contract and five headline factories: Ocean Tide,
Tie-dye Spiral, Matrix Rain, Snake, and Beach Ball. Built-ins use role-distinct quantized
palettes and bounded footprints (respectively 12, 12, 10, 7, and 4 before user editing).
Every generator selects only eligible placements, uses stable tie-breaks, and hard-fails
in development/tests if output exceeds its declared footprint; production composition
also reports the invariant violation and refuses board playback rather than truncating.

**Acceptance Criteria**:

- [x] Golden boundary timestamps prove deterministic poses, direction/wrap behavior,
  target scope, dynamic route masking, layering, semantic reassertion, unique output,
  black omission, and exact reserved-color avoidance.
- [x] Exhaustive sampled periods across every built-in prove actual active lights never
  exceed footprint; capacity plan conservatively sums assignment lights plus reserves.
- [x] Applying a factory yields an immutable full snapshot whose rendering is unchanged
  if the built-in registry later changes.

### Unit 3: Sparse game and ambient recipes

**Story**: `epic-route-creation-flashy-light-effect-demos-game-recipes`

**Files**: preset/spatial engine files and focused tests from Unit 2.

Add Pac-Man (7), Pong (6), and Bird Flock (8) using the same typed recipe and geometry
primitives. Preserve calm empty bird intervals and recognizable two-FPS poses. These are
ordinary editable saved spatial groups, not a separate party-mode runtime.

**Acceptance Criteria**:

- [x] Pac-Man, Pong, and birds have deterministic golden poses, direction changes, wrap/
  bounce boundaries, seeded repeatability, quiet intervals, and footprint proofs.
- [x] Every built-in preset palette remains distinct from exact semantic role colors after
  API3 quantization and API2 reduction.

### Unit 4: Editor authoring and measured board playback

**Story**: `epic-route-creation-flashy-light-effect-demos-editor-runtime`

**Files**: `web/src/route-editor/{types,editor-state,assignments,LightEffectsPanel,
RouteEditorWorkspace,use-editor-lighting}.ts{x,}` plus CSS/tests and foundation docs.

Add a collapsed preset chooser and spatial recipe editor for palette, period/speed,
intensity/brightness, typed direction/shape controls, footprint, target scope, sparse
include/exclude painting, and layer up/down. Applying a preset creates a new saved group
without assignments. The board preview receives the shared composed frame. Runtime uses
`SpatialCapacityPlan.worstCaseLights` before the initial `controller.light`, refuses an
unsafe 21+ plan with route/static/effect breakdown, then asserts every real frame remains
within the reserve and measured policy. Stop settles the ordinary static assignment scene;
visibility/disconnect/unmount retain existing cancellation semantics.

**Acceptance Criteria**:

- [x] Preset application adds no fake assignments; unused/background/selected targeting,
  paint/exclude, reorder, edit, delete, autosave, reload, and portable sharing work.
- [x] Semantic role holds never animate under spatial groups; custom assignments are
  protected by `unused` but may be overlaid by explicit `background-board`.
- [x] A 20-light worst-case plan starts at measured 2 FPS; 21 refuses before the first
  board write. Actual reserve violations stop with an error and saved data is untouched.
- [x] Phone layout keeps preset choice, capacity breakdown, board, and primary lighting
  controls usable without horizontal overflow; reduced-motion screen preview settles.

## Implementation Order

1. Contracts and migrations.
2. Spatial engine + reserve analyzer + five headline presets.
3. Game/ambient recipes.
4. Editor/runtime integration and documentation.

## Testing

- Codec/portable suites prove every old-version migration, new round trip, and corrupt
  recipe/target/reference rejection.
- Pure recipe tests use exact timestamps plus full-period samples, multiple seeds, edge
  target sets, and small synthetic definitions to prove geometry and reserve invariants.
- Composition tests prove two-pass order, role protection, duplicate removal, black/off
  omission, role-color remapping, and definition-order stability.
- Reducer/component tests cover complete preset snapshots, independent target painting,
  scope changes, typed controls, reorder/delete, autosave, and capacity copy.
- Hook/controller tests prove worst-case preflight before first write, complete scenes,
  two-FPS cadence, latency adaptation, stop/clear/disconnect/visibility, and no mutation.
- Full tests, typecheck, lint, production/PWA build, phone-sized Chromium smoke, and
  powered-board dogfooding cover the feature before its standard review boundary.

## Risks

- **Two-FPS aesthetics**: continuous math can look jerky. Recipes quantize into strong
  discrete poses and screen preview must not be used as evidence of hardware smoothness.
- **Reserve underestimation**: one erroneous generator could overload the controller.
  Analyzer preflights declarations; renderer asserts actual output; exhaustive period
  sampling makes the declaration a proven contract rather than hopeful metadata.
- **Schema/share drift**: local and portable codecs independently version their wire
  shapes and share domain validators without reinterpreting old records.
- **Palette collision**: interpolation can hit a reserved role color even when endpoints
  do not. Remap every emitted packed color against the active definition after blending.
- **Dynamic scope surprise**: editing a route changes `unused` immediately. UI explains
  that route holds are automatically protected and the board preview updates in place.
- **Panel density**: disclosures default closed and show one selected group at a time;
  the board and primary light action remain visually dominant.

## Implementation notes

- Execution capability: highest available because this feature crosses versioned persistence, procedural rendering, measured BLE limits, and mobile editing.
- Review weight: standard (explicit caller selection); hand off for exactly one independent feature review.
- Delivered: draft v4/portable v2 spatial snapshots; deterministic two-pass engine; Ocean Tide, Tie-dye Spiral, Matrix Rain, Snake, Beach Ball, Pac-Man, Pong, Bird Flock, Frogger, and fading circled inverted pentagram presets; independent target painting/layering; editable palette/speed/intensity/direction/shape/footprint/scope; conservative API-2 preflight and runtime reserve assertion.
- Verification: the current 68-file / 443-test suite, TypeScript typecheck, ESLint, Vite/PWA production build, and Playwright phone suite are green.
- Powered-board observations: Android Chrome dogfooding confirmed effects start and remain capacity-safe; Beach Ball, Pong, and Matrix read successfully; Bird Flock and Pac-Man are recognizable; cadence/path-variance fixes followed observed repetition; and the circled inverted pentagram was refined through multiple physical-board bounces.
- Closure status: implementation and acceptance evidence are complete. The feature remains `implementing` until its required standard independent feature review runs; no physical-dogfood blocker remains.

## Other agent review

One Claude Sonnet advisory pass challenged the frame invariant, complete-scene capacity
count, schema/portable migration, dynamic target timing, game path semantics, protection,
layering, self-contained snapshots, panel composition, and footprint tests. Accepted all
material questions into the design. The selected resolution is the explicit two-pass
engine, worst-case complete-scene preflight, render-time target evaluation, serpentine or
reflected typed procedural geometry, role-kind protection with definition-driven reserved
colors, bottom-to-top layers, and versioned self-contained recipes. Rejected virtual/fake
assignments, a separate background array/runtime, and a general scene-graph rewrite.

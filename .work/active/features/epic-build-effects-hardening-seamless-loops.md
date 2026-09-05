---
id: epic-build-effects-hardening-seamless-loops
kind: feature
stage: review
tags: [ui, ble]
parent: epic-build-effects-hardening
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
---

# Longer seamless themed background loops

## Brief

Revise all ten existing spatial presets into longer, theme-appropriate closed sequences (normally 1–3 minutes), without slowing a short sequence as the only change. Preserve recipeVersion 1 playback; new presets use a new version and saved effects expose an explicit, non-destructive upgrade. Keep all current palette/period/intensity/target controls and make shape controls functional. Fix zero intensity and empty-frame cancellation, guard decorative colors after API-2 conversion, and avoid redundant held-frame computation/board-path construction with evidence. Keep route lights exact and the 20-light/2-FPS hardware profile unchanged. Produce standalone motion previews before production edits. Test cycle joins including trails/color/state, all kinds, seeds, masks, saved v1 compatibility, upgrade persistence and relevant playback lifecycle.

## Inherited direction

Parent epic owns priorities and accepted decisions. Preserve authored content, IDs,
memberships and old saved recipes. Resolve routine design choices under the authorized
autopilot scope. No controller upgrade or increased hardware capacity claim.

## Grounding

Read docs/SPEC.md, docs/ARCHITECTURE.md and docs/PRINCIPLES.md plus current code and
relevant completed route-creation/playlists features. Research navigator has no brief
blocking this epic. Existing protocol/board-control briefs and measured capacity feature
remain constraints; they are not evidence of unmeasured hardware performance.

## Mockups

Inherit .mockups/design-system/ and the parent bee study where relevant. Remaining motion,
backup and update surfaces require focused standalone mocks during design before code.

## Simplification opportunity

Extend existing pure frame/repository/UI boundaries; avoid new frameworks or replacement
storage. Share validated logic only where repeated consumers and contracts justify it.

## Design decisions

Designed under the authorized autopilot after the parent only-questions alignment.
Routine decisions below need no new user checkpoint. This is one cohesive feature;
child stories are dependency/verification checkpoints, not separate worker assignments.

- New effects use `recipeVersion: 2`; existing v1 snapshots keep their exact old
  renderer, seed-dependent cycle changes, colors and shape behavior until explicitly
  upgraded. Common playback lifecycle repair does benefit old effects. Do not present
  an old saved effect as seamless or hardware-color protected.
- Upgrade preserves group ID, recipe fields, seed, palette, intensity, reserve and
  targets, changing version and `periodMs = max(old period, new preset default)`.
  The existing panel says the actual proposed duration before the click. A user can
  subsequently shorten Cycle time. No bulk migration, new database, schema bump,
  rewritten draft IDs or playlist membership edits.
- Default complete-sequence lengths: Ocean 120s, Spiral 120s, Matrix 90s, Snake 150s,
  Ball 90s, Pac-Man 150s, Pong 90s, Birds 120s, Frogger 120s, Pentagram 120s.
  A cycle contains several distinct phases/actions rather than one slowed old pass.
- `periodMs` remains stored verbatim. V2 uses `frameCount = max(1, round(periodMs /
  500))`, `effectivePeriodMs = frameCount * 500` for complete held-frame cycles.
  Panel timing remains the authored value; normal UI already steps by 500ms. Valid
  imported fractional periods retain data and round only at the board pose boundary.
- Spatial 0% intensity yields an empty spatial scene in v2. Custom assignments and
  semantic role holds survive composition. Color protection applies after brightness
  and interpolation, against both logical and API-2 role colors, without modifying
  the saved palette. Do not make a visually/perceptually distinct-color guarantee.
- Do not increase the measured 20-light/2-FPS profile. Preserve assignment effects'
  existing browser timing; cache spatial output only, never whole mixed frames.

## Architectural choice

**Chosen: version-dispatched pure recipes with prepared geometry and bounded caches.**
Retain `renderSpatialGroup` as the consumer API, put existing logic in a v1 renderer,
and introduce a v2 pure module. A per-definition geometry preparation shares coordinates
and adjacency, while a per-group most-recent frame memo avoids recalculating held poses.
Immutable input object identities delimit cache lifetime and invalidation. This fits
`renderAnimationFrame`, editor previews, detail previews and BLE without a new runtime.

**Alternative: mutate the current renderer in place.** Less code initially, but it
silently reinterprets every saved recipe and loses the explicitly promised upgrade
choice. Rejected; v1 is a verified external consumer (saved authored snapshots).

**Alternative: precompute every cycle as serialized frame tables.** Easy modulo lookup,
but duplicates recipe data, magnifies per-edit allocations and complicates masks and
shape changes. Rejected. Prepare geometry/path and compute just the requested pose;
keep one held frame per active group, with old objects collectable.

Trickiest unit: a discrete closed Snake/Pac-Man circuit with complete trail continuity
on actual staggered geometry. Design it before UI or persistence: a random reseed at
modulo zero or naive long DFS sampled too quickly would recreate the reported jump.

## Implementation Units

### Unit 1: V2 clock, geometry and closed trajectories

Files: `web/src/light-effects/spatial-frame.ts`, new
`web/src/light-effects/spatial-frame-v1.ts`, new
`web/src/light-effects/spatial-frame-v2.ts`; a small
`web/src/light-effects/spatial-geometry.ts` is justified for board normalization and
adjacency reused by Snake, Pac-Man and later bee. Keep helper exports narrow.

```typescript
// Public call unchanged; type is widened in Unit 3.
export function renderSpatialGroup(
  definition: BoardDefinition,
  assignments: readonly BoardHoldAssignment[],
  group: SpatialLightEffectGroup,
  elapsedMs: number,
): LightScene;

// V2 module internal contract: sampling can be tested before sparse projection.
export interface SpatialLoopClock {
  readonly frame: number;          // 0 <= frame < frameCount
  readonly frameCount: number;
  readonly phase: number;          // frame / frameCount
  readonly effectivePeriodMs: number;
}
export function spatialLoopClock(periodMs: number, elapsedMs: number): SpatialLoopClock;
```

Use positive modulo for negative finite elapsed time and no `cycleIndex` in any v2
seed or motion state. There is no duplicated endpoint in the stored/sampled cycle.
All palette phase, mouth beat, tails, traffic and quiet timing derives from this clock.
Paths use seeded ordering/destinations chosen once per recipe, not new randomness each
cycle. Keep the current v1 body substantially verbatim to make visual compatibility
reviewable; do not run legacy tests against `createSpatialPreset` after it defaults v2.

**Closed orthogonal paths:** normalize the full immutable definition, build nearest
neighbors along exact shared x or y once, deterministic tie breaking by placement order.
For each Snake/Pac-Man seed and frameCount choose a rooted bounded subtree with at most
`floor(frameCount / 2)` edges. Its DFS forward/back edge walk is closed; remove the
last duplicated root. Use `headIndex = floor(frame * path.length / frameCount)` so one
output step crosses at most one graph edge. Reverse uses positive modulo and reverses
path orientation. A longer default permits more exploration, turns and branch returns;
seed changes root and neighbor preference, not circuit continuity. If graph has separate
components, use the root component; never connect them by teleport. For a one-node or
single-frame case hold a legal pose. Select a root among target-eligible placements when
available, then traverse full geometry; hidden/excluded/role points are omitted instead
of snapping the actor to a distant allowed hold. Thus sparse masks may show intermittent
motion, an honest consequence of the mask.

Snake emits head then distinct recent path positions, capped by
`min(footprint, bodyLength)`. Body positions come from cyclic past path steps, so frame
zero has the correct previous tail and reversing doesn't scatter body lights. Backtracking
can fold/overlap the body; do not invent distant replacements to fill reserve. Pac-Man
uses the same closed path contract with a separately seeded maze circuit: head, a
periodically visible nearby mouth light, forward pellets and a trailing ghost within
its reserve. `mouthBeat` changes an integer number of chew beats fitting the full cycle
(e.g. `max(1, round(frameCount / (2 * mouthBeat)))`); no free-running elapsed-time beat
that is out of phase at the wrap. Palette index 0 stays protagonist, index 1 ghost.

Other recipes have explicit closed substructure:

| Theme | Closed behavior and active controls |
| --- | --- |
| Ocean | At least three advance/retreat swells with an integer harmonic slower envelope; `direction` reverses phase, `foam` perturbs crest height/brightness through a bounded periodic ripple. Palette follows spatial water/foam bands. |
| Spiral | Several full rotations with slow radial breathing using integer-frequency sine terms; `arms` changes the spiral count, direction changes signed turn. Color bands circulate periodically without palette reset. |
| Matrix | `columns` actual vertical streams with seeded offsets, several integer fall counts per cycle and staggered dark gaps. Stream heads start above and end below board before reuse; tails clip offboard, never snap nearest-to-edge through a wrap. Direction reverses vertical travel. |
| Beach Ball | Compact `min(size, footprint)` cluster follows folded linear x/y motion with integer bounce counts; `velocityX/Y` map magnitude to positive integral bounce counts and sign to travel orientation. Fixed seed offsets give variety; reflection reverses only at physical inset edges. Several unequal bounces give a longer coherent journey. Stripe palette stays tied to ball parts or a closed rotation. |
| Pong | Ball makes an integral number of rallies via edge-reflected motion; y has an integer reflected frequency. Two paddles interpolate toward upcoming impact height and meet ball when it reaches the edge; `paddleSize` reserves up to that many per side after one ball. Reduce paddles symmetrically when footprint is small. `direction` reverses trajectory. Never use a score blend that loses the ball identity. |
| Birds | Three or more seeded but fixed passes per cycle, each with distinct entry height/arc and a quiet interval occupying `quietFraction`. Flock V shape enters from outside, crosses, and exits outside; only onscreen members project to holds. Last pass exits into same quiet state as first. With zero quiet fraction, offboard entry/exit still gives geometrically coherent disappearance. |
| Frogger | Several smooth-ended hops out to far bank and back, with deliberate pauses, following planned safe gaps in alternating traffic lanes. Generate traffic first from integer periodic passes, choose frog wait/landing times from that known schedule; lane count changes traffic. No per-frame greedy lane jump. Traffic clips offboard on wraps; frog visibly returns rather than resets at destination. |
| Pentagram | Preserve circled inverted star anchor geometry. Several synchronized fades with a slow periodic brightness envelope and palette phase make a long ritual sequence; `fadeRate` controls fade count (rounded to an integer beat count for closure). All anchors share brightness and keep the outline readable. |

Nearest-target projection uses one linear scan per small target against eligible holds
with a stable used set, rather than sorting the entire board for each target. Do not
silently relocate clipped offboard actors. Cap every output to the authored reserve;
role masks apply before projection, and composition reasserts exact roles last.

Acceptance:
- [ ] Every kind has deterministic complete-cycle closure for palette, shape and seed.
- [ ] Snake/Pac-Man unmasked adjacent head frames, including last→first, are equal or
  connected graph neighbors; body uses preceding cyclic points, never future score order.
- [ ] Ball reflection happens only at a wall; Pong ball/paddles meet at impacts;
  birds/rain/traffic leave the board before returning; Frogger waits/crosses, never teleports.
- [ ] Shape changes produce different meaningful sequences within reserve.
- [ ] Default periods are 60–180s and contain multiple thematic actions and variation.

### Unit 2: Color correctness, preparation reuse and empty-frame playback

Files: new `web/src/light-effects/spatial-colors.ts`, `spatial-frame.ts` dispatcher,
`spatial-frame-v2.ts`, `web/src/route-editor/use-editor-lighting.ts`.

```typescript
export function spatialDisplayColor(
  definition: BoardDefinition, color: ApiLevel3Color,
): ApiLevel3Color;
```

Color helper uses existing `quantizeApiLevel3ColorForApiLevel2` (no second implementation
of encoding). After interpolation/intensity, black stays black/omitted. For nonblack
colors, build allowed candidate colors excluding logical reserved roles, API-2 reserved
bytes and API-2 black. Choose the closest allowed RGB color with deterministic numeric
 tie breaking; return input if already safe. Memoize the 256-entry lookup per immutable
board definition. This is exact byte protection, not a perceptual contrast metric.
Preview gets the same adjusted color as BLE. Panel explanatory copy: “Background colors
may shift slightly to keep climb colors distinct on the board. Your saved palette stays
unchanged.” Old recipes are labeled Original, and this assurance is tied to seamless v2.

Use `WeakMap<BoardDefinition, PreparedGeometry>` and `WeakMap<SpatialLightEffectGroup,
FrameMemo>`; memo entry contains definition identity, assignments identity, held frame
index and rendered `LightScene`. Cache key changes on palette/seed/shape/target/reserve/
intensity/period/version through immutable group replacement; assignments and definition
identity are explicit invalidators. One result per group, not an ever-growing timestamp
map. Prepared closed paths may live on the same entry keyed by definition, group, and
clock frameCount, without assignments unless path root eligibility is mask-dependent.
If root eligibility depends on assignments include that identity in path preparation too.
Document the immutable-input contract. Don't reuse whole `renderAnimationFrame` results:
assigned effects still require their current fractional time. Same spatial group identity
and same held frame may return the same immutable scene reference across 10-FPS preview calls.

Remove cancellation based solely on `lastAppliedScene.length === 0`; output emptiness
is a valid scene, not an explicit Stop action. Ensure intentional empty-frame writes do
not trigger cancellation via `operation === clearing` either: use existing preview/light
complete-scene encoding for empty animation frames, reserving clear cancellation for an
explicit clear command. Initial empty scene must start scheduled animation despite clear
state emissions. Explicit stop/clear/disconnect/visibility loss/unmount still cancel;
no automatically resumed BLE on wake-lock reacquisition.

Acceptance:
- [ ] All v2 presets at 0% emit zero spatial lights and roles remain exact.
- [ ] Rendered nonblack v2 decorative colors never equal a role byte after API-2 encoding.
- [ ] Same held-frame requests reuse prepared work; all listed changed inputs invalidate.
- [ ] Empty initial birds and later quiet frames keep playback alive until explicit stop.
- [ ] Local controlled diagnostic records cold versus warm graph construction and
  10-FPS repeated-frame timings for Snake/Pac-Man and an inexpensive control recipe;
  report actual environment/sample count. No physical phone or throughput claim without measurement.

### Unit 3: Persisted v2 and explicit adoption in existing Effects UI

Files: `web/src/board-renderer/types.ts`, `web/src/light-effects/preset-library.ts`,
`web/src/drafts/codec.ts`, `web/src/playlists/portable-codec.ts`,
`web/src/route-editor/LightEffectsPanel.tsx`, existing reducer update action.

```typescript
// SpatialLightEffectGroup keeps all other fields and recipe union unchanged.
readonly recipeVersion: 1 | 2;
export function upgradeSpatialPreset(group: SpatialLightEffectGroup): SpatialLightEffectGroup;
```

Upgrade is pure and idempotent for v2. Use frozen spread preserving all authored fields,
with version 2 and maximum of old/new default period. Both strict codecs decode exactly
versions 1 and 2, preserve whichever came in, reject unsupported future versions and
continue rejecting invalid recipes/masks. Existing storage v4 and portable envelope
version remain valid; embedded recipe version owns this semantic evolution. Roundtrip
both versions through stored drafts and portable playlist snapshots, with no identifier
changes or migration write on read.

Existing panel gets Original loop / Seamless loop text and one `Use seamless loop`
button for selected v1. Before click show e.g. “Uses a 120-second loop; keeps your colors,
shape, targets and light reserve.” If an existing period is longer show that preserved
value. Button dispatches one existing `update-effect-group` with the upgraded group
fields. Autosave is the same optimistic draft update as any effect edit. New presets
default v2. Replace generic Shape text with per-kind readable label for now-functional
controls where possible; reuse existing label/input pattern, no new screen or modal.

Acceptance:
- [ ] V1 open/render/export/reload never upgrades or rewrites its visual recipe.
- [ ] Explicit upgrade retains ID/seed/recipe/palette/mask/intensity/reserve and preserves
  custom longer timing; saved upgrade survives reload and playlist export/import.
- [ ] UI exposes the duration change before adoption and v2 palette adjustment afterward.
- [ ] Unknown versions fail explicitly without silently dropping effects or drafts.

## Implementation Order

1. Capture legacy fixtures, then closed v2 renderer + geometry; prove the graph join
   before building the other themed trajectories.
2. Color guard/cache/empty-frame lifecycle using the new renderer contracts.
3. Widen codecs/types, default registry and explicit UI adoption, then browser persistence.

Stories are three resume points, one implementation owner. The type widening can be
introduced with Unit 1 to keep compilation green; adoption behavior remains Unit 3.
Run feature-level independent review after all child verification; child stories go
straight to done. No separate review agents for each effect or checkpoint.

## Implementation notes

- Execution capability: GPT-5.6 Luna at xhigh, under the authorized autopilot scope; review weight is standard.
- Child checkpoints are done. The v1 renderer is physically isolated in `spatial-frame-v1.ts`, the dispatcher preserves the public call, and v2 uses prepared geometry, a bounded closed path cache, and one immutable held-frame memo per group. Root-owned Frogger planning helpers are integrated from commit `1c66bf2`.
- All ten new presets use the designed 90–150 second v2 defaults. V2 tests cover seeds 0/7/42, default and non-integral custom periods, cycle and join state, exact graph adjacency for every Snake/Pac-Man frame including wrap, masks, controls, direction, intensity zero, role composition, Matrix stream distribution, per-member bird clipping, and the planned Frogger helper's dense traffic/wait/continuity cases. Captured v1 signatures cover all ten themes at the original period boundary frames.
- Color protection uses the existing API-2 quantizer and exhaustive 256-source-byte tests; it provides exact encoded-role separation and black semantics while leaving saved palettes unchanged. Empty Bird frames use preview writes and remain part of the animation lifecycle until explicit stop/clear/disconnect/visibility cancellation.
- Local v2 reuse diagnostic from root: Darwin arm64, Node v25.9.0, ten themes at seed 42, 240 new poses plus 960 held subticks per theme over five warmed rounds; mean new-pose work was 59.77 microseconds and held-frame reuse was 0.07 microseconds, with the same immutable scene reference for every held subtick. Earlier 1,000-call local measurements recorded Snake 21.596ms cold/0.000387ms warm, Pac-Man 1.664ms/0.000142ms, and Ocean 0.324ms/0.000135ms. These are local CPU diagnostics only.
- Verification: `npm test -w @cruxcontrol/web` passed 72 files / 484 tests; `npm run lint -w @cruxcontrol/web`, `npm run typecheck -w @cruxcontrol/web`, and `npm run build -w @cruxcontrol/web` passed; `npm -w web run test:e2e` passed all 7 browser scenarios, including stored v1 explicit adoption, reload, and 150-second timing persistence. Parent also completed a read-only original-vs-current v1 comparison across 1,920 cases (all ten kinds, seeds 0/7/42, four periods, eight boundary/cross-cycle times, and empty/start-role assignments) with exact scene equality.
- No adjacent production bugs were silently fixed; independent parent review and project CI remain the feature's release gates.

## Testing

- `web/src/light-effects/spatial-frame.test.ts`: bind current expectations explicitly
  to v1 snapshots; old cross-cycle variation expectations remain valid legacy tests.
  Capture representative legacy outputs before extracting v1 (all ten kinds, seeds,
  boundaries), do not replace those with whatever the new renderer produces.
- New `spatial-frame-v2.test.ts`: all kinds × seeds 0/7/42 × default/custom period;
  compare frames across two cycles, but also inspect last two/first two frames and
  per-theme invariants. Periodic equality alone cannot detect a teleport. Graph edge
  tests traverse the entire cycle and join; ball velocity must reflect at bounds;
  offboard enter/exit templates and frog planned wait/landing points are tested before
  projection. If analytic pose helpers need exports for these assertions, keep them
  in the v2 module, not an application-wide abstraction. Colors/brightness/tails/chew
  state have the same wrapping clock. Test changed shape, direction, masks, two layers,
  all-role-board, one eligible point, tiny reserve, empty palette defensive behavior,
  negative elapsed and non-integral accepted period.
- `spatial-colors.test.ts`: exhaustive 256 source bytes against real Fullride roles
  after existing API-2 quantization, black semantics and stored palette nonmutation.
- Cache tests check stable returned reference for repeated held times and fresh output
  after changed immutable inputs; a spy/counter on preparation can prove graph work
  reused without brittle elapsed-millisecond assertions. Diagnostic performance numbers
  belong in implementation evidence, not flaky CI thresholds.
- `web/src/route-editor/use-editor-lighting.test.tsx`: mock controller starts birds on
  empty route, advances through quiet/lit/quiet, explicit Clear and Stop remain stopped,
  disconnect/hidden/unmount prevent later writes. Preserve latest-frame-wins/no-overlap
  and maximum capacity tests.
- `web/src/drafts/codec.test.ts`, `web/src/playlists/portable-codec.test.ts`, panel/editor
  tests and one production-build browser scenario: load a v1 saved climb, verify no
  automatic change, opt in, reload v2, verify assignments and settings remain. Include
  export/import both versions. Existing climb/playlist regression suite remains required.
- Run targeted tests during work, then full Vitest, lint, typecheck/build and browser
  suite. Required PR CI and independent feature review must pass before delivery.

## Mockups

`.mockups/screens/epic-build-effects-hardening-seamless-loops/index.html` is a standalone
vanilla HTML/JS motion study for all ten kinds with actual 305-position geometry. It
inherits locked design tokens without changing global UI motion. All motion here is
explicitly ambient, non-input-gating, 2-FPS held states. Playback is opt-in (including
reduced motion); pause, scrub, frame step, speed and join controls are keyboard usable.
The original-panel upgrade button/copy is shown beside the study. These are executable
trajectory studies, not claims of final color quantization or masked production output.

Inspected 2026-09-05 in Chromium at 1200×1000 and 390×844; all ten selection/scrub/frame
paths ran, no JS errors or horizontal overflow, screenshots visually inspected. Snake's
coherent body and board geometry read at both sizes. Example lit counts were within
reserves (Matrix/Birds intentionally vary). Production must implement controls/seeded
variants beyond this fixed-seed study and verify the stronger contracts above.

## Risks

- **Sparse geometry:** even continuous targets can change their nearest hold abruptly;
  test continuous pose plus projected adjacency where the theme requires it. Hide
  masked points rather than moving actors elsewhere. Physical-board dogfood remains
  the last check of readability, not an excuse to waive deterministic correctness.
- **Finite cycle vs arbitrary controls:** arbitrary real-valued speed cannot both run
  freely forever and close at a fixed arbitrary duration. V2 maps speeds/fade rates to
  whole-cycle counts; legacy values stay stored. Short user periods can look rapid;
  default long periods are the tuned experience.
- **Frogger choreography:** do not promise collision avoidance from a per-frame scoring
  heuristic. Plan against deterministic traffic; if no safe landing exists at the
  intended beat, wait on the bank until a planned gap, preserving closed return timing.
- **Legacy visual fidelity:** isolate v1 and assert fixtures; do not share new color
  behavior into legacy accidentally. Common stop semantics are lifecycle repairs.
- **Color appearance:** exact encoded-role separation cannot guarantee perceived hue
  difference on physical LEDs; show the actual adjusted preview and keep editable palette.
- **Cache staleness:** mutable caller edits would break identity keys. Existing types and
  codecs return readonly/frozen data; require immutable replacement in new code/tests.
- **Downgrade:** older app builds cannot understand v2 recipes. Do not claim downgrade
  compatibility or roll back to a v1-only build after authored v2 data. No storage schema
  changes are required; the future safe-update arc handles active update timing.

## Other agent review

No extra advisory agent dispatched from this bounded delegated design. Parent owns
independent review/implementation orchestration; prior only-questions decisions fix
product direction. Design alternatives are reversible and no new research domain or
external hardware capability assumption blocks implementation.

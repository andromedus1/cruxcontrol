---
id: feature-sparse-backgrounds
kind: feature
stage: review
tags: [ui, ble]
parent: null
depends_on: [story-background-dogfood-design]
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
---

# Ship the approved sparse background animations

Andrew selected the three-trail Matrix study and explicitly requested implementation
of all four other studies: fireflies, shooting stars, jellyfish, and embers.

## Design decisions

- Approved source: `.mockups/screens/story-background-dogfood-design/index.html`,
  `matrix-three`, `fireflies`, `meteor`, `jellyfish`, and `embers` studies.
- New defaults reserve 8, 6, 9, and 10 holds respectively, never more than 11.
  Matrix retains its ten-hold default. Existing 20-total-light / 2-FPS admission,
  protected climb colors, and user-editable palettes remain authoritative.
- New presets use 120-second closed sequences and recipe version 2 only.
- Replace the current v2 Matrix rendering in place; no library rewrite or palette,
  ID, seed, reserve, period, target, playlist, or authored-setting changes. V1
  rendering stays frozen. New Matrix defaults use three rain columns; saved
  column settings remain honored as a pool of fall lanes with at most three
  simultaneous streams, each long enough to read. Budget splits 4/3/3 at ten.
- Existing UI controls and strict snapshot/import codecs are extended; no new
  screen, persistence schema, library dependency, or transport change.

## Mockups

- `.mockups/screens/story-background-dogfood-design/index.html` — approved by Andrew
  in chat on 2026-09-05; the two-trail Matrix alternative is not selected.

## Architectural choice

Extend the existing pure v2 renderer and snapshot recipe union. This keeps the
controller scheduler, frame cache, target masks, palette editor and capacity
planner as the existing integration points. Alternatives: baking long frame arrays
would duplicate geometry and complicate edits; introducing a third recipe version
and copying every renderer would add compatibility machinery without a new storage
contract. Existing v2 Matrix receives the approved visual revision in place.

The trickiest unit is Matrix's physical-column mapping after route masks and API-2
color quantization. Prepare lane geometry from the complete board, then mask outputs;
never relocate a skipped cell into a neighboring column. Heads enter at the edge,
tails follow behind, and the whole trail exits before the lane restarts or moves.
At reserve 10 the approved scene allocates four/three/three cells. Smaller custom
reserves reduce active trails/tail length; they must not exceed their saved reserve.

## Implementation units

1. `web/src/board-renderer/types.ts` and `light-effects/preset-library.ts` extend
   `SpatialEffectKind` and `SpatialRecipe` with `fireflies`, `shooting-stars`,
   `jellyfish`, `embers`. New recipes need only their discriminant (`{kind: ...}`);
   period, intensity, palette, footprint, seed and target already supply useful
   controls. Do not invent additional shape controls. Presets are v2-only, 120s,
   reserves 8/6/9/10. Matrix new creation uses columns:3 and its existing 90s
   default; saved periods are untouched. Choreography scales to authored period.
2. `web/src/light-effects/spatial-frame-v2.ts` and focused adjacent module(s) if
   useful implement the approved three-stream Matrix and four natural themes.
   Reuse `SpatialLoopClock`, normalized geometry, immutable held-frame cache,
   role-color guarding and intensity. Signature remains
   `renderSpatialGroupV2(definition, assignments, group, elapsedMs): LightScene`.
   Theme-local helpers stay internal unless a meaningful contract benefits tests.
3. `web/src/drafts/codec.ts`, `playlists/portable-codec.ts` and related round-trip
   tests accept valid new v2 snapshots, reject v1 new-theme recipes and malformed
   snapshots, and preserve arbitrary authored settings. Whole-library backup
   acceptance follows the strict codecs. Do not alter IndexedDB versions/records.
4. `web/src/route-editor/LightEffectsPanel.tsx` offers the four new presets using
   existing controls, hides the recipe-specific shape input for the new recipes,
   and keeps the existing palette editor. Retired Frogger remains unavailable for
   creation but readable/editable. UI tests cover create/save/reopen and color edits.

## Testing and acceptance

- Verify full cycles of all new themes across seeds, default/custom periods,
  intensity zero, palette edits, target masks and reserves 1..11. No output above
  the declared reserve; climb role output stays exact in composed frames.
- Verify actual trajectories at the cycle seam, not only periodic equality.
  Matrix has aligned vertical trails, age-based brightness, staggered entrances,
  off-board reset gaps, and three possible simultaneous streams at default.
- Fireflies change glowing locations only while dark; meteors have a directional
  head/tail and quiet gaps; jellyfish retains a compact pulsing bell/trailing
  tentacles; embers have six low coals and at most four rising/fading sparks.
- Preserve legacy-v1 golden outputs, stored-v2 Matrix serialized fields, and all
  existing saved/imported themes. Future/invalid versions still reject strictly.
- Run unit suite with two workers, lint, typecheck/build, browser workflow CI,
  and a production-rendered visual check on Fullride geometry. Physical brightness
  remains a dogfood check rather than a claim from browser screenshots.

## Risks

- API-2 palette quantization may flatten fades: inspect encoded head/tail contrast
  using the shipped palette and keep role-color protection. Avoid fake browser-only
  subframe smoothing or gradients that the board cannot reproduce.
- Sparse route masks can weaken silhouettes: keep climb lights exact and omit
  masked cells, with no increased reserve to compensate.
- Test matrices built around ten legacy kinds must continue testing precisely
  those kinds when four v2-only recipes are added; update drifted enumeration
  fixtures without weakening legacy golden expectations.

## Execution

One feature-owning implementation worker owns all production files and tests;
parent coordinates approved-design fidelity, phone backup/update readiness,
documentation and independent review. No child stories: tightly coupled renderer,
recipe and codec changes fit one integration stride. Standard review weight from
project conventions, one independent pass after integrated verification.


## Implementation notes

- Execution capability: one feature-owning worker using the implement skill; direct
  reads resolved the existing integration seams without exploratory delegation.
- Review weight: standard, from project conventions. Parent owns the single
  independent pass, browser workflow verification, CI and PR delivery; this worker
  stops at review as requested.
- Added four kind-only v2 recipe variants and presets (Fireflies 8, Shooting stars 6,
  Jellyfish 9, Embers 10), all with 120-second defaults and the existing generic
  palette, intensity, timing, target and reserve editor. Frogger remains absent
  from creation; saved Frogger and other historical recipes remain supported.
- Replaced only v2 Matrix choreography, with three staggered trails at the default
  ten-hold reserve. Saved column counts define a disjoint lane pool; physical
  columns are prepared before masks, and falling actors leave before reentry.
  New Matrix creation uses three columns. Every saved group field stays untouched.
- `spatial-sparse.ts` owns the focused five-theme geometry and color treatment.
  Projection uses complete geometry, then omits masked/duplicate cells without
  relocating actors. The existing held-frame cache, semantic-role protection,
  scheduler and twenty-light admission remain authoritative.
- Physical color adaptations: Matrix normalizes each authored palette hue before
  applying age-based decay, because old dark greens otherwise vanish in later tail
  cells. Pale heads remain brighter after API-2 quantization. Shooting-star decay
  uses visible RGB332 steps (`1/.8/.6/.45/.32/.26`); the mock's final `.08` level
  packed to black, making a sixth cell permanently unavailable. The authored
  palette remains unchanged in storage. These are board-fidelity adaptations,
  not new theme settings.
- Strict draft and portable snapshot codecs accept the four new v2 kinds and
  reject v1/future versions and invented shape fields. Whole-library backup
  round trips all new recipes through these existing boundaries. No database
  version, migration, dependency or transport changes.
- Tests added: full-cycle reserve and encoded role-color checks over 57,750 held
  poses (five themes, three seeds, default/custom periods, reserves 1..11);
  intended-cell masks and composed climb colors; editable palette/intensity and
  held-frame reuse; actual Matrix 4/3/3 tails and encoded contrast; firefly perch
  changes during darkness; meteor descent, alternating passes, quiet gaps and a
  six-cell peak; compact jellyfish bell/tentacles and nearby seam poses; stable
  low coals, sparking embers and their seam. Strict draft/portable/backup tests
  preserve authored snapshots. An actual editor-to-IndexedDB integration test
  creates all four effects, edits palettes/timing/intensity, autosaves, closes the
  database and reopens exact saved values in the editor.
- Simplification: removed the superseded v2 Matrix renderer. Legacy golden fixture
  inputs explicitly retain their historical five-column recipe; fixture digests
  are unchanged. Legacy-only and shape-control test matrices now select the kinds
  they actually cover. Revised Matrix trajectory expectations use its approved
  six falls; the three-stream assertion inspects the full cycle.
- Adjacent issues parked: none. Initial failures were the expected old Matrix
  choreography/enum fixtures; their motion and compatibility guarantees remain
  asserted against the approved design.

## Verification

- Final local unit suite: **614 tests / 84 files passed**, with `--maxWorkers=2`.
- Lint passed. TypeScript and production build passed. Build output is isolated at
  `/tmp/cruxcontrol-sparse-build`; the running phone preview's `web/dist` is untouched.
- Focused production visual checks by parent confirmed aligned three-stream Matrix,
  compact jellyfish and embers; parent completes final visual and browser checks
  against the final artifact before delivery.
- Parent's fresh read-only phone backup contains **27 climbs / 4 playlists** and no
  currently saved Matrix/Frogger. No phone records were modified by this feature.
  Backup records remain private outside Git. Parent verifies software activation
  preserves the current library rather than replaying an older dogfood snapshot.

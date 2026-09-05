---
id: epic-build-effects-hardening-curious-bee
kind: feature
stage: review
tags: [ui, ble]
parent: epic-build-effects-hardening
depends_on: [epic-build-effects-hardening-seamless-loops]
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
---

# Curious bumblebee background effect

## Brief

Add a selectable curious bumblebee preset after existing-loop improvements. Inherit the selected study at .mockups/screens/epic-build-effects-hardening-animation/index.html: wandering flights, hovering and occasional darts in a closed two-minute sequence. Body and wing colors must be independently editable and saved through the normal effect palette; compare against foot-only colors and preserve role protection after hardware encoding. Use existing target, footprint, intensity, period, preview and playback paths and versioned codecs. Test continuous joins, deterministic output, palette changes, masks, capacity and save/share round trips.

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

## Architectural choice (prepared under autopilot)

Extend the spatial recipe union and registry with `bumblebee`, version 2 only, using the
same v2 clock, color guard, projection and frame cache as existing backgrounds. A separate
Canvas/UI animation would not describe the physical board; a separate controller runtime
would duplicate lifecycle and capacity behavior. Neither is warranted.

The accepted curious study is the primary motion reference. Six seeded interior
waypoints form a closed tour. Each stop has a designed hover followed by an eased flight;
several flights are shorter quick darts. Add gentle local hover motion and alternating
wing poses readable at 2 FPS. No free-running random destination reseeding or endpoint reset.

## Implementation units

1. `web/src/board-renderer/types.ts`: extend `SpatialEffectKind` and `SpatialRecipe` with
   `{ readonly kind: 'bumblebee'; readonly hoverFraction: number }`, finite 0–0.8 inclusive.
   A fraction sets the share of each visit spent hovering. Default 0.4; ordinary effect
   period/intensity/footprint/target/seed fields remain unchanged. Default period 120000ms,
   footprint 5, two-color palette. No database or portable-envelope version bump.
2. `web/src/light-effects/spatial-frame-v2.ts` (or a narrow `bumblebee-frame.ts` helper if
   existing module size warrants it): `sampleBumblebeePose(group, clock)` yields center,
   current activity and wing pose as pure geometry. Use the current seeded helper; fix
   all waypoints and durations per seed. Flight progress uses smooth-ended interpolation,
   with a bounded curved deviation that vanishes at both ends. Hover displacement has
   an envelope that is zero at entry/exit, joining position and direction continuously.
   Wing timing derives from the complete cycle clock so it repeats exactly. The last
   flight returns to the first hover. Body points get palette[0]; wings get palette[1]
   (fallback to first if a valid one-color snapshot is imported). Three body positions
   plus two wing positions project through the existing v2 role/mask/encoded-color guard.
   Fewer available lights reduce the visible bee without borrowing route holds or
   exceeding the declared reserve. No displayed faster-than-board wing flutter.
3. `web/src/light-effects/preset-library.ts`: add selectable Bumblebee with v2 default.
   Do not accidentally add a v1 bee path. `web/src/drafts/codec.ts` and
   `web/src/playlists/portable-codec.ts`: accept valid v2 bee snapshot, reject v1 bee,
   invalid hoverFraction and unsupported versions. Reuse existing metadata/mask/seed limits.
4. `web/src/route-editor/LightEffectsPanel.tsx`: add hover control using existing labeled
   numeric input; body/wing palette roles must be clear. For the bee, expose two controls
   to assign the current advanced color to Body/Wings (or equivalent reuse of the app's
   palette control). Keep ordinary palette editing available where compatible. Do not
   hard-code colors in rendering or use visual-only values that don't persist. Show
   adjusted preview with existing v2 color explanation, never mutate chosen palette.

## Acceptance and tests

- Curious flight/hover/dart pattern has a continuous complete 120s default circuit,
  repeats deterministically for multiple seeds and periods, and changes meaningfully
  with hoverFraction. Test adjacent endpoint poses and actual moving+hovering intervals,
  not merely frame(t)==frame(t+period).
- Body and wings follow distinct editable palette slots; save/reload and portable
  export/import retain them, seed, targets and hover settings. A single-color imported
  snapshot degrades deliberately; a v1 bee or malformed recipe is rejected.
- Partial/full route masks, zero intensity, one-light reserve, exclusions, sparse
  targets and two layers respect color/capacity invariants. Route roles stay exact.
- Component test edits body and wings through real controls. Production browser scenario
  adds bee to saved climb, changes palette, reloads, verifies stored recipe and holds.
- Targeted unit/integration tests then full Vitest/lint/typecheck/build/e2e. Use the
  shared color/cache guarantees rather than duplicate exhaustive tests for each new kind.

## Mockups and decisions

Selected: Curious in `.mockups/screens/epic-build-effects-hardening-animation/index.html`.
Palette controls and foot-only comparison were added after user feedback. No new overall
screen; compose existing Effects panel controls. Detailed seed variations inherit the
selected movement character. Physical-board readability remains dogfooding, not a claim
of already-measured performance or higher light capacity.

## Risks and preparation

The center may move less than one LED during a hover; wing-pose changes and occasional
small position changes must make hovering legible without distant snapping. Tiny reserves
cannot show the full five-light shape, and must never trigger extra lights. Keep local
mock behavior illustrative, verify actual production projection. Prepared before upstream
code settles; feature stays drafting until seamless-loops has green integration evidence.
One feature worker, no child stories needed for this cohesive registry/renderer/UI addition.

## Design readiness (2026-09-05)

Upstream seamless-loops is at review with 484 unit tests and seven browser scenarios,
lint/typecheck/build green at af31755. Reconciled against the actual v2 dispatcher,
private project/scaledColor helpers, WeakMap frame/geometry/path preparation and strict
v1/v2 readers. Add the bee as a v2 case using a narrow pure pose helper; keep shared
color/projection private unless a real second renderer consumer requires extraction.
Existing legacy tests enumerate ten presets and must explicitly keep that original
kind list when the new registry entry appears; never manufacture a version-1 bee to
satisfy those fixtures. No directional questions remain: curious and editable body/wing
colors were selected by Andrew. One Luna xhigh owner, standard independent feature review;
no child stories because this is a cohesive addition to the now-verified shared machinery.

## Implementation notes
- Execution capability: Luna xhigh inline feature owner; the registry, pure renderer path, codecs, editor controls, and browser evidence form one cohesive surface.
- Review weight: standard, from the prepared feature design and caller's independent-review boundary.
- Files changed: `web/src/board-renderer/types.ts`, `web/src/light-effects/spatial-frame-v2.ts`, `web/src/light-effects/spatial-frame-v1.ts`, `web/src/light-effects/preset-library.ts`, `web/src/drafts/codec.ts`, `web/src/playlists/portable-codec.ts`, `web/src/route-editor/LightEffectsPanel.tsx`, `web/src/route-editor/RouteEditorWorkspace.css`, plus their unit/component tests and `web/e2e/spatial-effects.spec.ts`.
- Tests added/removed: seeded six-stop pose and activity coverage; strict draft/portable codec cases; real editor Body/Wings controls; production save/reload scenario. Legacy v1 fixtures remain explicitly scoped to their original ten kinds.
- Simplification: reused the existing v2 clock, geometry, role/mask filtering, encoded-color guard, projection, cache, IndexedDB repository, and generic palette controls; no new runtime or storage layer.
- Discrepancies from design: none for the bee contract. The shared v2 module was committed separately at `62cdfe4`, with the loop-join follow-up at `eb53371`, for root's concurrent actor review fixes.
- Adjacent issues parked: none.

## Integrated review readiness

Root integrated bee with named loop corrections. Lint/typecheck/production build pass;
75 Vitest files / 509 tests pass with two workers; all 8 production browser scenarios
pass including editing Body/Wings and reloading their actual stored recipe. Default
unbounded local test concurrency caused timeouts; isolated playlist initialization test
passes and its race is being diagnosed separately. Independent standard feature review
and current PR CI remain required. No physical-board verification is claimed.

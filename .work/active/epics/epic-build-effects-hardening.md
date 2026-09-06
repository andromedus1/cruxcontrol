---
id: epic-build-effects-hardening
kind: epic
stage: done
tags: [ui, ble, data, infra]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
---

# Preserve the library and improve build reliability and background animation

## Brief

Andrew endorsed the September 5 project-review recommendations and added screen-awake
support plus seamless, longer, more interesting themed animation loops and a bumblebee
background effect that flies and hovers around the board. Improve the
existing application incrementally. No rebuild is justified by the review. His existing
climbs and playlists are irreplaceable acceptance data: preserve their identities,
relationships, content, Trash state and saved effect recipes through any migration.
The child features below own delivery and inherit the preservation requirements.

## Delivery priority

Andrew's requested order for the next work arc is:

1. **Animation improvements first:** make the existing themed loops longer, more
   interesting and seamless, then add the new flying and hovering bumblebee effect.
   Design and preview the motion before implementation. Include the rendering and
   playback correctness fixes needed for those effects to behave reliably.
2. **Backup protection second:** deliver faithful whole-library backup and restore,
   then address safe application updates alongside that protection work.

The priority change does not relax preservation of existing climbs, playlists or
saved recipes. Animation work must preserve those records without requiring a storage
rewrite; any necessary schema/identity/origin migration must still have tested recovery
before it ships. Other accepted reliability and performance work remains in scope;
schedule independent optimizations after these two priorities unless needed by them.

## Accepted review work

- Complete versioned library backup/restore, including climbs outside lists, shared
  memberships, lifecycle metadata and recipes. Playlist sharing intentionally imports
  fresh copies and is not a faithful whole-library backup. Test recovery against copied
  records before a schema/identity/origin change; consider persistent-storage requests.
- Application updates must wait for saved edits and stopped playback. The current
  `autoUpdate` registration can reload active tabs; exercise old/new build transitions.
- Guard decorative colors after API-2 quantization. Confirmed example: Snake/Matrix
  logical color 24 and Start color 28 both encode to 48. Other sampled presets collide
  with Middle, Finish and Foot-only; semantic hold assignments themselves remain exact.
- Connect Snake bodyLength, Beach Ball size, Pac-Man mouthBeat and Pong paddleSize to
  rendering; their saved controls currently produce identical frames when changed.
- Make 0% intensity dark. The current nonzero guard changes black to logical color 1.
- Preserve intentionally empty animation frames. Bird Flock on an empty design starts
  with a quiet interval and is immediately cancelled by lastAppliedScene.length === 0.
- Reduce redundant preview work: 10-FPS previews recompute 2-FPS spatial poses, and
  Snake/Pac-Man rebuild board adjacency and cycle paths on every call. Profile the
  intended mobile client before changing performance architecture.
- Run browser persistence/export/import coverage in CI. Delivered in PR #12, including
  repairs to stale SVG click targets and a schema-3 assertion.

Evidence areas: `web/src/light-effects/spatial-frame.ts`,
`web/src/board-control/api-level-2-codec.ts`,
`web/src/route-editor/use-editor-lighting.ts`,
`web/src/route-editor/LightEffectsPanel.tsx`, `web/src/pwa/register-sw.ts`,
`web/src/playlists/portable-{export,import}.ts`, `.github/workflows/ci.yml`.
Review baseline: 443 unit tests, lint/build/typecheck passed. Five browser scenarios
passed after test-only repairs. Effects findings reproduced with the pure renderer,
encoder and mock API-2 transport, not new physical-board observations.

## Longer, seamless themed loops

Andrew explicitly requested that loops start and end in the same place and play
seamlessly, and that they be longer and more interesting while respecting each theme.
This applies to all ten existing spatial backgrounds: Ocean Tide, Tie-dye Spiral,
Matrix Rain, Snake, Beach Ball, Pac-Man, Pong, Bird Flock, Frogger and Fading Pentagram.
The bumblebee is an additional preset, not the sole recipient of the loop improvements.

- Each repeating recipe must close its path: position, direction, color, brightness
  and any trail/game state must join without a visible reset. Define frame-boundary
  continuity at the measured 2-FPS output cadence; do not add an accidental double hold.
- Increase meaningful sequence length, rather than merely slowing the same short loop.
  Vary actions within a closed repeating sequence in ways that fit each preset.
- Examples to explore during design: tides advance and retreat; rain streams fall;
  a ball bounces consistently at edges; Pong uses coherent paddle/ball exchanges;
  Snake and Pac-Man traverse connected paths; birds enter/cross/exit with quiet intervals.
  These are directional examples, not locked implementations.
- Replace arbitrary cycle-boundary reseeding/teleports with planned continuous joins.
  Variety must coexist with repeatable saved seeds and explicit recipe versions.
- Keep the measured API-2 limit of 20 total route/static/effect lights at 2 FPS unless
  new physical measurements support a revised profile. Never silently thin route holds.
- Preview candidate recipe motion before production changes using the motion/mockup
  workflow. Preserve existing saved designs or provide an explicit, non-destructive
  recipe-version upgrade choice; do not silently reinterpret old snapshots.

## Bumblebee background effect

Add a selectable bumblebee theme after the existing-loop improvements, within the
first-priority animation arc. The bee flies between parts of the background and pauses
to hover, with motion that reads as a bee on the board's sparse lights. Its longer
flight-and-hover sequence must loop seamlessly, including its position, direction,
brightness and any supporting visual state at the join.

Use the existing background-effect selection, preview, saved-recipe and playback paths.
The bee's palette must be editable and persisted like the other background effects,
including body and wing colors; the yellow shown in the study is not a fixed requirement.
Andrew flagged its similarity to foothold color. Validate decorative colors against the
actual controller-encoded climb-role colors and preview any adjustment without rewriting
the chosen palette or changing role assignments. Exact byte inequality alone does not
establish perceptual separation; make foothold comparison part of physical dogfooding.
Keep route holds legible and unchanged, respect the same light budget and output cadence,
and make seeded playback repeatable. Motion mockups must establish readable flight and
hovering before production changes; detailed paths, timing and appearance remain design
decisions rather than assumptions in this scope item.

## Related delivery

`story-screen-wake-lock` and `story-browser-regressions-ci` are complete, with local
review and Linux CI verification in merged [PR #12](https://github.com/andromedus1/cruxcontrol/pull/12).
Their full records are in Git and indexed by the `.work/archive/` stubs. The screen
toggle prevents automatic timeout while visible, not execution after switching apps or
manually locking the device. Browser regression failures now gate deployment. Physical
phone dogfooding remains a later acceptance check. The remaining arcs need feature design and tests;
this epic is not an instruction to implement an unreviewed recipe rewrite immediately.

## Simplification opportunity

Retain the current IndexedDB authority and board-control boundaries. Consolidate frame
preparation and controller-color validation where evidence supports it; avoid a new
rendering framework or replacement storage system solely to add these improvements.

## Directional alignment — only questions

Andrew authorized an autopilot drain after selecting the curious bee and accepting
the recommended next-work direction.
Limit that drain to this epic, respecting animation-first and backup-second sequencing;
unrelated active epics are outside the requested work order.

## Design decisions

- **Bumblebee character:** Andrew selected the curious variant from the motion study:
  wandering flights, gentle hovering and occasional darts.
- **Editable bee palette:** body and wing colors remain user-editable and saved with
  the effect. Include a foothold comparison in the preview and hardware acceptance.
- **Existing effects:** Andrew reaffirmed that the seamless-loop improvements cover
  the existing background presets as well as the new bee.

Defaults adopted for the authorized autopilot run:

- **Pacing:** theme-specific sequences, usually 1–3 minutes, with calmer nature and
  livelier games. Exact periods remain editable.
- **Saved animation adoption:** preserve saved visual behavior with an explicit upgrade
  to improved loops. No silent changes to existing saved visual behavior, climb holds
  or playlist memberships.

Code grounding: spatial poses are held for 500ms; existing persisted periods cap at
180 seconds. Saved spatial snapshots currently support recipeVersion 1 only. Several
renderers reseed geometry by cycle, and Snake/Pac-Man move by frame index, so longer
period values alone cannot satisfy the continuity requirement. An independent bounded
read-only probe found no additional directional questions beyond the three above.

## Mockups

- Bumblebee motion comparison:
  `.mockups/screens/epic-build-effects-hardening-animation/index.html`.
  Curious, mellow and busy studies use a geometry snapshot of the actual 305 Fullride
  light positions, five bee lights plus six protected sample route lights, and 2-FPS
  held poses. Play/pause, frame stepping, scrubbing and a loop-join shortcut support review.
  Colors are illustrative; this is motion alignment, not verified hardware output.
- Existing application motion tokens remain in `.mockups/design-system/motion.css`.
  The study extends background-effect exploration without changing interface animation.
- Curious selected by Andrew; body/wing palette controls and a foot-only example make
  the color concern reviewable. The standalone mock was checked in Chromium at desktop and
  phone widths: controls work, no JavaScript errors, and no horizontal overflow.
- Existing themed-loop studies and backup/update UI alignment remain for their design
  passes; the bee comparison is not sign-off on those surfaces.

## Decomposition

Use capability features with sequential implementation ordering. A single global
rewrite would couple stored-data recovery to animation changes; per-preset features
would duplicate versioning, palette and frame-cache contracts. Four cohesive features
keep each review understandable and preserve the user-requested order.

- `epic-build-effects-hardening-seamless-loops` — all existing spatial effects,
  explicit recipe upgrades, rendering correctness and measured computation reuse;
  no dependencies.
- `epic-build-effects-hardening-curious-bee` — editable, persisted curious bee using
  the verified loop/palette machinery; depends on seamless-loops.
- `epic-build-effects-hardening-library-backup` — versioned whole-library export and
  validated non-destructive restore; depends on curious-bee.
- `epic-build-effects-hardening-safe-updates` — update activation waits for saved edits
  and stopped playback; depends on library-backup.

### Decomposition risks

Legacy snapshots must not silently change. Keep explicit recipe versions and test
old readers and exports. All closed-loop state—not just position—must repeat. A
new palette must be guarded after controller conversion without corrupting saved
choices. Backup crosses two IndexedDB databases: avoid pretending they have a shared
atomic transaction; require a recoverable/non-destructive approach with honest failure
reporting. Waiting service workers must not auto-reload an active editor or board session.

## Autopilot run

Scope: this epic and its descendants only; hardware upgrades and unrelated active/backlog
work are excluded. Review weight: standard, from `.work/CONVENTIONS.md` (one independent
pass per feature and aggregate completion). Design runs use the host capability for
version/persistence contracts; implementation workers use GPT-5.6 Luna at xhigh for
these multi-module changes per implement-orchestrator. One owner per feature, sequential
production to respect dependencies; independent review and read-only design preparation
may overlap. User-facing mockups precede production changes; delegated design resolves
routine choices using the accepted direction and existing UI patterns.

## Animation wave evidence

Both animation features are done after their one independent standard review, named
corrections and green GitHub CI (33998435604 loops;33999011346 bee). Local real-browser
coverage includes explicit legacy adoption and exact Body/Wings color persistence.

Final current-renderer CPU diagnostic after bee corrections: Darwin arm64 Node25.9.0,
all 11 themes, seed 42, 240 new poses and 960 held ticks per theme, one warmup and
five measured rounds.
Median round-average new pose 57.66µs versus held tick 0.087µs; every held tick returned the
same immutable scene reference. This measures local computation reuse, not phone/BLE
throughput or increased light capacity. The 20-light/2-FPS contract remains unchanged.

Animation documentation review: fresh system pass at 972d04c found zero Critical,
High, Medium or Low issues across five current planning documents. Four informational
observations concern inventory/provenance/verified boundaries. Report is retained in
`doc-review-report.md`; final backup/update documentation will be checked after its
implementation batch. Knowledge regeneration at 3a6b32a passed with zero lint warnings
or errors and indexed only tracked project content.

## Child features reviewed and complete

All four features are done: seamless loops, curious bee, library backup, and safe
updates. Each received one independent standard pass, accepted corrections and green
CI. Final production checkpoint 54b098f passes 580 unit tests, lint, typecheck/build,
and all 12 browser scenarios; GitHub CI 34003215427 at 48c4514 is green. The epic is
ready for its separate aggregate review of capability, preservation, integration,
and release interactions. Physical board/phone dogfooding is still pending.

Andrew's later explicit request to upgrade his saved background recipes is tracked
separately in story-phone-animation-adoption, dependent on completion of this software
arc. Its read-only copy rehearsal confirms 18 effects with identical palettes and
footprints; live phone mutation and the dogfooding handoff have not occurred.

## Aggregate epic review

Approve: one standard balanced fresh-context Sol xhigh pass over 27498a2..70abe48.
No blockers, important findings, nits or rejected proposals. The receiver confirms
all four reviewed features satisfy the aggregate capability, preservation, cross-
feature update/backup, foundation and release contracts. No new fixes or rereview
are needed. Same-harness fallback is labeled accurately after unavailable other-
class OAuth. Full local and remote CI evidence remains green; physical board
acceptance and the separate authorized phone adoption operation remain later work.

## Connected-phone computation evidence

Read-only evaluation of the current renderer on the connected Pixel 8 / Chrome152,
with the CruxControl document hidden, uses all 11 themes, seed42, 240 new poses and
960 held ticks per theme, one warmup and five measured rounds. Median round-average
new pose is 1.682ms versus 7.03 microseconds per held tick; every held tick reuses
the same immutable scene reference. This measures isolated rendering computation,
not visible UI smoothness, BLE delivery, or a larger light budget. No library records
or board state were changed by the diagnostic.

## Final completion review correction

The one standard final completion pass identifies a remaining composed registration
error presentation bug: workspace setBlocked(null) replaces the registration failure
message with waiting-update success copy. Receiver confirms the finding and reopens
only the named correction, tracked by child
`epic-build-effects-hardening-safe-updates-registration-message`.
Preserve the error text through blocker changes and label the error banner accurately;
verify through mounted workspace composition. Existing independent feature/epic/final
pass counts remain one each. Close through named-fix verification and green CI, with
no repeated independent review. Phone mutation remains deferred until correction closes.

## Final named-fix closure

The final completion review's sole accepted finding is fixed in ecb3093. The real
coordinator composed with mounted App preserves the registration error while Lists
adds/clears a dirty blocker; retry succeeds without recreating runtime. Error and
reload-required headings are truthful. Red reproduction and focused verification
are recorded in the registration-message child. Full local verification passes
82 files / 581 unit tests, lint, typecheck/production build and all 12 browser
scenarios (56.8s). GitHub CI 34004335389 at ecb3093 passes all checks. No unresolved
blockers or other findings remain. Effective standard review closes by named-fix
verification; feature, epic and final completion pass counts each remain one.
The software scope is complete. Physical phone adoption remains a separate operation.

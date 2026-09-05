---
id: epic-build-effects-hardening
kind: epic
stage: drafting
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
This epic records the accepted work; feature decomposition and recipe design remain to do.

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

The interactive pass is in progress; no child decomposition or stage advancement has
occurred. Andrew is considering an autopilot drain of this work order after alignment.
Limit that drain to this epic, respecting animation-first and backup-second sequencing;
unrelated active epics are outside the requested work order.

## Design decisions

- **Bumblebee character:** Andrew selected the curious variant from the motion study:
  wandering flights, gentle hovering and occasional darts.
- **Editable bee palette:** body and wing colors remain user-editable and saved with
  the effect. Include a foothold comparison in the preview and hardware acceptance.
- **Existing effects:** Andrew reaffirmed that the seamless-loop improvements cover
  the existing background presets as well as the new bee.

Pending user choices (recommendations are proposals, not accepted decisions):

- **Pacing:** theme-specific sequences, usually 1–3 minutes, with calmer nature and
  livelier games; alternatives emphasize calm throughout or frequent playful activity.
- **Saved animation adoption:** preserve saved visual behavior with an explicit upgrade
  to improved loops; alternative is automatic use of improved loops with saved settings
  retained. Neither option changes climb holds or playlist memberships.

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

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
support plus seamless, longer, more interesting themed animation loops. Improve the
existing application incrementally. No rebuild is justified by the review. His existing
climbs and playlists are irreplaceable acceptance data: preserve their identities,
relationships, content, Trash state and saved effect recipes through any migration.
This epic records the accepted work; feature decomposition and recipe design remain to do.

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
- Run browser persistence/export/import coverage in CI. Review repaired stale SVG click
  targets and a schema-3 assertion locally; CI currently omits Playwright.

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

## Related delivery

`story-screen-wake-lock` and `story-browser-regressions-ci` are complete, with local
review and Linux CI verification in [PR #12](https://github.com/andromedus1/cruxcontrol/pull/12).
Their full records are in Git and indexed by the `.work/archive/` stubs. The screen
toggle prevents automatic timeout while visible, not execution after switching apps or
manually locking the device. Browser regression failures now gate deployment. Physical
phone dogfooding remains a later acceptance check. The remaining arcs need feature design and tests;
this epic is not an instruction to implement an unreviewed recipe rewrite immediately.

## Simplification opportunity

Retain the current IndexedDB authority and board-control boundaries. Consolidate frame
preparation and controller-color validation where evidence supports it; avoid a new
rendering framework or replacement storage system solely to add these improvements.

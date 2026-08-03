---
id: story-fix-saved-climb-effect-playback
kind: story
stage: done
tags: [bug, ui, ble]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Play saved climb effects outside the editor

## Symptom

An effect previews and lights correctly in Edit Climb, but after saving and selecting the
climb from My Climbs or a list, `Light this climb` does not start the effect.

## Root cause

`toClimbViewRecord` drops saved `effectGroups`, and `ClimbDetail` directly projects only
assignments through the static scene helper. The editor alone owns the capacity-safe
animation hook, even though both the library and playlist reuse `ClimbDetail` for lighting.

## Fix approach

Carry saved effect groups through the source-neutral climb view record and make
`ClimbDetail` use the same shared renderer and measured playback hook as the editor.
Because playlist play-through already delegates to `ClimbDetail`, this repairs both
surfaces without adding another scheduler.

## Regression test

Projection coverage proves local effects retain identity. Climb-detail coverage proves a
saved spatial effect contributes its independent lights to the first board scene and the
displayed preview.

## Implementation notes

- **Execution capability**: host-owned focused integration repair. Library and playlist
  both converge on `ClimbDetail`, so one shared playback seam fixes both surfaces.
- **Root cause confirmed**: the local draft projection omitted `effectGroups`, after which
  `ClimbDetail` called the static assignment-only scene helper.
- **Files changed**: climb-view contract/projection; detail preview and lighting path;
  library/playlist/projection regression tests.
- **Verification**: the regression tests failed with a two-light static scene before the
  fix and pass with spatial lights afterward. Full suite passes (68 files, 425 tests), as
  do typecheck, lint with zero warnings, and production/PWA build.
- **Bounded inline review**: approved. The repair reuses the existing two-pass renderer,
  measured capacity preflight, two-FPS scheduler, cancellation, and role protection; it
  introduces no second animation runtime. Playlist play-through inherits the exact path.

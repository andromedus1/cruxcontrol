---
id: epic-route-creation-editor-workspace
kind: feature
stage: drafting
tags: [ui, ble]
parent: epic-route-creation
depends_on:
  - epic-route-creation-local-draft-library
  - epic-climb-browser-fullride-renderer
  - epic-board-control-light-scenes
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Visual Route Editor and Connected Lighting

## Brief

Deliver the responsive Fullride route-setting workspace that completes the local
create-save-light loop. The editor composes the existing definition-driven renderer,
local draft library, installation/controller contract, and compact browser patterns.
The user can tap or keyboard-activate any physical hold, cycle or directly assign the
four semantic roles, remove assignments, edit primary and optional metadata, save at
any time, reopen a draft, and send its current scene to the board with a persistent
“Light draft” action.

Advanced Light mode assigns any of the controller's 256 quantized colors to individual
holds while preserving semantic climb roles as the ordinary authoring mode. Optional
Live Preview is visibly off by default and uses the completed controller's bounded
latest-frame-wins preview operation when enabled. The workspace exposes explicit
connect/reconnect and truthful busy/error states, but it does not encode protocol
bytes, access Web Bluetooth directly, validate for Kilter publication, query a
catalog, publish/authenticate, schedule animations, or implement party mode.

## Epic context

- Parent epic: `epic-route-creation`
- Position in epic: user-visible integration capability consuming the local draft
  library plus completed renderer and board-control features.

## Inherited design decisions

- Drafts can be saved and lit in any state; no required starts, finishes, role counts,
  grade, or description gate either action.
- Name and angle lead the editing surface; grade, description, and setter notes are
  optional.
- A hold tap cycles `unused → start → middle → finish → foot-only → unused`; an
  explicit role toolbar supports direct assignment.
- Ordinary authoring uses green start, blue middle, red/pink finish, and gold/yellow
  foot-only presets. Advanced Light exposes all 256 API-level-3 colors without
  redefining those semantic roles.
- “Light draft” stays persistent. Live Preview is optional, defaults off, and must
  never create an unbounded queue of stale Bluetooth writes.
- Android and desktop Chromium are the direct-control clients. Unsupported transports
  remain usable for offline editing and saving with an explicit browse/edit-only
  state.
- Kilter publication/authentication, catalog work, other boards, iOS control, and
  party/audio visualizers are excluded from this feature.

## Research briefs

- `docs/briefs/data-model.md` — four role semantics and placement-addressed climb data.
- `docs/briefs/hardware-and-protocol.md` — API-level-3 256-color output and physical
  placement-to-LED mapping.
- `docs/briefs/board-control-web-bluetooth.md` — explicit user gesture, serialized
  operations, recoverable failures, and Chromium constraints.
- `docs/briefs/board-rendering-and-filtering.md` — responsive board-forward UI and
  renderer interaction constraints.

## Foundation references

- `docs/ARCHITECTURE.md` — Route Editor composition over Board Renderer and Controller
  Profiles/Transports.
- `docs/SPEC.md` — Route Creation, Board Control, mobile capability, and offline-first
  constraints.
- `docs/PRINCIPLES.md` — wall-session loop, accessibility, local ownership, and
  complementary automated/physical verification.

## Mockups

- Inherits design system: `.mockups/design-system/`
- Responsive composition and board prominence inherit
  `.mockups/screens/epic-climb-browser/option-hybrid.html`.
- Dedicated route-editor mockups pending — see parent epic's
  `## UI alignment deferred` note. Under autopilot, resolve layout from the locked
  compact, touch-safe browser composition rather than inventing a new visual system.

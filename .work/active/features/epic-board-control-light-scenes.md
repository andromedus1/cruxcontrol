---
id: epic-board-control-light-scenes
kind: feature
stage: drafting
tags: [ble, ui]
parent: epic-board-control
depends_on: [epic-board-control-protocol-codec, epic-board-control-bluetooth-session]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Light Scenes on the Connected Fullride

## Brief

Compose the controller contract, API-level-3 codec, and Web Bluetooth session into the
user-visible light/clear capability. A caller can submit any scene of Fullride LED
positions and quantized colors regardless of whether it is an empty, incomplete, or
conventional climb. The surface exposes connection status, explicit Connect,
Light/relight, and Clear behavior, while preserving the four semantic Kilter role
presets and accepting arbitrary custom colors from the route editor's Advanced Light
mode.

This feature owns end-to-end application orchestration and failure recovery, not climb
selection, route validity, draft persistence, or animation scheduling. It proves the
path with the mock session in automated tests and ends with a documented manual
checkpoint on Andrew's Fullride 7x10: connect from Android Chrome, light a scene that
includes all four role presets plus custom colors across multiple writes, confirm the
expected physical LEDs, clear them, disconnect, and reconnect. The item may reach
review with CI evidence, but the epic cannot be declared hardware-verified until this
checkpoint is recorded.

## Epic context

- Parent epic: `epic-board-control`
- Position in epic: integration capability consuming both protocol and transport
  foundations; it exposes the board-control operation used by route creation.

## Inherited design decisions

- Any draft or freeform light scene may be lit; no climb-shape validation gates the
  command.
- Full API-level-3 color access ships now, with green start, blue middle, red/pink
  finish, and gold/yellow foot-only as convenient semantic presets.
- One active board controller is supported; Connect is explicit.
- Party modes, audio response, iOS, additional boards, and catalog-driven climb
  browsing are outside this feature.

## Research briefs

- `docs/briefs/hardware-and-protocol.md` — physical address mapping and protocol
  expectations.
- `docs/briefs/board-control-web-bluetooth.md` — lifecycle, write ordering, errors, and
  real-hardware test boundary.

## Foundation references

- `docs/ARCHITECTURE.md` — Board Domain to controller command flow.
- `docs/SPEC.md` — Board Control capability.
- `docs/PRINCIPLES.md` — the wall-session loop and complementary CI/hardware tests.

## Mockups

- Inherits design system: `.mockups/design-system/`
- Mockups pending — see parent epic's `## UI alignment deferred` note.

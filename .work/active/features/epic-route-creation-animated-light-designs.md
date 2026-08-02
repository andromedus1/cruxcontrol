---
id: epic-route-creation-animated-light-designs
kind: feature
stage: drafting
tags: [ui, ble, data]
parent: epic-route-creation
depends_on:
  - epic-route-creation-editor-workspace
  - epic-board-control-light-scenes
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Saved animated light designs

## Brief

Make lighting effects part of locally saved climb designs. The editor can assign
coordinated Pulse, Color Cycle, Wave, Twinkle, and alternating pulse effects to
decorative or climbing holds without restricting which holds are eligible. Effects
have saved palette, speed, intensity, and group identity; several groups may run at
once. Static assignments remain the default.

The on-screen board previews effects without hardware. Lighting a draft starts a
BLE animation that respects the connected controller's API level, coalesces stale
frames, and stops safely on user request, clear, disconnect, editor exit, or page
visibility loss. Eyedropper copies only the instantaneous base color, not effect
membership.

As part of the same editor simplification, remove the direct Start, Middle, Finish,
and Foot-only toolbar buttons. Cycle remains the way to set semantic climb roles;
the visible tools become Cycle, Erase, Eyedropper, and Advanced Light.

## Strategic decisions

- Effects are persisted with the climb rather than existing as a separate party-mode
  surface.
- Any assigned hold may be animated, but ordinary climb roles remain static unless
  the user explicitly adds an effect.
- Shared effect groups coordinate multiple holds; multiple groups may coexist.
- The existing API3 color model remains authoritative and API2 reduction occurs only
  at the hardware boundary.

## Simplification opportunity

Reuse the light controller's latest-frame coalescing and the renderer's assignment
index. Remove four redundant direct-role controls while keeping unrestricted role
creation through Cycle.

---
id: epic-board-control-bluetooth-session
kind: feature
stage: drafting
tags: [ble]
parent: epic-board-control
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Web Bluetooth Controller Session

## Brief

Implement the browser transport adapter for one active Kilter/Aurora controller:
explicit user-gesture discovery, GATT connection and Nordic UART characteristic
resolution, serialized writes, disconnect handling, remembered-device reuse where the
browser permits it, and honest unsupported/error states on clients without Web
Bluetooth. The adapter implements the controller transport contract established by
`epic-universal-board-platform` and targets Android and desktop Chromium.

This feature also provides a deterministic mock transport/session adapter that records
ordered writes and simulates connection, disconnect, and failure transitions. That
mock is the normal CI seam and enables downstream UI and orchestration tests without a
board. The real adapter receives a documented manual smoke-test checklist, but final
physical LED behavior is verified in the downstream lighting feature after real
protocol bytes and scenes are composed.

## Epic context

- Parent epic: `epic-board-control`
- Position in epic: transport foundation parallel to the pure protocol codec; consumes
  the controller contract from the parent epic's external dependency.

## Inherited design decisions

- Device selection starts only from an explicit Connect action.
- The first milestone supports one active controller and Android/desktop Chromium.
- Browser-granted devices may be remembered, but reconnect behavior must respect
  browser user-gesture requirements and re-resolve invalidated GATT attributes.
- iOS, other board families, party animation, and speculative background reconnect are
  out of scope.

## Research briefs

- `docs/briefs/board-control-web-bluetooth.md` — secure context, user gesture,
  reconnect lifecycle, GATT invalidation, serialized operations, and mock strategy.
- `docs/briefs/hardware-and-protocol.md` — discovery/service/characteristic UUIDs and
  controller naming convention.

## Foundation references

- `docs/ARCHITECTURE.md` — Controller Profiles & Transports and Web Bluetooth risk.
- `docs/SPEC.md` — Chromium support and explicit degraded capability.
- `docs/PRINCIPLES.md` — capability detection and hardware-independent contract tests.

## UI alignment deferred

The connection status/control component is a net-new surface. Autopilot inherits the
locked design system at `.mockups/design-system/`, but no interactive board-control
screen was selected. Feature design should compose the established compact,
touch-safe component language and treat dedicated mockups as pending parent alignment.

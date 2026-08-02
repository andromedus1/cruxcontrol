---
id: epic-board-control-protocol-codec
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

# Aurora API-Level-3 Lighting Protocol Codec

## Brief

Deliver the deterministic protocol core that converts an arbitrary per-LED light
scene into the framed, checksummed, ordered byte writes accepted by the Fullride
controller. It covers API-level-3 position/color encoding, all 256 quantized RGB
values, packet partitioning, framing, checksums, 20-byte transport chunking, and an
explicit clear scene.

This feature is deliberately independent of Web Bluetooth and React. It establishes
pure behavior that can be exhaustively verified in CI and consumed by any future
transport adapter. It does not discover devices, own connection state, interpret
climb validity, animate scenes, or implement API-level-2 compatibility.

## Epic context

- Parent epic: `epic-board-control`
- Position in epic: independent protocol foundation; the lighting orchestration
  feature consumes its encoded write batches alongside the session adapter.

## Inherited design decisions

- The lighting boundary accepts arbitrary scenes without climb-validity rules.
- API level 3 is the Fullride first-milestone protocol; all 256 compressed colors are
  representable directly.
- The four Kilter roles are application presets, not restrictions in the codec.
- Party animation, API level 2, iOS, and non-Kilter controllers are out of scope.

## Research briefs

- `docs/briefs/hardware-and-protocol.md` — API-level-3 hold encoding, message packet
  markers, framing, checksum, and BLE write chunk sizing.
- `docs/briefs/board-control-web-bluetooth.md` — ordered-write requirement at the
  transport boundary.

## Foundation references

- `docs/ARCHITECTURE.md` — Controller Profiles & Transports; ports at real edges.
- `docs/SPEC.md` — Board Control and protocol-fidelity requirements.
- `docs/PRINCIPLES.md` — test contracts without scarce hardware.

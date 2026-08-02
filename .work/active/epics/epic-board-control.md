---
id: epic-board-control
kind: epic
stage: drafting
tags: [ble]
parent: null
depends_on: [epic-universal-board-platform]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-08-02
research_refs:
  - docs/briefs/hardware-and-protocol.md
  - docs/briefs/board-control-web-bluetooth.md
  - .research/analysis/landscapes/climbing-board-ecosystem.md
---

# Board Control: BLE Connect + Light Up Climbs

## Design decisions

- **Connection initiation**: an explicit Connect action owns device selection and
  permission. Remember browser-granted devices where supported; reconnect only through
  a user gesture when the platform requires it.
- **Controller cardinality**: one active board controller per client device in the
  first milestone.
- **Platform**: Android and desktop Chromium are the first-milestone control clients;
  iOS work is deferred to backlog.
- **Lighting contract**: the controller accepts arbitrary light scenes independent of
  climb validity. The four Kilter role colors are first-class presets, while the
  protocol boundary represents the API-level-3 per-LED color byte directly so future
  custom-color tools can use all 256 quantized RGB values without changing transport.

## Brief

The first hardware capability: connect to the physical Kilter Board over Web
Bluetooth and illuminate the holds for a selected climb in their role colors. This
epic owns the Kilter/Aurora controller profile and Web Bluetooth transport —
scan/connect, GATT lifecycle, and encoding LED commands
per the documented API-level-3 packet protocol (framing, checksums, multi-packet
splitting).

When done, the user can connect to their board and light up any climb (selected via
the browser) in Start/Middle/Finish/Foot-only colors. It is the ONLY module that
talks to the board. It implements the contracts from `epic-universal-board-platform`
and does NOT own the catalog or selection UI.

## Research briefs

- `docs/briefs/hardware-and-protocol.md` — **covers the packet protocol thoroughly**:
  service UUID `4488B571-…`, write characteristic `6E400002-…` (Nordic UART RX),
  framing `0x01/0x02/0x03`, checksums, multi-packet splitting, API level 3, role
  colors.
- **[brief written]** [board-control-web-bluetooth.md](../../../docs/briefs/board-control-web-bluetooth.md)
  — *Web Bluetooth integration patterns.* The packets are known; the
  thin, risky part is the browser side: Web Bluetooth connection lifecycle, GATT
  service/characteristic discovery, write semantics (with/without response), MTU and
  chunking, reconnection/disconnection handling, and the user-gesture permission flow.
  Web Bluetooth reliability is flagged as the project's biggest risk in ARCHITECTURE.
  **Grip Connect** (TypeScript) is the prime reference. Run `/research-pipeline:brief`
  before `/epic-design`; include a mock BLE adapter strategy for CI.

## Foundation references

- `docs/ARCHITECTURE.md` — Module Map §3 (BLE Adapter); Conventions (ports & adapters);
  Biggest Risks (Web Bluetooth reliability).
- `docs/SPEC.md` — Capability 1 (Board Control); Constraints (Chromium-only, protocol
  fidelity).

## Anticipated child features

Provisional:
- BLE adapter: scan + connect + GATT lifecycle (behind a mockable port)
- LED command encoder (frames → API-level-3 packets, checksums, splitting)
- "Play this climb" integration (browser selection → board)

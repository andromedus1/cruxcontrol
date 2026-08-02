---
id: epic-route-creation-board-light-capacity-envelope
kind: feature
stage: drafting
tags: [perf, ble]
parent: epic-route-creation
depends_on: [epic-route-creation-animated-light-designs, epic-board-control]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Measure and Enforce the Board Light Capacity Envelope

## Brief

Dogfooding showed that a climb with many simultaneously lit or animated holds can
overwhelm the Fullride controller and stop functioning. Establish the real hardware
envelope empirically instead of imposing a guessed hold cap: measure static scene size,
API packet and 20-byte write counts, inter-write pacing, sustainable animated frame
rate, changed-light density, failure onset, and recovery behavior on Andrew's Fullride
7×10 and Android controller path.

Build a repeatable diagnostic/stress-test surface that advances through conservative
test cases with explicit operator control, records timing and success/failure evidence,
and never leaves the board in an unrecoverable streaming loop. Use the results to make
static lighting reliable and animation scheduling capacity-aware. The editor should
explain when a design exceeds the measured real-time envelope and adapt update rate or
changed-light strategy where that preserves the requested effect; it must not silently
drop holds or corrupt saved climb/effect data.

This work is a prerequisite for flashy whole-board/background effects because their
recipes must be designed against measured LED throughput rather than desktop preview
speed.

## Evidence so far

- The triggering design was not a stale effect marker: because the current model can
  attach an effect only to an assigned/lit hold, Andrew assigned nearly every hold to
  build a background. That turned one decorative effect into a near-full-board scene
  and exposed the transport limit. Future background layers must target unused LEDs
  independently from the four protected climb-role assignments.
- API level 3 encodes about 84 holds per Aurora packet, but the transport splits the
  framed message into 20-byte BLE writes.
- A 365-hold Fullride frame is roughly 56 characteristic writes; the current animation
  scheduler attempts a new frame after only 100ms on API level 3.
- The current transport serializes JavaScript write promises but does not deliberately
  pace write-without-response chunks or adapt animation cadence to measured frame time.
- Reverse-engineered Aurora protocol documentation notes that large multi-packet scenes
  become slow and that the official app limits lit-hold count for that reason.

## Strategic decisions

- **Measure, then constrain**: distinguish the maximum reliable static scene from the
  smaller sustainable animation envelope; do not treat them as one arbitrary hold limit.
- **Physical target**: first characterize the actual home Fullride 7×10 through the
  installed Android PWA and its real advertised API level. Emulator-only evidence is
  insufficient for the final threshold.
- **Safety**: every physical test is user-triggered, bounded by timeout/write count,
  cancelable, and followed by a known clear/reconnect recovery path.
- **Product behavior**: preserve every saved hold/effect. Prefer pacing, adaptive FPS,
  coalescing, and sparse changed-light frames where protocol semantics permit; warn or
  disable only real-time playback configurations that remain outside the measured
  envelope.

## Simplification opportunity

Keep one controller queue and one shared animation scheduler. Replace fixed timing and
implicit transport assumptions with one measured capacity policy consumed by editor
animations and future presets; do not add a second BLE runtime or preset-specific limits.

## Sources

- `docs/briefs/hardware-and-protocol.md`
- `docs/briefs/board-control-web-bluetooth.md`
- `web/src/board-control/{api-level-2-codec,api-level-3-codec,light-controller,web-bluetooth-transport}.ts`
- `web/src/route-editor/use-editor-lighting.ts`
- `web/src/light-effects/frame.ts`

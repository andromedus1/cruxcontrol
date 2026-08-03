---
id: epic-route-creation-board-light-capacity-envelope
kind: feature
stage: review
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
- The shipped definition has 305 placements. A full API-level-3 frame is 4 Aurora
  packets, 939 framed bytes, and 47 characteristic writes. A theoretical 365-light
  frame is 5 packets, 1,125 bytes, and 57 writes, but is not a current board workload.
- The current API-level-3 scheduler waits 100ms *after* the prior preview batch settles,
  so delivered cadence is `1000 / (100 + batchDurationMs)` or lower rather than a true
  10 FPS. API level 2 analogously waits 167ms.
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

## Perf Overview

The hot path is asynchronous I/O, serialization, and remote firmware processing—not
JavaScript CPU. Every animation frame currently encodes all assigned placements even if
only one visual object moved. At the current 305-placement maximum, API level 3 submits
47 sequential 20-byte writes per frame through `writeValueWithoutResponse` when that
method is available. JavaScript promise settlement indicates browser submission, not
that the Aurora controller parsed the complete scene or updated its LEDs.

The solution therefore proceeds in evidence order. First instrument and bound the
existing controller/transport path and expose an operator-controlled physical sweep.
Second record the actual home-board capacity envelope, including whether omitted lights
mean “unchanged” or “reset.” Third implement the smallest capacity policy supported by
those results: inter-chunk pacing, an adaptive scheduler, and sparse changed-light frames
only if the protocol probe proves them correct.

CPU profiling, hardware counters, cache/TLB/branch probes, false-sharing, NUMA, and
flamegraphs are intentionally skipped: encoding is linear over at most 305 entries and
the reported failure occurs beyond the Web Bluetooth I/O boundary. User Timing, transport
timestamps, queue dwell, and physical LED observations are the relevant probes. Chrome
cannot expose ATT MTU, connection interval/PHY, radio or peripheral queue depth, packet
retransmission, Aurora parser completion, or LED-apply latency from page JavaScript.

## Profiling Summary

Exact current codec workload for non-empty scenes:

- API level 2: `packets = ceil(lights / 127)`,
  `bytes = 2 × lights + 6 × packets`, `writes = ceil(bytes / 20)`.
- API level 3: `packets = ceil(lights / 84)`,
  `bytes = 3 × lights + 6 × packets`, `writes = ceil(bytes / 20)`.
- Empty clear: one 6-byte packet and one write at either API level.

| Lights | API 2 packets / bytes / writes | API 3 packets / bytes / writes |
| ---: | ---: | ---: |
| 1 | 1 / 8 / 1 | 1 / 9 / 1 |
| 20 | 1 / 46 / 3 | 1 / 66 / 4 |
| 84 | 1 / 174 / 9 | 1 / 258 / 13 |
| 85 | 1 / 176 / 9 | 2 / 267 / 14 |
| 168 | 2 / 348 / 18 | 2 / 516 / 26 |
| 252 | 2 / 516 / 26 | 3 / 774 / 39 |
| 305 | 3 / 628 / 32 | 4 / 939 / 47 |

Ranked hypotheses until the physical campaign supplies evidence:

1. Aurora controller/parser or downstream LED-update capacity — I/O/service boundary.
2. Android Chrome/OS write-without-response submission outrunning peripheral consumption
   despite serialized promises — I/O and off-CPU queueing.
3. Full-scene serialization for sparse-looking effects — algorithmic/data-model work;
   current wire size is O(all assigned lights), not O(changed lights).
4. Missing measured backpressure policy — I/O scheduling; no deliberate chunk pacing or
   capacity-aware requested FPS.
5. RF/connection/firmware variation — external I/O variance measured through repetition.
6. Main-thread render/GC work — lower-likelihood runtime hypothesis checked with User
   Timing and Long Animation Frame observation before any CPU optimization.

## Optimization Plan

### Optimization 1: Instrumented bounded capacity runner

**Hierarchy Level**: I/O / service boundary
**Probe Family**: workload baseline, I/O/serialization, off-CPU queueing
**Expected Metric Movement**: measurement only; establish p50/p95/max chunk and batch
duration, queue dwell, effective FPS, timeout/error onset, and recovery success for every
scene-size/pacing/FPS point.
**Why higher levels don't apply**: the first unknown is the physical boundary; changing
scene representation before measuring omitted-light semantics could make lighting wrong.
**Story**: `epic-route-creation-board-light-capacity-envelope-instrumentation`

#### Unit 1.1: Trace and capacity model

**Files**: new `web/src/board-control/{capacity-model,capacity-trace}.ts`, focused tests,
and `web/src/board-control/capacity-model.bench.ts`

```typescript
export interface EncodedSceneCost {
  readonly apiLevel: AuroraApiLevel;
  readonly lightCount: number;
  readonly packetCount: number;
  readonly framedBytes: number;
  readonly writeCount: number;
}
export function encodedSceneCost(apiLevel: AuroraApiLevel, lightCount: number): EncodedSceneCost;

export type CapacityTraceEvent = Readonly<{
  atMs: number;
  stage: 'scheduled' | 'rendered' | 'batch-queued' | 'batch-started' |
    'chunk-called' | 'chunk-settled' | 'batch-settled' | 'timeout' |
    'cancelled' | 'error' | 'disconnect' | 'reconnect' | 'clear';
  frameIndex?: number;
  chunkIndex?: number;
  byteLength?: number;
  errorCode?: string;
}>;
export interface CapacityTraceSummary {
  readonly requestedFps: number;
  readonly effectiveFps: number;
  readonly attemptedFrames: number;
  readonly appliedFrames: number;
  readonly missedDueFrames: number;
  readonly p50BatchMs: number;
  readonly p95BatchMs: number;
  readonly maxBatchMs: number;
}
```

Trace exports contain only API level, counts, timing, stage, sanitized error code, and
operator observations. They exclude raw bytes, device name/ID, climb/title, placement
IDs, colors, stack traces, and exception messages.

#### Unit 1.2: Diagnostic controller/transport path

**Files**: `web/src/board-control/{transport,web-bluetooth-transport,mock-byte-transport,
light-controller}.ts` and tests

```typescript
export interface DiagnosticWriteOptions {
  readonly interChunkDelayMs: 0 | 5 | 10 | 20;
  readonly signal: AbortSignal;
  readonly onEvent: (event: CapacityTraceEvent) => void;
}
export interface CapacityCase {
  readonly apiLevel: AuroraApiLevel;
  readonly lightCount: number;
  readonly requestedFps: 0 | 1 | 2 | 4 | 6 | 8 | 10;
  readonly durationMs: number;
  readonly interChunkDelayMs: 0 | 5 | 10 | 20;
}
export interface CapacityCaseResult {
  readonly status: 'completed' | 'cancelled' | 'timeout' | 'error';
  readonly trace: readonly CapacityTraceEvent[];
  readonly summary: CapacityTraceSummary;
}
```

Diagnostic writes preserve the normal serialized queue, add a delay only between
chunks, check cancellation between awaited writes, and use one active batch. An
absolute-due-time scheduler retains only the newest frame when a deadline is missed.
Timeout stops future frames and triggers an immediate generation-invalidating GATT
disconnect path rather than waiting behind a hung queue; it never pretends an already
awaited Web Bluetooth promise was canceled.

#### Unit 1.3: Local operator surface

**Files**: new `web/src/board-control/BoardCapacityDiagnostics.tsx` and tests,
`web/src/route-editor/{LightEffectsPanel,RouteEditorWorkspace}.tsx`, and CSS

Expose a collapsed `Board capacity test` tool in the editor. Every case requires an
explicit Start, displays exact scene/packet/write/pacing/FPS cost, has Stop, timeouts,
reconnect/clear recovery, and asks only `Pattern/clear correct` or `Unexpected/stuck
LEDs`. Export trace is a deliberate local JSON download; there is no telemetry.

**Acceptance Criteria**:

- [ ] Formula tests match the existing codecs at all table points and packet boundaries;
  benchmarks record encoder cost but no hardware threshold is inferred from CPU speed.
- [ ] Mock delayed/rejecting/hanging transports prove trace ordering, one active batch,
  pacing, latest-frame-wins, missed deadlines, cancel, timeout, immediate disconnect,
  sanitized errors, and recovery state.
- [ ] The operator cannot launch an unbounded stream; every case begins/ends with clear,
  has a hard deadline, and aborts the campaign after failed recovery.
- [ ] Trace download contains no device/climb/placement/color identifiers or raw payloads.

### Optimization 2: Physical Fullride capacity campaign

**Hierarchy Level**: I/O / service boundary
**Probe Family**: physical workload baseline and recovery observation
**Expected Metric Movement**: establish separate largest passing static and animation
points with 100% static trial success, at least 90% requested effective FPS, batch p95
within 80% frame budget, no timeout/error/disconnect/stuck frame, and successful clear.
**Why higher levels don't apply**: this is evidence acquisition, not optimization.
**Story**: `epic-route-creation-board-light-capacity-envelope-physical-results`

Run in order: 3 recovery cycles; 1/20-light sanity at 20ms pacing; 305 lights at
20/10/5/0ms pacing; static 1/20/84/85/168/252/305 at the fastest successful pace (5
trials each); animation 20/84/85/168/252/305 at 1/2/4/6/8/10 FPS on API3 or through 6
FPS on API2 (3 × 15s each, advancing only after pass); then 3 × 30s confirmation at the
largest passing point. Each case clears before/after and has a 5s initial deadline,
later `max(5s, 4 × established p95)`.

Before sparse optimization, send A+B+C and then B-only, recording whether A/C persist.
Write the exported trace summary, API level, firmware/name-derived caveat, manual
observations, and resulting static/animation profiles into this feature body. Do not
commit device ID/name or raw payload.

**Acceptance Criteria**:

- [ ] All matrix points attempted/omitted and reasons are recorded durably; failures are
  evidence rather than rerun until green.
- [ ] Static and animation profiles state exact passing scene size, pacing, effective
  FPS, p95/max batch latency, recovery behavior, and repeated-trial counts.
- [ ] Omitted-light semantics are physically observed before any delta-frame decision.
- [ ] A known one-light scene and clear work after the campaign; otherwise the item
  records the manual recovery blocker truthfully.

### Optimization 3: Measured capacity policy and adaptive scheduler

**Hierarchy Level**: Algorithmic/data model first, then I/O scheduling
**Probe Family**: physical trace replay and regression benchmarks
**Expected Metric Movement**: zero controller-overload failures for accepted designs;
bounded one-frame concurrency; delivered FPS meets the measured safe profile; sparse
effects reduce bytes/writes toward O(changed lights) only if omission semantics permit.
**Story**: `epic-route-creation-board-light-capacity-envelope-policy`

#### Unit 3.1: Capacity policy

**Files**: new `web/src/board-control/capacity-policy.ts` and tests; update
`web/src/route-editor/use-editor-lighting.ts`

```typescript
export interface BoardCapacityProfile {
  readonly apiLevel: AuroraApiLevel;
  readonly safeStaticLights: number;
  readonly safeInterChunkDelayMs: 0 | 5 | 10 | 20;
  readonly animationPoints: readonly Readonly<{
    maxLights: number;
    maxFps: number;
    p95BatchMs: number;
  }>[];
  readonly omittedLightsPersist: boolean;
}
export function chooseAnimationSchedule(
  profile: BoardCapacityProfile,
  lightCount: number,
  recentBatchMs: readonly number[],
): Readonly<{ fps: number; interChunkDelayMs: number; warning?: string }>;
```

Seed the home-board profile only from accepted physical results. The scheduler uses one
in-flight frame, absolute due times, latest-frame-wins coalescing, and recent p95 latency;
it lowers requested FPS before refusing playback. Static scenes use the measured pacing
and remain separately bounded. The editor shows estimated writes/effective FPS and a
truthful warning when a design cannot meet the measured real-time envelope; saved data
is never truncated or mutated.

#### Unit 3.2: Sparse background-frame strategy (conditional)

**Files**: `web/src/light-effects/frame.ts`, `web/src/board-control/light-controller.ts`,
and tests

If and only if the physical A+B+C → B-only probe proves omitted LEDs persist, compute
changed placements and send only changed LEDs plus explicit off colors for placements
leaving the previous frame. Otherwise retain full snapshots and optimize only pacing/FPS.
The policy must record which strategy is active; presets cannot assume sparse support.

**Acceptance Criteria**:

- [ ] Recorded physical profiles replay deterministically in policy tests at threshold
  and just-over-threshold points; no guessed constant is presented as measured truth.
- [ ] One frame is active, stale due frames coalesce, batch p95 drives downgrade, and
  disconnect/visibility/clear stop scheduling without queue growth.
- [ ] Static and animation warnings report estimated packets/writes and chosen effective
  FPS; saved holds/effects are unchanged even when playback is refused.
- [ ] Sparse frames ship only with physical evidence and explicit-off regression tests;
  otherwise full-scene semantics remain intact.

## Benchmarks

**Location**: `web/src/board-control/capacity-model.bench.ts`
**Run command**: `npm exec --workspace web vitest bench --run src/board-control/capacity-model.bench.ts`
**Baseline targets**: encoder throughput/allocation trend for 1, 20, 84, 85, 168, 252,
and 305 lights plus exact packet/byte/write counts. This CPU baseline detects regressions
but does not define BLE capacity.
**Expected targets**: capacity-model calculation is allocation-free and materially below
actual codec time; instrumentation overhead stays under 5% in the mock delayed-transport
workload; physical I/O targets come only from Optimization 2.

## Implementation Order

1. Instrumented bounded capacity runner.
2. Physical Fullride capacity campaign with Andrew.
3. Measured capacity policy and conditional sparse strategy.

The explicit physical-results checkpoint prevents autopilot from inventing thresholds
between diagnostics and policy implementation.

## Implementation progress

- Optimization 1 is implemented: exact API 2/3 cost modeling, sanitized trace summaries,
  paced/cancelable writes, hard timeout with immediate disconnect, bounded case scheduling,
  and the collapsed local editor diagnostic/export surface. No capacity threshold was
  inferred.
- Optimization 2 is complete with an accepted conservative Fullride/Android API-2
  profile: 127 static lights, 20 animated lights at 2 FPS / 20 ms pacing, replacement
  scene semantics, and no sparse deltas.
- Optimization 3 is implemented from exactly that profile. API-2 writes use measured
  pacing; editor static sends stop above 127; animation sends complete scenes only,
  stops above 20, and uses absolute due times, one in-flight preview, missed-deadline
  coalescing, and recent-p95 downgrade/pause. Cost and effective FPS remain visible,
  while refused playback leaves the saved climb and effect data unchanged. No API-3
  physical capacity claim was added.
- All three child checkpoints are done; the feature is ready for its standard independent
  review pass.

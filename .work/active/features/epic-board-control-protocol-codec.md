---
id: epic-board-control-protocol-codec
kind: feature
stage: implementing
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

## Design decisions

- The public scene contract is LED-addressed and accepts the API-level-3 color byte
  directly. RGB-to-protocol quantization is a separate pure helper so application
  presets and an advanced color picker use the same 3/3/2-bit conversion without
  restricting callers to semantic climb roles.
- Scene order is preserved through hold encoding and packet partitioning. Duplicate LED
  positions are rejected because two colors for the same physical LED in one atomic
  scene are contradictory; callers that edit a scene resolve replacement semantics
  before crossing the codec boundary.
- An empty scene is encoded as a valid single `T` packet with no hold records. This is
  the protocol-level clear command and is not treated as invalid climb data.
- API-level-3 RGB quantization uses the protocol/reference implementation's high-bit
  extraction (`r >> 5`, `g >> 5`, `b >> 6`), not nearest-level rounding. Thus every
  encoded byte from `0x00` through `0xFF` is reachable and exact protocol behavior is
  reproducible.
- Packet payloads contain at most 84 three-byte light records plus their one-byte
  sequence marker: 253 payload bytes and 258 framed bytes. The research brief's
  approximate 260-byte packet ceiling does not override the frame's one-byte length
  field. Eighty-five lights therefore split into `R` (84) then `S` (1).
- BLE writes are made by concatenating all framed packets in message order and slicing
  that byte stream into consecutive chunks of at most 20 bytes. The codec returns
  immutable-by-convention `Uint8Array` values and performs no BLE calls.

## Architectural choice

Use a small layered pure codec: validate and quantize values, encode a scene into one
or more framed API-level-3 packets, then concatenate and chunk the framed message for
the transport. This exposes packet framing separately from BLE-sized chunking, which
makes the reverse-engineered protocol independently testable while giving the session
adapter one ready-to-write batch.

Two alternatives were rejected. A single opaque `scene -> writes` function would be
shorter but would make packet-boundary and checksum failures difficult to isolate. A
generic registry for API levels and controller families would anticipate deferred
API-level-2 and non-Kilter work without a second implementation to prove the
abstraction. The selected module is explicitly named for API level 3 and can later sit
behind a controller-profile registry without carrying Bluetooth infrastructure now.

## Implementation Units

### Unit 1: API-level-3 value contract and color quantizer

**File**: `web/src/board-control/api-level-3-codec.ts`

```typescript
export interface Rgb24 {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

export interface ApiLevel3Light {
  readonly ledPosition: number;
  readonly color: number;
}

export function quantizeApiLevel3Color(rgb: Rgb24): number;
```

**Implementation Notes**:

- Validate each RGB channel as an integer in `[0, 255]`, and return
  `(red >> 5) << 5 | (green >> 5) << 2 | (blue >> 6)`.
- Keep the encoded color a number at the module boundary because TypeScript brands do
  not provide runtime safety. Validate `ApiLevel3Light.color` as an integer byte when
  encoding instead.
- Validate `ledPosition` as an integer in `[0, 65535]`. Reject duplicate positions
  before producing any output. Throw `RangeError` with the scene index and invalid
  field/value for malformed numeric input; throw `Error` identifying both indexes for
  a duplicate.

**Acceptance Criteria**:

- [ ] Black, white, channel maxima, and representative mixed RGB values encode with
      exact 3/3/2-bit placement.
- [ ] The quantizer can produce every byte in `[0, 255]` from representative channel
      levels.
- [ ] Fractional, negative, above-range, and non-finite channels, positions, and color
      bytes fail before packet construction.
- [ ] A scene with the same LED position twice fails explicitly.

### Unit 2: Packet partitioning, framing, and checksum

**File**: `web/src/board-control/api-level-3-codec.ts`

```typescript
export function checksumApiLevel3Payload(payload: Uint8Array): number;

export function encodeApiLevel3Packets(
  scene: readonly ApiLevel3Light[],
): readonly Uint8Array[];
```

**Implementation Notes**:

- This is the trickiest unit. Partition validated lights in stable input order into
  groups of at most 84. Empty input still creates one empty group.
- Use `T` (`0x54`) for the sole packet; otherwise use `R` (`0x52`) for the first,
  `Q` (`0x51`) for each middle packet, and `S` (`0x53`) for the last.
- Encode each light little-endian as
  `[ledPosition & 0xff, ledPosition >>> 8, color]`.
- Frame each payload as
  `[0x01, payload.length, checksum, 0x02, ...payload, 0x03]`, where
  `checksum = ~(sum(payload) & 0xff) & 0xff`.
- Keep framing helpers private until a real consumer needs a lower-level API; packet
  bytes remain observable through `encodeApiLevel3Packets` for protocol tests.

**Acceptance Criteria**:

- [ ] Empty input produces the exact clear frame
      `[0x01, 0x01, 0xAB, 0x02, 0x54, 0x03]`.
- [ ] Position `42` in protocol green `0x1C` produces the research fixture
      `[0x01, 0x04, 0x65, 0x02, 0x54, 0x2A, 0x00, 0x1C, 0x03]`.
- [ ] Position `0x1234` is encoded as `0x34, 0x12`.
- [ ] Scenes of 84, 85, 168, and 169 lights produce marker sequences `T`, `R/S`,
      `R/S`, and `R/Q/S` respectively, with no missing or reordered records.
- [ ] Every packet declares its actual payload length, has the protocol delimiters,
      and has a checksum matching only its payload bytes.

### Unit 3: Ordered BLE write chunk composition

**File**: `web/src/board-control/api-level-3-codec.ts`

```typescript
export function splitApiLevel3Writes(
  framedPackets: readonly Uint8Array[],
  maxWriteBytes?: number,
): readonly Uint8Array[];

export function encodeApiLevel3Scene(
  scene: readonly ApiLevel3Light[],
): readonly Uint8Array[];
```

**Implementation Notes**:

- `splitApiLevel3Writes` concatenates packet bytes in order, then slices consecutive
  chunks. Default `maxWriteBytes` is 20; validate it as a positive integer. It may
  split at any point, including across a packet boundary, because the controller
  reconstructs the FIFO byte stream.
- Reject an empty `framedPackets` list: valid scene encoding always contains at least
  the clear packet, so silence would hide a caller error.
- `encodeApiLevel3Scene` is the consumer-facing composition of Units 2 and 3. It does
  not import Web Bluetooth, browser globals, React, or board-definition/catalog code.

**Acceptance Criteria**:

- [ ] Every returned write is 1–20 bytes at the default size, and concatenating the
      writes exactly reconstructs concatenated framed packets.
- [ ] A 20-byte stream remains one write; a 21-byte stream becomes 20 + 1 without
      byte loss or duplication.
- [ ] Multi-packet framing is chunked as one continuous ordered message even when a
      write crosses the boundary between packets.
- [ ] Invalid chunk sizes and an empty packet list fail explicitly.

## Implementation Order

1. Packet partitioning/framing/checksum — first because the one-byte length boundary
   and multi-packet markers are the highest-risk reverse-engineered behavior.
2. Value validation and color quantization — establishes safe inputs and all 256
   protocol colors around the packet core.
3. Ordered write chunk composition — a thin pure layer once packet bytes are settled.

The three units remain in one module and one implementation stride; child stories
would add coordination overhead to tightly coupled byte-level behavior.

## Testing

### Unit tests: `web/src/board-control/api-level-3-codec.test.ts`

- Use Vitest table tests for RGB boundary/representative values and every invalid
  numeric class (`NaN`, infinities, fraction, below, above).
- Assert the two exact protocol fixtures in Unit 2, then decode boundary-scene packet
  bodies in the test to prove record order and marker choice at 84/85/168/169 lights.
- Recompute checksum independently in tests rather than invoking the production
  helper when verifying framed packets.
- Verify write reconstruction at 6-byte clear, 20-byte, 21-byte, one large packet,
  and multi-packet sizes. Tests use no Bluetooth mocks because this module owns no
  transport behavior.

### Integration contract

The downstream Bluetooth session receives `readonly Uint8Array[]` from
`encodeApiLevel3Scene` and serially writes each element without re-framing or
re-chunking it. The light-scenes feature performs the physical-board acceptance test;
this feature's CI boundary is exact byte output.

## Risks

- **Reverse-engineered ceiling**: the upstream reference describes packets as “at
  most 260 bytes,” while the frame has a one-byte payload length. Limiting a packet to
  84 records produces a 253-byte payload/258-byte frame and avoids overflow. **Fallback**:
  the downstream hardware checkpoint can reduce the records-per-packet constant
  without changing the public scene/write contracts.
- **Firmware interpretation**: byte-exact fixtures prove agreement with the published
  reference, not the specific household controller. **Fallback**: capture the observed
  API level and correct codec internals after the physical-board checkpoint; no BLE or
  UI API needs to change.
- **Throughput**: arbitrary large scenes can generate many serialized writes. This
  codec intentionally preserves all input rather than imposing a climb hold limit.
  **Fallback**: animation frame-diffing and rate limiting belong in future lighting
  orchestration, not protocol encoding.

---
id: epic-board-control
kind: epic
stage: done
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

## UI alignment deferred

This epic introduces a compact connection/status control and light/clear actions.
Because decomposition is running under autopilot, interactive screen selection is not
available. The features inherit `.mockups/design-system/`; a later
`epic-design --only-questions epic-board-control` pass may add dedicated mocks, while
feature design can fall back to the locked compact, touch-safe component language.

## Decomposition

Split at the two real technical boundaries, then compose them into one user-visible
capability. The pure protocol codec and browser Bluetooth session can be designed and
implemented independently; the light-scenes feature joins them and owns the physical
acceptance checkpoint. This keeps protocol correctness testable without hardware and
prevents Web Bluetooth lifecycle details from leaking into route creation.

### Child features

- `epic-board-control-protocol-codec` — deterministic API-level-3 scene encoding,
  framing, checksums, partitioning, and transport chunks — depends on: `[]`
- `epic-board-control-bluetooth-session` — explicit Web Bluetooth connection lifecycle,
  serialized writes, capability states, and deterministic mock adapter — depends on:
  `[]`
- `epic-board-control-light-scenes` — user-visible connect/light/clear orchestration and
  Fullride hardware verification — depends on:
  `[epic-board-control-protocol-codec, epic-board-control-bluetooth-session]`

### Decomposition risks

- Real controller behavior can diverge from reverse-engineered framing or browser BLE
  assumptions even when byte-level tests pass. The final integration feature therefore
  carries an explicit physical-board checkpoint and records observed controller name,
  API level, write behavior, and any corrections.
- Web Bluetooth failures are stateful and platform-specific. Keeping a single session
  owner, serializing all operations, and exercising disconnect/failure transitions
  through the mock reduces—not eliminates—this risk.
- Fullride placement-to-LED mapping is owned by the board definition upstream; this
  epic accepts LED-addressed scenes and must not duplicate geometry or catalog logic.

## Child features reviewed and complete

- `epic-board-control-protocol-codec` — API-level-3 color, framing, checksum,
  splitting, and write-chunk contracts approved.
- `epic-board-control-bluetooth-session` — explicit connection lifecycle, serialized
  writes, reconnection, typed failures, and deterministic mock approved.
- `epic-board-control-light-scenes` — unrestricted scenes, four semantic presets,
  all 256 encoded colors, clear/light, and latest-frame-wins preview approved.

Automated verification is green. The aggregate epic review must keep the documented
physical Fullride/Android Chrome smoke test pending until Andrew performs it.

## Review (2026-08-02)

**Verdict**: Approve with comments

**Blockers**: none
**Important**: none
**Nits**: none
**Rejected**: requiring the deferred production browser/editor UI or an unavailable
physical-board run to block approval of the automated controller core. Those are real
downstream and manual boundaries, not evidence that the scene-to-BLE contracts are
incomplete.

**Notes**: Substrate epic review with effective weight `standard`: exactly one balanced
independent fresh-context aggregate pass (same OpenAI/Codex model class) over the epic,
all three completed feature review records and contracts, their aggregate production
code and tests, the Fullride definition, project rules, foundation assertions, and the
cited protocol/Web Bluetooth research. The pass did not repeat line-level feature
review. It traced unrestricted placement/color scenes through the validated generated
Fullride placement-to-LED map, API-level-3 framing/checksum/packet and 20-byte chunk
encoding, one atomic `writeBatch`, and the Web Bluetooth FIFO with disconnect-generation
invalidation and fresh GATT resolution. Cross-feature capability, lifecycle, preview
arbitration, typed error propagation, and public-state diagnostic redaction are coherent;
the adapter reports insecure/unsupported clients explicitly and retains no board data
beyond the browser-selected device reference and in-memory state. Persistence/migration
and broad network/auth lenses were not applicable.

Verification on the aggregate snapshot passed 147 tests, strict TypeScript production
build, and full lint. The absence of production UI wiring is accepted because the
browser/editor surfaces deliberately own later composition of the exported controller,
transport, and scene contracts. Physical verification is still **pending** for Andrew
on the powered Fullride 7x10 with Android Chrome, including observed controller name and
`@APILevel`, all four role presets plus custom colors, multi-write lighting, clear,
remote disconnect, explicit reconnect, and relight. This approval makes no claim that
physical hardware behavior has passed; that manual evidence remains a release/acceptance
checkpoint while downstream UI work may continue. No second independent pass ran.

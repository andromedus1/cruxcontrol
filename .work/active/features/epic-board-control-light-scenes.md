---
id: epic-board-control-light-scenes
kind: feature
stage: done
tags: [ble, ui]
parent: epic-board-control
depends_on:
  - epic-universal-board-platform-domain-definition
  - epic-board-control-protocol-codec
  - epic-board-control-bluetooth-session
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

## Design decisions

- The application scene is addressed by stable `BoardPlacementId`, not native Kilter
  placement IDs or LED positions. The Fullride composition resolves each placement
  through its immutable `BoardDefinition` and rejects unknown or duplicate placement
  IDs before it calls the codec. Native LED identity remains an adapter detail.
- A scene entry carries one `ApiLevel3Color`, so every one of the controller's 256
  quantized colors is representable. The four semantic climb colors are helpers that
  read `definition.rolePresets`; they are conveniences, never validation rules.
- `light(scene)` and `clear()` are explicit, lossless operations. Empty scenes are
  allowed and are behaviorally equivalent to clear. No start, finish, role-count, or
  climb-validity constraints exist at this boundary.
- Optional live preview uses a separate `preview(scene)` method with bounded
  latest-frame-wins behavior: one frame may be writing and at most one newer frame is
  retained. Replaced pending calls resolve as `superseded`; they are not transport
  failures. This prevents rapid taps from building an obsolete BLE queue without
  introducing animation timing or party-mode scheduling.
- Explicit `light` and `clear` calls take precedence over pending preview work. They
  supersede the pending preview and execute after any already-started atomic transport
  batch. Transport batches are never cancelled or partially replayed.
- The controller publishes immutable composition state alongside the underlying
  `BoardTransportState`. Operation failures retain the last successfully applied scene
  for honest recovery, expose stable `BoardTransportError` values, and never display a
  browser exception's diagnostic `cause`.
- This feature is a headless application capability. The route editor will own its
  connected controls and locked visual treatment; adding a temporary production screen
  here would conflict with the project's mockup-first rule and duplicate that consumer.

## Architectural choice

Use a placement-addressed scene controller composed from three existing contracts: an
immutable `BoardDefinition`, the pure API-level-3 codec, and a `BoardByteTransport`.
The controller owns placement-to-LED resolution, semantic preset composition,
operation state, and bounded preview arbitration. It does not own Bluetooth objects,
packet framing, climb validity, draft persistence, renderer state, or animation time.
This is the narrow seam the route editor needs and preserves the architecture's split
between board definition and controller transport.

Two alternatives were rejected. Passing LED-addressed scenes directly from the route
editor would leak installation-native identity through the application and make a
future definition/controller pairing harder to change. A generic controller-profile
registry with polymorphic scene codecs would anticipate deferred non-Kilter boards
before a second concrete controller exists. The selected constructor is Fullride/API-3
specific internally but its public scene and controller contracts are definition-based
and additive.

The trickiest unit is preview arbitration. Sending every transient edit is correct but
can leave a serialized BLE queue showing old states long after the UI changes. Cancelling
an active multi-write frame is unsafe. The controller therefore lets the active batch
finish, retains only the newest pending preview, and gives explicit light/clear commands
priority at the next boundary.

## Implementation Units

### Unit 1: Placement-addressed light-scene contract and role helpers

**File**: `web/src/domain/boards/light-scene.ts`

```typescript
import type { BoardDefinition, ClimbRole } from './definition.ts';
import type { ApiLevel3Color, BoardPlacementId } from './types.ts';

export interface PlacementLight {
  readonly placementId: BoardPlacementId;
  readonly color: ApiLevel3Color;
}

export type LightScene = readonly PlacementLight[];

export interface RolePlacement {
  readonly placementId: BoardPlacementId;
  readonly role: ClimbRole;
}

export function sceneFromRoles(
  definition: BoardDefinition,
  placements: readonly RolePlacement[],
): LightScene;
```

**Implementation Notes**:

- `sceneFromRoles` maps through `definition.rolePresets[role].lightColor`, preserves
  input order, and returns frozen entry copies. It does not enforce role counts or
  reject an empty scene.
- Duplicate placement IDs are rejected with an error naming both indexes because one
  physical LED cannot have contradictory colors in one scene. Unknown placement IDs
  are rejected here for role scenes and again at the controller boundary for custom
  scenes.
- Use the domain's branded `ApiLevel3Color`; do not add a third RGB/color type. Custom
  UI RGB values pass through `packApiLevel3Color` before scene construction.

**Acceptance Criteria**:

- [ ] All four role presets produce the exact generated Fullride color bytes.
- [ ] Any branded color byte, including black and white, is accepted in a custom scene.
- [ ] Empty and unconventional role combinations remain valid.
- [ ] Unknown or duplicate placements fail before transport work begins.

### Unit 2: Fullride scene resolver and controller contract

**File**: `web/src/board-control/light-controller.ts`

```typescript
import type { LightScene } from '../domain/boards/light-scene.ts';
import type { BoardDefinition } from '../domain/boards/definition.ts';
import type {
  BoardByteTransport,
  BoardDeviceRef,
  BoardTransportError,
  BoardTransportState,
  Unsubscribe,
} from './transport.ts';

export type LightOperation = 'idle' | 'lighting' | 'clearing' | 'previewing';

export type PreviewResult =
  | { readonly status: 'applied' }
  | { readonly status: 'superseded' };

export interface BoardLightState {
  readonly transport: BoardTransportState;
  readonly operation: LightOperation;
  readonly lastAppliedScene: LightScene | null;
  readonly error: BoardTransportError | null;
}

export type BoardLightListener = (state: BoardLightState) => void;

export interface BoardLightController {
  getState(): BoardLightState;
  subscribe(listener: BoardLightListener): Unsubscribe;
  requestAndConnect(): Promise<BoardDeviceRef>;
  reconnect(deviceId?: string): Promise<BoardDeviceRef>;
  disconnect(): Promise<void>;
  light(scene: LightScene): Promise<void>;
  clear(): Promise<void>;
  preview(scene: LightScene): Promise<PreviewResult>;
}

export interface FullrideLightControllerOptions {
  readonly definition: BoardDefinition;
  readonly transport: BoardByteTransport;
}

export function createFullrideLightController(
  options: FullrideLightControllerOptions,
): BoardLightController;
```

**Implementation Notes**:

- Build one immutable `Map<BoardPlacementId, ledPosition>` in the constructor and
  fail fast if the supplied definition is invalid. Resolve and validate a full scene
  before changing operation state or encoding bytes.
- Convert each entry to `ApiLevel3Light`, pass it to `encodeApiLevel3Scene`, then call
  exactly one `transport.writeBatch(chunks)` per applied scene. Preserve scene order;
  the transport owns chunk serialization.
- Subscribe once to transport state and republish composition snapshots. A remote
  disconnect ends the visible operation, retains `lastAppliedScene`, and surfaces the
  transport's disconnected state without inventing an error.
- `light([])` and `clear()` both send `encodeApiLevel3Scene([])`. On success store a
  frozen empty scene as `lastAppliedScene`; on failure retain the prior successful
  scene. Calling these methods while disconnected relies on the transport's stable
  `disconnected` error and records it in controller state.
- Catch and publish `BoardTransportError`. Unexpected validation/programming errors
  reject unchanged and do not masquerade as Bluetooth failures.
- `disconnect()` does not automatically clear the physical board; it delegates only
  to transport. The UI must call Clear explicitly if that is desired.

**Acceptance Criteria**:

- [ ] Every valid Fullride placement maps to its generated LED position and arbitrary
      color byte without exposing native IDs to the caller.
- [ ] A scene of more than 84 placements reaches the mock transport as one ordered
      multi-packet write batch produced by the existing codec.
- [ ] Light and clear update `lastAppliedScene` only after the whole write succeeds.
- [ ] Connection, disconnection, remote disconnect, and write errors appear as
      exhaustive immutable state without leaking browser objects or diagnostic causes.
- [ ] Unknown/duplicate placement scenes cause no recorded mock transport write.

### Unit 3: Bounded live-preview arbitration

**File**: `web/src/board-control/light-controller.ts`

```typescript
// Implemented by the BoardLightController.preview/light/clear methods above.
```

**Implementation Notes**:

- Keep at most one active application operation and one pending preview. Each new
  preview replaces the pending scene and resolves the replaced promise with
  `{ status: 'superseded' }`.
- Never interrupt an active `writeBatch`. After it settles, apply the newest preview
  if no explicit operation is waiting. `light` and `clear` supersede a pending preview
  and join the same application queue ahead of future previews.
- Multiple callers awaiting the same retained preview receive the result belonging to
  their own request; no promise may remain unresolved after supersession, disconnect,
  success, or failure.
- This is frame arbitration, not a clock: no debounce duration, FPS, diff encoding,
  Web Audio input, or repeating animation loop belongs here.

**Acceptance Criteria**:

- [ ] A burst of previews records the active scene and only the newest pending scene;
      intermediate calls resolve as superseded.
- [ ] An explicit clear arriving during a preview completes after the active atomic
      batch and before any later preview.
- [ ] A failed active preview rejects that call, publishes the stable transport error,
      and still settles or safely processes every pending caller.
- [ ] The number of retained preview scenes remains constant regardless of burst size.

### Unit 4: Fullride integration fixture and hardware checkpoint

**Files**:

- `web/src/board-control/light-controller.test.ts`
- `.work/active/features/epic-board-control-light-scenes.md`

**Implementation Notes**:

- Automated tests compose `KILTER_FULLRIDE_7X10_DEFINITION`,
  `MockBoardByteTransport`, and the real codec; do not mock the resolver or encoder.
- After CI verification, record a dated `## Physical verification` result in this
  item: browser/device, advertised controller name and observed `@APILevel`, test
  placements/colors, multi-write behavior, clear, disconnect, reconnect, and any
  discrepancy. A human failed/untested checkpoint is honest evidence, not a reason to
  weaken automated assertions.
- Physical execution requires Andrew with powered hardware and Android Chrome. The
  implementation may enter review with this explicitly pending, but the parent epic
  cannot claim hardware verification until it passes.

**Acceptance Criteria**:

- [ ] CI proves all four role presets plus at least four custom colors, including a
      scene large enough to span BLE writes, through the real composition seam.
- [ ] Clear emits the exact codec clear batch and reconnect permits a later relight in
      the mock integration.
- [ ] The physical checklist is present and records pass/fail/pending without claiming
      unperformed hardware evidence.

## Implementation Order

1. Fullride scene resolver and explicit light/clear composition — first because the
   placement/LED boundary and end-to-end codec/transport seam determine feasibility.
2. Placement scene types and role helpers — stabilize the consumer-friendly inputs
   around that proven seam.
3. Bounded preview arbitration — layer coalescing over working atomic operations.
4. Mock integration suite and physical checklist — prove CI behavior, then preserve
   the real-hardware boundary for Andrew.

The feature remains one implementation stride. The contracts, arbitration, and tests
share one state machine; child stories would create overlapping writes and coordination
without enabling safe parallel implementation.

## Testing

### Unit tests: `web/src/board-control/light-controller.test.ts`

- Use the generated Fullride definition and its first, middle, and last placements;
  assert recorded bytes by comparing to an independently invoked
  `encodeApiLevel3Scene` expectation.
- Cover all four `sceneFromRoles` values, custom black/white/mixed colors, empty
  scenes, input immutability, duplicate and unknown placements, and a 305-placement
  scene.
- Use a controllable test transport wrapper around `MockBoardByteTransport` to hold an
  active write promise while issuing preview bursts and explicit operations. Assert
  exact settlement and operation order rather than timers.
- Script connect/write failures and remote disconnects with the mock. Assert stable
  error/state behavior, retained last successful scene, and recovery through explicit
  reconnect plus relight.

### Integration contract

The route editor constructs unrestricted `LightScene` values from board placement IDs
and either role-preset or custom `ApiLevel3Color` values. It may call `preview` when its
Live Preview toggle is enabled; otherwise it calls explicit `light`. The renderer and
draft store share placement IDs but do not import codec or transport modules.

## Risks

- **Physical mapping correctness**: generated placement-to-LED joins are verified from
  the snapshot but only the household board can prove physical correspondence.
  **Fallback**: correct the generated definition/provenance and rerun integration tests;
  the public scene contract remains unchanged.
- **Firmware throughput**: serialized multi-write batches may be visibly slow or fail
  on the specific controller despite byte-correct CI evidence. **Fallback**: measure at
  the hardware checkpoint and tune codec chunk/packet internals; explicit operations
  and bounded preview remain stable.
- **Preview ordering complexity**: a naive promise chain can strand superseded callers
  or let clear lose priority. **Fallback**: keep preview arbitration as a small explicit
  state machine exercised with deferred promises, not timers or the transport's private
  queue.
- **Definition/profile mismatch**: the constructor currently accepts any structurally
  valid definition even though the codec is Aurora API-level 3. **Fallback**: this
  milestone's composition passes only the known Fullride definition; the installation
  registry can add explicit profile compatibility when its feature is implemented.

## Design execution notes

- Execution capability: highest-capability/xhigh, inherited from the active autopilot
  delegation because hardware orchestration and concurrency contracts are
  implementation-sensitive.
- Review weight: standard.
- Advisory review: skipped; the user supplied detailed prior `--only-questions`
  decisions and the remaining choices are reversible internal composition details.
- Child stories: none — one tightly coupled state machine and test seam.

## Implementation notes

- Execution capability: highest-capability/xhigh, inherited from the autopilot caller;
  placement-to-hardware composition and preview concurrency warranted the strongest
  implementation pass.
- Review weight: standard, from the caller and project convention.
- Files changed: `web/src/domain/boards/light-scene.ts`,
  `web/src/domain/boards/index.ts`, `web/src/board-control/light-controller.ts`, and
  `web/src/board-control/light-controller.test.ts`.
- Tests added/removed: added 13 unit/integration tests covering exact four-role bytes,
  arbitrary 256-color scenes, empty/clear commands, immutable state, validation before
  writes, a 305-placement multi-packet scene, transport errors and reconnection, and
  deterministic latest-frame-wins/explicit-priority arbitration; removed none.
- Simplification: kept preview scheduling to one active operation, one pending preview,
  and a FIFO explicit-operation queue; reused the existing definition validator, codec,
  transport error vocabulary, and mock transport rather than adding profiles, timers,
  or a second color model.
- Discrepancies from design: the generated definition export is named
  `kilterFullride7x10Definition` rather than the illustrative uppercase name; a failed
  mock write moves the transport to its honest error state, so a retained preview is
  safely rejected as disconnected until explicit reconnect rather than being silently
  applied.
- Adjacent issues parked: none.

## Physical verification

- Status: **pending — requires Andrew with the powered Fullride 7x10 and Android
  Chrome**.
- Browser/device: pending.
- Advertised controller name and observed `@APILevel`: pending.
- Test scene: pending; must include all four role presets plus at least four custom
  API-level-3 color bytes and enough placements to span multiple BLE writes.
- Clear, remote disconnect, explicit reconnect, and relight: pending.
- Observed mapping/protocol discrepancies: pending.
- Automated substitute evidence: 13 controller tests compose the generated 305-hold
  definition, real API-level-3 codec, and mock byte transport; this does not claim
  physical hardware behavior.

## Review (2026-08-02)

**Verdict**: Approve

**Blockers**: none
**Important**: none
**Nits**: none
**Rejected**: none

**Notes**: Substrate feature review with effective weight `standard`: exactly one
balanced fresh-context pass over implementation commit `6f7836e`, the feature design,
dependency contracts, surrounding production code, tests, project rules, and relevant
foundation/research assertions. Placement IDs resolve to the generated Fullride LED
positions; all 256 API-level-3 colors and the four role presets remain unrestricted;
empty light and clear commands use the codec clear batch; explicit operations serialize
ahead of retained preview work; and latest-frame-wins preview settlement, failure
recovery, and last-successful-scene semantics match the accepted contract. One material
public-state leak was fixed inline: transport error snapshots now replace diagnostic
`cause` values with frozen stable errors at both the top-level and nested transport
surfaces, with regression coverage. Full verification passed 146 tests, typecheck,
lint, and production build. Persistence/migration and broad security lenses were not
applicable; the focused security check covered diagnostic/browser-object exposure.
Physical verification remains honestly pending for Andrew on the powered Fullride 7x10,
so this feature is code-reviewed but the parent epic must not claim hardware
verification until that checkpoint passes. No second independent pass ran, as required
for standard weight.

---
id: epic-board-control-bluetooth-session
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

This feature adds no production UI. It exposes capability and session-state data for
the downstream light-scenes surface, so the mockup fallback does not apply here.

## Design decisions

- **Boundary**: expose an atomic, ordered byte-batch transport. This feature neither
  accepts `LightScene` nor encodes Aurora packets. The future installation/controller
  contract composes this transport with a controller profile; it does not get
  duplicated here.
- **Chooser activation**: `requestAndConnect()` calls `requestDevice()` synchronously
  before its first `await` and before entering the operation queue. Discovery and GATT
  resolution continue in the serialized queue after the chooser promise exists.
- **Remembering and reconnect**: retain the selected `BluetoothDevice` for the life of
  the adapter and expose browser-granted devices through `getDevices()` when available.
  Reconnect is always explicit in application behavior; there is no background retry.
  Every reconnect re-resolves service and characteristic objects.
- **Write behavior**: one whole `writeBatch()` is one queue operation, preventing
  chunks from concurrent callers from interleaving. Copy caller-owned bytes on entry.
  Prefer `writeValueWithoutResponse`; use `writeValueWithResponse` only when the
  characteristic does not advertise the former. Never retry a failed chunk
  automatically because replaying part of a framed multi-chunk message can corrupt
  controller parsing.
- **Failure model**: expected platform/GATT failures become stable typed error codes;
  the original browser error remains available as `cause` only for diagnostics.
  User-cancelled chooser is a recoverable disconnected result, while unsupported
  environments are a persistent capability state.
- **State ownership**: one adapter instance owns one active device/session. Consumers
  receive immutable state snapshots through `subscribe`; they do not inspect Web
  Bluetooth objects.
- **Test boundary**: a deterministic mock implements the same byte transport and can
  script connect/write failures and remote disconnects. Browser adapter tests use
  narrow fake Web Bluetooth platform interfaces, never real hardware or jsdom globals.

## Architectural choice

Three shapes were considered: exposing Web Bluetooth objects directly to the
application, wrapping only a characteristic `write()` function, and a stateful byte
transport port with browser and mock adapters. Direct browser objects would leak an
experimental infrastructure API into orchestration and make CI behavior-dependent.
A write-only wrapper is too narrow to represent explicit permission, disconnects, and
re-resolution—the risky part of this feature.

Use the stateful byte transport port. It is the smallest contract that makes device
permission, connection lifecycle, ordered writes, and deterministic failure testing
explicit while remaining ignorant of Aurora packet structure. Browser-specific types
are narrow structural interfaces owned by the adapter, avoiding a new runtime
dependency and insulating the port from changes in experimental DOM typings.

The trickiest unit is the browser session queue because user activation and BLE
serialization pull in opposite directions: the chooser must start synchronously, but
connect/discovery/writes must never overlap. `requestAndConnect()` therefore captures
the chooser promise immediately and queues only its continuation. A synchronous
in-progress guard rejects a second chooser request before it can open another prompt.

## Implementation Units

### Unit 1: Byte transport contract and errors

**File**: `web/src/board-control/transport.ts`

```typescript
export const BOARD_TRANSPORT_ERROR_CODES = [
  'unsupported',
  'insecure-context',
  'chooser-cancelled',
  'chooser-in-progress',
  'device-unavailable',
  'gatt-connect-failed',
  'service-not-found',
  'characteristic-not-found',
  'write-not-supported',
  'write-failed',
  'disconnected',
] as const;

export type BoardTransportErrorCode =
  (typeof BOARD_TRANSPORT_ERROR_CODES)[number];

export interface BoardDeviceRef {
  readonly id: string;
  readonly name: string | null;
}

export type BoardTransportCapability =
  | { readonly supported: true }
  | {
      readonly supported: false;
      readonly reason: 'insecure-context' | 'api-unavailable';
    };

export type BoardTransportState =
  | {
      readonly status: 'unsupported';
      readonly capability: Extract<BoardTransportCapability, { supported: false }>;
    }
  | { readonly status: 'disconnected'; readonly device: BoardDeviceRef | null }
  | { readonly status: 'selecting'; readonly device: null }
  | { readonly status: 'connecting'; readonly device: BoardDeviceRef }
  | { readonly status: 'connected'; readonly device: BoardDeviceRef }
  | { readonly status: 'disconnecting'; readonly device: BoardDeviceRef }
  | {
      readonly status: 'error';
      readonly device: BoardDeviceRef | null;
      readonly error: BoardTransportError;
    };

export type BoardTransportListener = (state: BoardTransportState) => void;
export type Unsubscribe = () => void;

export class BoardTransportError extends Error {
  readonly code: BoardTransportErrorCode;
  readonly recoverable: boolean;
  constructor(
    code: BoardTransportErrorCode,
    message: string,
    options?: { readonly recoverable?: boolean; readonly cause?: unknown },
  );
}

export interface BoardByteTransport {
  getCapability(): BoardTransportCapability;
  getState(): BoardTransportState;
  subscribe(listener: BoardTransportListener): Unsubscribe;
  getRememberedDevices(): Promise<readonly BoardDeviceRef[]>;
  requestAndConnect(): Promise<BoardDeviceRef>;
  reconnect(deviceId?: string): Promise<BoardDeviceRef>;
  disconnect(): Promise<void>;
  writeBatch(chunks: readonly Uint8Array[]): Promise<void>;
}
```

**Implementation Notes**:

- Return frozen snapshots (including the nested device/error references where
  practical); `subscribe` immediately emits the current state and is safe to
  unsubscribe during a callback.
- `BoardTransportError` messages are user-safe summaries. `cause` is diagnostic and
  must not be rendered verbatim.
- An empty `writeBatch` fails fast as `write-failed`; codec/orchestration must not
  silently mistake an empty command for a transmitted clear.

**Acceptance Criteria**:

- [ ] The port imports no DOM, React, codec, or board-definition types.
- [ ] States and errors are exhaustively discriminated under strict TypeScript.
- [ ] A downstream consumer can observe capability, connect, disconnect, reconnect,
  and batch-write behavior without access to browser objects.

### Unit 2: Aurora Web Bluetooth configuration

**File**: `web/src/board-control/aurora-web-bluetooth.ts`

```typescript
import type { WebBluetoothTransportConfig } from './web-bluetooth-transport.ts';

export const AURORA_ADVERTISEMENT_SERVICE_UUID =
  '4488b571-7806-4df6-bcff-a2897e4953ff';
export const NORDIC_UART_SERVICE_UUID =
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const NORDIC_UART_RX_CHARACTERISTIC_UUID =
  '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

export const AURORA_WEB_BLUETOOTH_CONFIG: WebBluetoothTransportConfig;
```

**Implementation Notes**:

- The discovery request filters on the Aurora advertisement service and includes the
  Nordic UART service in `optionalServices`, because advertised and accessed services
  differ.
- UUID/configuration is data, separate from lifecycle logic. Adding a future
  controller profile must not fork the queue implementation.

**Acceptance Criteria**:

- [ ] The request options expose exactly the researched advertisement and UART UUIDs.
- [ ] No packet framing, color, LED, or API-level logic appears in this module.

### Unit 3: Browser session adapter and serialized queue

**Files**:

- `web/src/board-control/web-bluetooth-platform.ts`
- `web/src/board-control/web-bluetooth-transport.ts`

```typescript
export interface WebBluetoothTransportConfig {
  readonly requestOptions: Readonly<{
    filters: readonly { readonly services: readonly string[] }[];
    optionalServices: readonly string[];
  }>;
  readonly primaryServiceUuid: string;
  readonly writeCharacteristicUuid: string;
}

export interface WebBluetoothPlatform {
  readonly isSecureContext: boolean;
  readonly bluetooth?: BluetoothNavigatorLike;
}

export function getBrowserBluetoothPlatform(): WebBluetoothPlatform;

export class WebBluetoothByteTransport implements BoardByteTransport {
  constructor(
    platform: WebBluetoothPlatform,
    config: WebBluetoothTransportConfig,
  );
  // BoardByteTransport methods exactly as declared in Unit 1.
}
```

`web-bluetooth-platform.ts` defines only the structural `BluetoothNavigatorLike`,
`BluetoothDeviceLike`, `BluetoothRemoteGattServerLike`,
`BluetoothRemoteGattServiceLike`, and `BluetoothRemoteGattCharacteristicLike`
members consumed by the adapter. The characteristic shape includes properties and
both modern write methods; no ambient global declaration is added.

**Implementation Notes**:

- `getCapability()` is pure: secure context must be true and `requestDevice` must be
  callable. `getRememberedDevices()` returns `[]` if `getDevices` is absent.
- `requestAndConnect()` synchronously sets `selecting`, sets the chooser guard, and
  calls `requestDevice(config.requestOptions)` before any `await`. It then places the
  chooser continuation on a FIFO promise queue. A browser `NotFoundError` maps to
  `chooser-cancelled`; no device becomes selected.
- `reconnect(deviceId)` uses a currently retained device or a matching result from
  `getDevices()`. It never invokes the chooser. Missing devices map to
  `device-unavailable`.
- Connection enters `connecting`, calls `gatt.connect()`, resolves the primary
  service and RX characteristic, selects one write method for the connection, then
  publishes `connected`. Do not cache service or characteristic across disconnect.
- Install exactly one `gattserverdisconnected` listener per retained device. On the
  event, synchronously clear server/service/characteristic/write-method references,
  increment a connection generation token, and publish `disconnected` unless an
  intentional disconnect is already transitioning. This makes queued stale work fail
  as `disconnected`.
- All GATT continuations use one private FIFO queue that recovers after rejection.
  A whole `writeBatch` is queued as one callback; validate connected state and a
  non-empty copied chunk list, then await each characteristic write in order.
- Select `writeValueWithoutResponse` when advertised and callable, otherwise
  `writeValueWithResponse`. If neither is available, connection fails with
  `write-not-supported`. Never use deprecated `writeValue`, send parallel writes, or
  retry a partial batch.
- `disconnect()` joins the queue, publishes `disconnecting`, calls
  `gatt.disconnect()`, clears all GATT handles even if no event fires, then publishes
  `disconnected` with retained device metadata. Calling it while already disconnected
  is idempotent.

**Acceptance Criteria**:

- [ ] Unsupported and insecure environments are detected without opening a chooser.
- [ ] The chooser is invoked in the synchronous portion of `requestAndConnect()` and a
  second concurrent chooser attempt fails deterministically.
- [ ] Connect, discovery, disconnect, and every write batch execute FIFO with no
  overlapping GATT operations or interleaved chunks.
- [ ] Every connection and reconnection resolves fresh service/characteristic objects.
- [ ] Remote disconnect invalidates handles immediately; pending/future writes reject
  with a stable recoverable error.
- [ ] Browser exceptions are mapped to the declared stable error codes.

### Unit 4: Deterministic mock transport

**File**: `web/src/board-control/mock-byte-transport.ts`

```typescript
export type MockTransportOperation =
  | { readonly type: 'connect'; readonly device: BoardDeviceRef }
  | { readonly type: 'disconnect'; readonly device: BoardDeviceRef | null }
  | { readonly type: 'write'; readonly chunks: readonly Uint8Array[] };

export interface MockByteTransportOptions {
  readonly capability?: BoardTransportCapability;
  readonly devices?: readonly BoardDeviceRef[];
}

export class MockBoardByteTransport implements BoardByteTransport {
  readonly operations: readonly MockTransportOperation[];
  constructor(options?: MockByteTransportOptions);
  failNext(
    operation: 'connect' | 'write',
    error: BoardTransportError,
  ): void;
  simulateRemoteDisconnect(): void;
  resetOperations(): void;
  // BoardByteTransport methods exactly as declared in Unit 1.
}
```

**Implementation Notes**:

- The mock copies chunks before recording and exposes copies/read-only snapshots so
  later caller mutation cannot rewrite evidence.
- Default to one remembered mock device and a supported/disconnected state.
- `failNext` is one-shot and FIFO per operation kind. Transitions and thrown errors
  match the real adapter contract; it does not simulate timing or packet semantics.

**Acceptance Criteria**:

- [ ] Tests can assert exact batch and chunk order without hardware.
- [ ] Tests can deterministically exercise chooser/connect failure, write failure,
  intentional disconnect, remote disconnect, reconnect, and unsupported capability.
- [ ] Caller mutation after `writeBatch()` cannot change recorded bytes.

### Unit 5: Contract and adapter verification

**Files**:

- `web/src/board-control/transport.contract.test.ts`
- `web/src/board-control/web-bluetooth-transport.test.ts`

```typescript
export function boardByteTransportContract(
  name: string,
  createTransport: () => BoardByteTransport,
): void;
```

**Implementation Notes**:

- Run reusable lifecycle/write contract cases against the deterministic mock.
- Browser adapter tests construct narrow fake platform/device/GATT objects with an
  operation log and deferred promises; do not stub a real `navigator.bluetooth`.
- Add a manual smoke checklist to this item during implementation. It should cover
  HTTPS/localhost, chooser filtering, observed controller name, connect status,
  disconnect event, explicit reconnect, and ordered representative dummy writes only
  when safe. Actual protocol bytes and LED correctness remain the light-scenes
  feature's hardware checkpoint.

**Acceptance Criteria**:

- [ ] Tests prove immediate chooser invocation before queued async work.
- [ ] Deferred fake operations prove no two GATT calls overlap and concurrent batches
  never interleave.
- [ ] Tests prove fresh characteristic resolution on reconnect and stale queued work
  cannot write through the old characteristic.
- [ ] Tests cover every capability reason and stable error code reachable from the
  adapter.
- [ ] `npm test`, `npm run typecheck`, and `npm run lint` pass in `web/`.

## Implementation Order

1. **Byte transport contract and errors** — fixes the consumer seam before browser
   mechanics and gives the mock a target.
2. **Browser session adapter and queue spike** — implement immediate chooser capture,
   deferred fake operations, remote disconnect invalidation, and one ordered batch;
   this falsifies the riskiest assumption before expanding the adapter.
3. **Aurora configuration** — bind researched UUID data only after generic lifecycle
   behavior works.
4. **Deterministic mock transport** — mirror the now-proven state/error behavior.
5. **Contract and adapter verification** — complete the failure matrix and manual
   smoke checklist.

No child stories are spawned. These units share one small state-machine contract and
are safer to implement and review as a single cohesive stride; story-level handoffs
would add coordination overhead around the same files.

## Testing

### Unit and contract tests: `web/src/board-control/transport.contract.test.ts`

- Initial state/capability, immediate subscription, unsubscribe behavior.
- Connect, exact copied ordered batch, disconnect, reconnect lifecycle.
- Empty batch, disconnected batch, scripted failures, and remote disconnect.
- Immutable/copy semantics for device, state, operation, and byte snapshots.

### Browser adapter tests: `web/src/board-control/web-bluetooth-transport.test.ts`

- Secure-context and API capability matrix; absent optional `getDevices`.
- Filter/optional-service request options and synchronous chooser call ordering.
- Chooser cancellation/concurrency and browser-error normalization.
- GATT connect → primary service → RX characteristic sequence.
- Without-response preference and with-response-only fallback.
- Serialized concurrent batches using deferred fake writes; rejection does not poison
  the queue.
- Remote and intentional disconnect, cached-handle invalidation, fresh GATT discovery
  on reconnect, and remembered-device lookup.

### Integration boundary

The downstream light-scenes feature consumes only `BoardByteTransport.writeBatch` and
session snapshots. It will run codec-produced batches through the mock and perform the
first physical LED smoke test. This feature intentionally sends no protocol bytes to
hardware on its own.

## Risks

- **User activation lost through queueing**: awaiting queued work before
  `requestDevice()` would make chooser behavior browser-dependent. **Fallback**: the
  chosen two-phase method invokes the chooser synchronously and tests call order.
- **Stale GATT handle writes after disconnect**: browser objects become invalid and a
  queued callback could retain them. **Fallback**: clear handles synchronously on the
  event, use a connection-generation token, and re-resolve on every connection.
- **Partial batch failure**: some chunks may have reached the controller before a
  write rejects. **Fallback**: report `write-failed`, never replay automatically, and
  let orchestration explicitly relight the complete scene after recovery.
- **Browser implementation variation**: `getDevices` and characteristic write modes
  vary across Chromium versions/platforms. **Fallback**: treat remembered devices as
  optional, select only advertised/callable write methods, and surface a typed
  unsupported/write error instead of guessing.
- **Least certain—without-response physical reliability**: browser promise completion
  does not prove the controller processed every chunk. **Fallback**: preserve the
  config-neutral transport boundary; the downstream hardware checkpoint can switch
  the preference to with-response or add measured pacing without changing consumers.

## Pre-mortem

This feature fails if a unit test suite proves ordering only in the mock while the real
adapter opens multiple GATT operations, or if reconnect retains a dead characteristic.
The browser fake therefore records and gates every GATT operation, and reconnect tests
must compare characteristic object identity. It also fails product-wise if chooser
cancellation looks like a broken board; cancellation remains recoverable and leaves a
clean disconnected state. No automatic reconnection, retry policy, pacing delay, or
transport-level animation scheduler is added without physical evidence.

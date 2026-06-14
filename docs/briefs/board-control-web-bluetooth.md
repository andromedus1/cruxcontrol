---
description: Read before designing epic-board-control — Web Bluetooth connection lifecycle, GATT, and reliability patterns for driving the Kilter board
type: brief
kind: research
slug: board-control-web-bluetooth
research_method: /brief
verification_status: attested
provenance: agent-synthesis
updated: 2026-06-13
nav_priority: high
blocks_phase: epic-board-control
summary: |
  The browser-side integration layer for board control: the Web Bluetooth
  connection lifecycle (user-gesture requestDevice → gatt.connect → service →
  characteristic), disconnect/reconnect handling, GATT operation serialization, the
  secure-context requirement, and a mock-adapter strategy for CI. The LED packet
  protocol itself is already covered by hardware-and-protocol.md; this brief covers
  what that brief does not — getting bytes to the board reliably from a browser.
key_findings:
  - "requestDevice must be triggered by a user gesture; the API works only in secure (HTTPS) contexts."
  - "GATT attributes are invalidated on disconnect and MUST be re-retrieved after reconnecting (gattserverdisconnected event)."
  - "GATT operations must be serialized — parallel reads/writes can error platform-dependently; queue them."
  - "Grip Connect (TypeScript) is the reference Web Bluetooth client and explicitly supports Aurora/Kilter LED boards."
  - "Wrap BLE behind a port with a mock adapter so the board-control path is testable in CI without hardware."
status: draft
---

# Brief: Board Control over Web Bluetooth (Integration Layer)

## Purpose

Unblocks **epic-board-control** (`[needs-brief]`). The Kilter LED *packet* protocol
— service/characteristic UUIDs, `0x01/0x02/0x03` framing, checksums, multi-packet
splitting, API-level-3 color encoding — is fully documented in
[hardware-and-protocol.md](hardware-and-protocol.md). This brief covers the part
that brief does **not**: how to reliably open and maintain a Web Bluetooth
connection from the browser and push those packets, plus how to keep the
hardware-coupled path testable. ARCHITECTURE flags Web Bluetooth reliability as the
project's biggest risk — this is the brief that de-risks it.

---

## 1. Connection lifecycle

The canonical flow `[chrome-web-bluetooth]{4}`:

1. **`navigator.bluetooth.requestDevice({ filters: […], optionalServices: […] })`** —
   **must be triggered by a user gesture** (touch/click). Filter by the board's
   discovery service UUID (`4488B571-…`, see hardware brief) to narrow the chooser.
   `optionalServices` must list the Nordic UART service so you can access it post-connect.
2. **`device.gatt.connect()`** — connects to the remote GATT server.
3. **`server.getPrimaryService(<uart-service-uuid>)`**.
4. **`service.getCharacteristic('6E400002-…')`** — the Nordic UART RX write
   characteristic (see hardware brief).
5. **`characteristic.writeValue…(packet)`** — write the encoded LED packets.

The API "is made available only to secure contexts … you'll need to build with TLS
in mind" `[chrome-web-bluetooth]{4}` — satisfied by the hosted HTTPS PWA (foundation
brief). And it's Chromium-only (~77% global; Chrome 56+/Edge 79+/Opera, not
Firefox/Safari/iOS) `[caniuse-web-bluetooth]{3}` — show an explicit unsupported-browser
message on the board-control surface.

## 2. Disconnect & reconnect (the reliability core)

- Listen for **`gattserverdisconnected`**; `device.gatt.disconnect()` also fires it
  `[chrome-web-bluetooth]{4}`.
- **Critical:** "Bluetooth GATT attributes, services, characteristics, etc. are
  invalidated when a device disconnects … your code should always retrieve … these
  attributes after reconnecting" `[chrome-web-bluetooth]{4}`. So **cache the
  `BluetoothDevice`, never the service/characteristic objects** — on reconnect, call
  `device.gatt.connect()` again and re-resolve service + characteristic before any write.
- Reconnect can reuse the remembered device (no new chooser) in the common case;
  fall back to `requestDevice` if the OS forgot the pairing.

## 3. Operation serialization

"Reading and writing to Bluetooth characteristics in parallel may raise errors
depending on the platform. I strongly suggest you manually queue GATT operation
requests" `[chrome-web-bluetooth]{4}`. **Serialize every BLE op** — connect, service
discovery, each characteristic write — through an `await`-chained queue. This matters
for our multi-packet climbs: send packet N, await, send N+1; never fire writes
concurrently. (Packet splitting itself is defined in the hardware brief.)

`writeValueWithoutResponse` is faster (no ACK) and fine for a stream of LED packets;
`writeValueWithResponse` is safer per-write. Start with `withoutResponse` serialized,
fall back to `withResponse` if packets drop on a given device. (Classic BLE pitfall:
the 23-byte default ATT MTU — the hardware brief's multi-packet splitting is exactly
what handles payloads beyond a single packet, so respect its chunk sizing.)

## 4. Reference implementation

**Grip Connect** (`Stevie-Ray/hangtime-grip-connect`, TypeScript) is the reference:
it explicitly supports "LED system boards with a controller box from Aurora Climbing
like the Kilter Board" `[grip-connect]{3}`, exposes a unified `connect` / `isConnected`
/ `disconnect` API `[grip-connect]{3}`, and targets Web / Capacitor / React Native /
Node `[grip-connect]{3}`. Read it for the concrete connect + write sequence; consider
it as a dependency or a copy-the-pattern source. (It is also a fallback distribution
path — a Capacitor wrapper — if Web Bluetooth proves too flaky on some friends' devices.)

---

## Implementation Notes

- **Port + mock adapter (testability).** Define a `BoardPort` interface (`connect()`,
  `playClimb(frames)`, `clear()`, `onDisconnect(cb)`); implement a `WebBluetoothAdapter`
  and a `MockBoardAdapter`. CI runs against the mock — the real adapter is exercised
  manually on hardware. This is how the "biggest risk" path stays in the test suite.
- **State machine.** Model connection as `disconnected → connecting → connected →
  (reconnecting)`. Re-resolve GATT attributes on every entry to `connected`.
- **Serialized write queue.** One in-flight BLE op at a time; the climb-play path
  enqueues the ordered packets from the encoder (hardware brief).
- **User-gesture entry point.** The "Connect board" action must be a direct
  click/tap handler — not deferred behind a promise chain — or `requestDevice`
  throws.
- **Secure context.** Works only on HTTPS (or localhost in dev); the foundation
  brief's hosting already provides this.
- **Cross-reference:** [hardware-and-protocol.md](hardware-and-protocol.md) owns the
  packet format, checksums, color encoding, and multi-packet splitting — do not
  re-derive them here.

---

## Sources

1. Chrome for Developers — *Communicating with Bluetooth devices over JavaScript*. `[chrome-web-bluetooth]{4}` — https://developer.chrome.com/docs/capabilities/bluetooth
2. caniuse.com — *Web Bluetooth* support table. `[caniuse-web-bluetooth]{3}` — https://caniuse.com/web-bluetooth
3. Stevie-Ray/hangtime-grip-connect — Web Bluetooth client (Kilter support). `[grip-connect]{3}` — https://github.com/Stevie-Ray/hangtime-grip-connect
4. (cross-ref) [hardware-and-protocol.md](hardware-and-protocol.md) — packet protocol, UUIDs, color encoding.

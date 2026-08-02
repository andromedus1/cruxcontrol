---
id: story-ble-android-light-write
kind: story
stage: review
tags: [ble]
parent: epic-board-control
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Repair Android board light writes

## Bug

On a Pixel 8 running Chrome, CruxControl can select and connect to the Kilter
Fullride controller—the board performs its connection warmup—but the first light
scene fails with “The board could not receive the light data” and no requested holds
remain lit.

## Expected behavior

After connection, a valid encoded multi-chunk light scene is delivered through the
Aurora UART characteristic and the selected holds light on the physical board.

## Reproduction evidence

- Physical device: Pixel 8 attached over ADB.
- Physical board: Kilter Fullride 7x10.
- GATT service and characteristic discovery complete and the controller warmup runs.
- The failure is raised by `WebBluetoothByteTransport.writeBatch`, after connection
  and before a scene completes.
- A diagnostic retry completed the write but produced unexpected positions and colors.
  Chrome exposes the controller name as `Kilter Board` with no API suffix. Aurora's
  naming convention defaults an omitted suffix to API level 2, while CruxControl was
  unconditionally encoding API level 3. The API2 controller consequently parsed API3
  three-byte records as two-byte records, scrambling both fields.
- Kilter's `LED Light Set Up - 7x10 FR.pdf` confirms a bottom-left serpentine path and
  two parallel 325-pixel strands (650 physical pixels). The generated catalog mapping
  is already contiguous and follows that alternating column direction.

## Repair contract

- Capture and record the underlying browser/GATT failure.
- Add a regression test that reproduces the transport behavior responsible for it.
- Make the smallest transport change that reliably sends a multi-chunk API3 scene on
  Android without weakening FIFO ordering or disconnect handling.
- Verify unit, type, lint, build, browser E2E, and the physical create-light-clear loop.

## Implementation evidence

- Added API-level discovery from the Aurora device-name suffix, defaulting an absent
  suffix to API2 as required by the controller convention.
- Added API2 position/color packing, packet markers, checksum, multi-packet framing,
  and 20-byte BLE write splitting. The editor retains its API3 256-color model and
  colors are reduced only at the API2 wire boundary.
- Regression coverage verifies the physical controller's exact `Kilter Board` name
  and expected API2 bytes.
- `npm test`: 228 passing; `npm run lint`: passing; `npm run build`: passing.
- Physical Pixel 8 + Kilter Fullride test: all selected positions and colors matched.

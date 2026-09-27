---
source_handle: scout-grip-capacitor
fetched: 2026-09-27
source_url: https://github.com/Stevie-Ray/hangtime-grip-connect/blob/c41f516cbc656f95cd8800737a499d1c942e9a23/packages/capacitor/src/models/device/aurora.model.ts
provenance: source-direct
substrate_confidence: source-direct
---

# Grip Connect Capacitor Aurora adapter

## Anchored observations (paraphrased)

### AuroraBoard extends AuroraBoardBase

The class imports the core AuroraBoard and the Capacitor Community BLE client.
`connect` initializes BLE, requests a device, connects and calls `onConnected`.
`write` looks up service/characteristic identifiers and calls
`BleClient.writeWithoutResponse`. `download` uses Capacitor Filesystem to write
an export to Documents. `disconnect` calls the plugin's disconnect method.

### connect / write error and state handling

The disconnect callback supplied to `BleClient.connect` logs the device ID. A
connect exception goes to the supplied error callback. If the device or message
is absent, `write` resolves without sending data. The class is a concrete adapter
example; the file does not contain physical test results or a durable climb/playlist
repository and recovery contract.

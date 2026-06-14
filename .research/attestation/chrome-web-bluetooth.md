---
source_handle: chrome-web-bluetooth
fetched: 2026-06-13
source_url: https://developer.chrome.com/docs/capabilities/bluetooth
provenance: source-direct
---

# Chrome for Developers — Communicating with Bluetooth devices over JavaScript (Web Bluetooth)

## Summary

Canonical Chrome guidance for the Web Bluetooth API. Device discovery via
`navigator.bluetooth.requestDevice` must be triggered by a user gesture. After
selection, connect with `device.gatt.connect()`, then `getPrimaryService()` and
`getCharacteristic()`. Disconnect via `device.gatt.disconnect()` (fires
`gattserverdisconnected`); GATT attributes are invalidated on disconnect and must
be re-retrieved after reconnecting. Parallel reads/writes can error — GATT
operations should be manually queued/serialized. The API is restricted to secure
contexts (TLS/HTTPS).

## Key passages

- "discovering Bluetooth devices with navigator.bluetooth.requestDevice must be triggered by a user gesture such as a touch or a mouse click."
- Connect: "Attempts to connect to remote GATT Server" via device.gatt.connect(); then "server.getPrimaryService()" followed by "service.getCharacteristic()."
- "You can also call device.gatt.disconnect() to disconnect your web app from the Bluetooth device. This will trigger existing gattserverdisconnected event listeners."
- "Bluetooth GATT attributes, services, characteristics, etc. are invalidated when a device disconnects. This means your code should always retrieve … these attributes after reconnecting."
- "Reading and writing to Bluetooth characteristics in parallel may raise errors depending on the platform. I strongly suggest you manually queue GATT operation requests when appropriate."
- "this experimental API … is made available only to secure contexts. This means you'll need to build with TLS in mind."

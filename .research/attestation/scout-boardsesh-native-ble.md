---
source_handle: scout-boardsesh-native-ble
fetched: 2026-09-27
source_url: https://github.com/boardsesh/boardsesh/blob/ab9a998efde3559869a6ab9884b36e804ce5f932/packages/mobile/src/lib/ble/adapter-factory.ts
provenance: source-direct
substrate_confidence: source-direct
---

# Boardsesh platform BLE factory

## Anchored observations (paraphrased)

### createBluetoothAdapter / factory comment

The factory selects `NativeIosBleAdapter` on iOS when the native module and board
capabilities are present. Its comment identifies Swift `BoardBleManager` as the
implementation used so Live Activity intents can control the wall synchronously.
Other cases use `RNBleAdapter`, described as using `react-native-ble-plx` on Android.
Acknowledged-write boards have a capability check before using the native path.
This records the source structure at the pinned revision, not tested runtime behavior.

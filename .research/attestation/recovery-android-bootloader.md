---
source_handle: recovery-android-bootloader
fetched: 2026-10-09
source_url: https://source.android.com/docs/core/architecture/bootloader/locking_unlocking
provenance: source-direct
substrate_confidence: source-direct
---

# Android bootloader lock transitions

## Summary

The documented bootloader-unlocking flow deliberately resets user data.

## Anchored observations

- **Unlock the bootloader:** enabling OEM unlocking makes an unlock operation
  eligible; it is distinct from performing that operation.
- **Unlock the bootloader, confirmation paragraph:** after the user confirms a
  fastboot flashing unlock request, the device should perform a factory data reset
  before permitting reflashing. The design protects against unauthorized data access.
- **Lock the bootloader:** the documented locking operation also resets the device.

This describes bootloader transitions, not every conceivable privileged acquisition.

---
source_handle: recovery-android-fbe
fetched: 2026-10-09
source_url: https://source.android.com/docs/security/features/encryption/file-based
provenance: source-direct
substrate_confidence: source-direct
---

# Android file-based encryption

## Summary

Android supports separately encrypted files and distinguishes data available before
and after credential unlock.

## Anchored observations

- **Opening section:** file-based encryption is required for devices launched with
  Android 10 or newer. Different files can use independently unlockable keys.
- **Direct Boot:** credential-encrypted storage is the default and becomes available
  after user unlock. Device-encrypted storage can be available before that unlock.
- **Dependencies:** trusted execution and verified-boot integration protect encryption
  keys against use by an unauthorized operating system.

This page does not quantify deleted-file recoverability or establish support for any
commercial acquisition tool.

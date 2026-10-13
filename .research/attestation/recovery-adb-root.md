---
source_handle: recovery-adb-root
fetched: 2026-10-09
source_url: https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/main/docs/dev/root.md
provenance: source-direct
substrate_confidence: source-direct
---

# ADB root and unroot

## Summary

ADB daemon privilege depends on build properties rather than USB authorization alone.

## Anchored observations

- **shell uid vs root uid:** adbd begins as root, then checks properties including
  ro.secure and ro.debuggable to decide whether it must drop to the shell identity.
- **shell uid vs root uid, build distinction:** production user builds do not allow
  adbd to retain root through this mechanism; eng and userdebug builds can.
- **From CLI to restart:** adb root/unroot writes service.adb.root and restarts adbd.
  The command is a state change, not a harmless way to query available privileges.

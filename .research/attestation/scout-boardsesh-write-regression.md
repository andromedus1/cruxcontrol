---
source_handle: scout-boardsesh-write-regression
fetched: 2026-09-27
source_url: https://github.com/boardsesh/boardsesh/pull/3228
provenance: source-direct
substrate_confidence: source-direct
---

# Boardsesh Aurora write regression repair

## Anchored observations (paraphrased)

### Summary

The maintainer reports an iPhone Aurora-board regression after choosing the write
mode from advertised characteristic properties: the connection completed but
acknowledgment-dependent writes stalled. The repair restores without-response
writes for Aurora while retaining a different MoonBoard path. The description says
the previous Capacitor app and initial React Native port used without-response
writes, with a Swift Live Activity/native BLE layer carried across the port.

### Test plan / native-change note

The PR records automated checks and explicitly lists physical iPhone/board testing
as pending in its test plan. It states that the native change requires a new binary,
not a JavaScript-only over-the-air update. GitHub marks the PR merged on 2026-06-27.
These are maintainer reports, not independently reproduced measurements.

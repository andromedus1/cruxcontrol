---
id: idea-native-share-cancel-status
kind: story
stage: review
tags: [ui]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-09-26
---

# Native share cancel status

## Brief
Treat an `AbortError` from the native Web Share sheet as neutral user cancellation rather
than rendering it as a red failure alert. Preserve real adapter failures as explicit,
recoverable errors. This low-severity UX follow-up was accepted during the standard
portable-sharing review; sharing, file fallback, and local data remain correct today.

## Delivery scope
Authorized in the everyday-reliability cleanup. Preserve stored library data and existing visual structure. Add focused regression evidence and complete the applicable review lane.

## Simplification opportunity
Repair the existing path directly; no new subsystem.

## Implementation notes (2026-09-26)
Root cause: the shared action runner classified native Web Share AbortError as a failure. Only the native share action now opts into neutral cancellation; real errors and clipboard AbortError retain alerts, and file fallback remains available.

Regression: PlaylistShareDialog.test.tsx first failed on a cancellation alert; now all 6 tests pass, covering cancel, actual failure, retry/fallback, and clipboard isolation. The PlayThrough companion suite also passes (12 combined). Bounded inline review confirms no persistence/transport changes and the cancellation status cannot hide clipboard failures.

Execution: cohesive inline host implementation, project standard weight with bounded standalone review (no independent story reviewer). Full repository/browser/CI verification pending final integration; no adjacent issues bundled.

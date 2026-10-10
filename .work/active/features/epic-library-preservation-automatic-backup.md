---
id: epic-library-preservation-automatic-backup
kind: feature
stage: drafting
tags: [data, security, ui]
research_refs: [independent-library-preservation]
parent: epic-library-preservation
depends_on: [epic-library-preservation-native-library, epic-library-preservation-private-vault]
release_binding: null
gate_origin: null
created: 2026-10-10
updated: 2026-10-10
---

# Automatically protect saved native library changes

## Brief

Capture a coherent committed library revision, persist pending work and automatically upload complete immutable snapshots while the app can execute and reach the service. Verify authenticated readback against the exact capture before acknowledging protection. Retry safely across interruption and app relaunch; newer edits must stay pending rather than borrowing an older receipt.

Own the compact protection status and Manage hub from the prepared flow, including offline, expired session, quota, capture failure and failed local-save states. Recovered OS/app state cannot silently re-establish authority to upload empty or stale snapshots. Retain prior good copies; the first release pauses at capacity instead of silently pruning. This is recovery backup, not live multi-device synchronization or group publication.

## Epic context

- Parent: `epic-library-preservation` — Android dogfood with parity, independent backup and the older Kilter catalog.
- Inherit the parent’s settled no-interim-PWA, offline-use, dual-backup and account-recovery decisions.
- User target: a private dogfood build in the next few days, contingent on demonstrated platform and recovery behavior rather than an unverified date promise.

## Grounding

- [Preservation comparison](../../../.research/analysis/briefs/independent-library-preservation.md).
- [Specification](../../../docs/SPEC.md), especially private library preservation and current wall-session capabilities.
- [Architecture](../../../docs/ARCHITECTURE.md), especially runtime composition, native transport and independent preservation.
- [Existing native shell](../../../prototypes/ios/README.md); native packaging does not currently imply native library persistence.

## Mockups

- Inherit [library preservation](../../../.mockups/flows/library-preservation/index.html) where backup surfaces apply.
- Existing editor, library, playlist and Kilter browser reuse their current UI; mock only genuinely new structure.
- Andrew’s 2026-10-10 instruction to proceed supplies authorization to continue this prepared direction; no new UI redesign milestone.

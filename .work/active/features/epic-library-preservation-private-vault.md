---
id: epic-library-preservation-private-vault
kind: feature
stage: drafting
tags: [data, security, infra]
research_refs: [independent-library-preservation]
parent: epic-library-preservation
depends_on: [epic-library-preservation-native-library]
release_binding: null
gate_origin: null
created: 2026-10-10
updated: 2026-10-10
---

# Access private backups through a recoverable account

## Brief

Prove native Android account sign-in, return, session renewal, owner-only authorization and recovery without the old phone. Select the smallest service implementation supported by that proof, with immutable complete snapshots, independent discovery and authenticated readback. Account-protected service-managed encryption is approved; end-to-end encryption and a separate owner key are not required.

Reuse the verified preservation comparison. Compare actual native authentication before choosing hosting; do not infer a workable session from storage primitives. Prepare reviewable configuration, retention/capacity limits and costs before provisioning. Offline authoring remains available during sign-out/outage. Existing backups must be discoverable without a local installation secret; empty/stale clients have no authority to delete or replace them. Sharing membership never authorizes private backup access.

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

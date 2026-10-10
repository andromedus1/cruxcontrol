---
id: epic-library-preservation-portable-files
kind: feature
stage: drafting
tags: [data, ui]
research_refs: [independent-library-preservation]
parent: epic-library-preservation
depends_on: [epic-library-preservation-native-library]
release_binding: null
gate_origin: null
created: 2026-10-10
updated: 2026-10-10
---

# Keep and restore a complete portable library file

## Brief

Deliver a validated complete library file through Android's real file/share path and restore it offline through the existing review/conflict flow. Verify the actual file at an owner-controlled destination and an exact round trip into an isolated clean installation. A cache file, Downloads-only copy or share-sheet completion does not prove off-phone protection.

Own platform delivery/cancellation, complete file naming and repeated exports, and clear distinction between handed-off and verified independent copies. Reuse the whole-library format, including Trash, effects, grades and exact playlist membership order. This is also the emergency recovery route when the online service or account is unavailable.

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

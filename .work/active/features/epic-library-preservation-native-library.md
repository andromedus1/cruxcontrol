---
id: epic-library-preservation-native-library
kind: feature
stage: drafting
tags: [data, infra]
research_refs: [independent-library-preservation]
parent: epic-library-preservation
depends_on: []
release_binding: null
gate_origin: null
created: 2026-10-10
updated: 2026-10-10
---

# Author offline in the native Android app

## Brief

Package the existing React app for Android and store all authored climbs and playlists in an actual native database. Reuse strict codecs, IDs/revisions, grade/angle metadata, holds, effects, Trash and ordered memberships. Prove complete saved data survives process termination, relaunch and a same-identity binary upgrade, and storage failures cannot be reported as successful saves.

This capability owns the focused runtime storage boundary, native repository composition, coherent complete capture, Android package/toolchain and bundled offline startup. Reuse the existing native shell/transport; do not rewrite the UI or create a second domain model. Android is the first target; the existing iOS prototype must remain buildable and keep its current evidence boundaries. This feature alone is not permission to resume irreplaceable authoring: the epic's independent-backup and recovery gates still apply.

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

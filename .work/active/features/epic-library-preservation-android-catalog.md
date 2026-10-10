---
id: epic-library-preservation-android-catalog
kind: feature
stage: drafting
tags: [data, infra]
research_refs: [independent-library-preservation]
parent: epic-library-preservation
depends_on: [epic-library-preservation-native-library]
release_binding: null
gate_origin: null
created: 2026-10-10
updated: 2026-10-10
---

# Use the older Kilter catalog in the Android app

## Brief

Make the already-approved older Fullride community catalog available in the Android package with the existing browser, filters, detail, board-lighting and playlist integration. Retain the older-library label and unknown-current-coverage limits. Bundle the known snapshot for the private dogfood build so availability does not depend on the laptop or a new catalog service.

Own reproducible verified artifact inclusion: the local gzip is ignored by Git and a clean build currently omits it. Add a build-time preflight/manifest check and explicit private artifact source instead of committing the catalog binary. Prove module Worker/WASM, OPFS/Web Locks, compressed byte/hash handling, installation, interrupted installation and offline relaunch in Android WebView. Reuse the current catalog port first; implement native catalog storage only if the packaged proof fails. Current official catalog acquisition and public redistribution remain separate catalog-epic work.

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

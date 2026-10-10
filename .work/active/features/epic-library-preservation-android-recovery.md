---
id: epic-library-preservation-android-recovery
kind: feature
stage: drafting
tags: [data, ble, ui, infra]
research_refs: [independent-library-preservation]
parent: epic-library-preservation
depends_on: [epic-library-preservation-native-library, epic-library-preservation-portable-files, epic-library-preservation-private-vault, epic-library-preservation-automatic-backup, epic-library-preservation-android-catalog]
release_binding: null
gate_origin: null
created: 2026-10-10
updated: 2026-10-10
---

# Recover and dogfood the complete Android wall-session app

## Brief

Complete the clean-install online recovery journey and remaining native interaction adapters so Andrew can use the app daily with parity to the shipped web version. Select a retained version, review additions/conflicts and verify exact restoration including IDs, grades, effects, Trash and ordered lists. Interrupted/partial restore remains honest and recoverable; retain the original copy.

Own Android permissions, chooser/light/clear/effects, pause/reconnect, keep-awake, Android Back/keyboard/safe areas, multiple-image screenshot import, playlist file/clipboard/share delivery and recipient-usable links. Native localhost share URLs are not acceptable. Verify catalog climbs resolve/light/play through from ordered playlists. Provide a stable private signing/install/update path and signing-key retention outside Git, without requiring a public Play Store release.

Acceptance is an actual phone-and-Fullride session after synthetic clean-install recovery, upgrade preservation and full-library semantic comparison pass. Never reset Andrew's profile as a fixture. Catalog downloads are reacquirable and excluded from authored-library backup. This feature does not close physical-iPhone acceptance or add partner sharing, logbook, manufacturers or recommendations.

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

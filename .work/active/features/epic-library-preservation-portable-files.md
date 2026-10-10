---
id: epic-library-preservation-portable-files
kind: feature
stage: implementing
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

## Design decisions

Use the established complete JSON format and native delivery port. The file must
remain readable independently of the app and backup service. The existing picker/
review/conflict/partial-result UI is retained. The prepared new Manage hub belongs
to automatic-backup; portable-file delivery does not wait for account UI.

Export completion means OS handoff, not confirmed remote retention. An independently
stored file is verified by reading that actual file on a different client and doing
an exact semantic restore comparison. Andrew confirmed on 2026-10-10 that automatic
online backups are required before real authoring. Manual cloud copies are not an
accepted dogfood bridge; portable files remain the independent second recovery route.

## Architectural choice

- **Native Filesystem + Share with strict file validation (chosen):** already exists
  for iOS, exposes owner-controlled destinations and requires the smallest Android
  extension. Validate Android cancellation and URI lifetime with the pinned plugin.
- **Custom Storage Access Framework plugin:** can provide a more direct save picker,
  but still cannot prove a cloud provider uploaded the bytes. Add only if the existing
  share/destination path is unusable on the target device.
- **Blob anchor download:** browser behavior is not enough evidence of packaged
  Android delivery; no fallback that silently treats an unobservable download as saved.

The trickiest unit is when the OS chooser returns versus when a recipient has finished
reading. Preserve app-owned temporary export bytes until they can safely be removed;
platform return semantics must not remove a file still being consumed by a destination.

## Implementation units

### 1. Platform delivery correctness

Files: `prototypes/ios/src/native-backup-delivery.ts`, its test file, and Android file
provider configuration if required by the chosen cache path.

```typescript
export function createNativeBackupDelivery(
  dependencies: NativeBackupDeliveryDependencies,
): LibraryBackupDelivery;
```

Keep the existing port; extend dependency configuration only for a proven platform
lifetime difference. Inspect the pinned Share8.0.3 Android activity callback and
Filesystem8.1.4 errors. Cover initial missing-directory handling, valid UTF-8 file
URI, cancellation, failure, repeat export and destination handoff. Restrict cleanup
to the export-owned cache directory; never touch the native library or user files.
A successful share callback must retain the existing instruction to check the chosen
destination, not display a false off-phone protection receipt.

### 2. File identity and validation

Files: `web/src/library-backup/service.ts`, `delivery.ts` and focused tests.

Keep `exportFile(): Promise<{filename:string; text:string}>` and validate using the
strict complete-library codec. Give repeated exports distinct readable names at
least to millisecond resolution (with collision handling if same-clock exports are
possible); date-only names should not encourage overwriting the only retained copy.
Exact snapshot content, not naming, establishes equality. No raw live SQLite-file
copy is substituted for a coherent logical export.

### 3. Offline recovery proof

Files: an isolated Android smoke script under `prototypes/ios/scripts/` and evidence
in this feature body. Use the actual exported file, not the original fixture as a
stand-in. Copy the delivered synthetic file outside the emulator, validate with the
production decoder, and restore it into a separately isolated empty installation.
Compare canonical full-library state including Trash, grade/angle, effects and ordered
memberships before/after/relaunch. Do not wipe the primary proof installation or the
owner's phone. Corrupt input and conflicts must not be presented as successful restore.
The local host copy proves off-device portable recovery; cloud-drive delivery on the
owner's phone is a separate actual destination check if used for dogfood.

### 4. Copy and operations

Files: `web/src/library-backup/LibraryBackupDialog.tsx` only for necessary truthful
copy (no layout change), `prototypes/ios/README.md` and this item.

Document actual Android picker/share behavior, where the independently retained test
file lives (outside Git), and remaining destination limitations. Do not commit personal
library contents or synthetic output dumps when the existing fixture suffices.

## Testing

Use injected filesystem/share boundaries for failure, cancellation, no false success,
concurrent request exclusion and correct temporary-file lifetime. Derive assertions
from platform delivery contract. Native emulator UI proves the delivered bytes and
independent file restore. Run native/static suites and affected library backup tests;
retain existing browser/iOS contracts. Real cloud destination proof is required before
calling a manual file bridge off-phone-protected on Andrew's installation.

## Risks

A chooser may return before the recipient finishes, or offer only same-device targets.
Remote upload success is outside this port; do not infer it. If the chooser cannot
supply a usable portable destination, revise for a dedicated native save capability.
Keep scope separate from automatic cloud-account setup and the final everyday-phone
acceptance owner.

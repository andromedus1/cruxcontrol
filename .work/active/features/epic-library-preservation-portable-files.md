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

Export completion is platform-specific and never means confirmed remote retention.
iOS keeps its existing Filesystem + Share handoff. Android saves through a focused
Storage Access Framework `ACTION_CREATE_DOCUMENT` plugin and reports the file as
saved only after the chosen provider's UTF-8 output stream closes. The native plugin
returns the selected `content:` URI for proof but does not log or retain it. Android
picker cancellation is reported as cancellation; an `AbortSignal` can stop delivery
only before the picker starts, so once native work begins the adapter follows its
actual result. A provider may leave a partial file after a write failure, which is
reported as failure and never as a successful backup.

An independently stored file is verified by reading the actual provider-written
file and restoring it into a separate empty installation for an exact semantic
comparison. This Android proof uses the emulator's Downloads provider and copies
the read-back bytes outside Git. Cloud upload and remote retention remain separate
destination checks. Andrew confirmed on 2026-10-10 that automatic online backups
are required before real authoring; portable files remain the independent second
recovery route, not a manual-only dogfood bridge.

## Architectural choice

- **Platform-specific native delivery (chosen):** retain the established iOS
  Filesystem + Share flow. Android uses a small `ACTION_CREATE_DOCUMENT` plugin
  with strict JSON-basename validation, UTF-8 output and close-before-success
  semantics. The selected `content:` URI is used only to verify the actual file.
- **Share-only Android delivery:** rejected because callback completion does not
  establish when a recipient finished reading the shared URI; no destination
  lifetime assumption is needed with the direct document save path.
- **Blob anchor download:** browser behavior is not enough evidence of packaged
  Android delivery; no fallback that silently treats an unobservable download as saved.

The trickiest unit is distinguishing picker cancellation from a completed provider
write. Keep `AbortSignal` on the TypeScript side; once the picker starts, report only
the native completion or failure. Do not claim a cloud provider uploaded or retained
the selected file.

## Implementation units

### 1. Platform delivery correctness

Files: `prototypes/ios/src/native-backup-delivery.ts`,
`prototypes/ios/src/android-backup-delivery.ts`, the focused
`LibraryBackupFile` Android plugin, runtime composition and their tests.

```typescript
export function createNativeBackupDelivery(
  dependencies: NativeBackupDeliveryDependencies,
): LibraryBackupDelivery;
```

Keep the existing delivery port. Cover iOS temporary-file cleanup and share handoff,
plus Android picker cancellation, write failure, close-before-success, abort boundary,
overlap exclusion and valid `content:` URI. Android has no app-owned export cache;
the SAF provider receives the complete encoded backup and the native plugin resolves
only after the output stream closes. A save result tells the user to check the chosen
location and explicitly says remote retention is unverified.

### 2. File identity and validation

Files: `web/src/library-backup/service.ts`, `delivery.ts` and focused tests.

Keep `exportFile(): Promise<{filename:string; text:string}>` and validate using the
strict complete-library codec. Give repeated exports distinct readable names at
least to millisecond resolution (with collision handling if same-clock exports are
possible); date-only names should not encourage overwriting the only retained copy.
Exact snapshot content, not naming, establishes equality. No raw live SQLite-file
copy is substituted for a coherent logical export.

### 3. Offline recovery proof

Files: isolated Android smoke scripts under `prototypes/ios/scripts/` and evidence in
this feature body. Use the actual file written by the SAF provider, not the original
fixture as a stand-in. Read the selected Downloads file outside the emulator, validate
with the production decoder, and restore it into a separate fresh installation.
Compare canonical full-library state including Trash, grade/angle, effects and ordered
memberships before/after/relaunch. Do not wipe the primary proof installation or the
owner's phone. Corrupt input and conflicts must not be presented as successful restore.
The local host copy proves off-device portable recovery; cloud-drive delivery on the
owner's phone is a separate actual destination check if used for dogfood.

### 4. Copy and operations

Files: `web/src/library-backup/LibraryBackupDialog.tsx` only for necessary truthful
copy (no layout change), and this item. The prototype README also needs a later
alignment pass after native acceptance; it is outside this implementation's write scope.

Document actual Android picker/share behavior, where the independently retained test
file lives (outside Git), and remaining destination limitations. Do not commit personal
library contents or synthetic output dumps when the existing fixture suffices.

## Testing

Use injected delivery boundaries for failure, cancellation, no false success and
concurrent request exclusion. Derive assertions from the platform delivery contract.
Native emulator UI proves the provider-written bytes and independent file restore. Run
native/static suites and affected library backup tests; retain existing browser/iOS
contracts. Real cloud destination proof is required before calling a manual file bridge
off-phone-protected on Andrew's installation.

## Risks

The document picker can target local or cloud-backed providers; successful stream close
does not prove a cloud upload completed. A later independent-client read remains the
evidence for a retained copy. Keep scope separate from automatic cloud-account setup
and the final everyday-phone acceptance owner.

## Implementation evidence

- Android uses a dedicated SAF save picker; picker cancellation and provider errors
  are distinct outcomes, and success follows output-stream close.
- Export filenames include UTC milliseconds and a same-instance collision suffix.
- On pinned `@capacitor/android` 8.4.3 / AndroidX Activity 1.11.0, `Bridge.callPluginMethod`
  dispatches plugin methods on Capacitor's `CapacitorPlugins` HandlerThread, while
  Activity Result callbacks synchronously reach the plugin from the Activity result
  path on the main thread. The callback now only extracts the result and queues
  provider I/O with `Plugin.execute`, keeping cloud-backed writes off the UI thread.
- Capacitor serializes retained `PluginCall` data into activity saved state. The
  plugin removes the backup text after copying it into its in-memory buffer, before
  launching the picker. After process/activity recreation, a callback without that
  buffer rejects before opening the output stream; a missing `PluginCall` only clears
  the buffer because there is no callback to reject. Capacitor also logs plugin call
  data before invoking the plugin in debug logging mode, so this removal does not
  prevent that log; the shell's committed Capacitor configuration now sets
  `loggingBehavior: "none"` and Android backup/transfer is disabled in the source
  manifest rules. The final APK policy and a fresh Logcat window remain pending
  native proof.
- Verified locally with web backup tests (32), prototype tests (90), catalog package
  tests (5), including an adapter regression for missing restored bytes, web and
  prototype TypeScript checks, scoped ESLint checks, `git diff --check`, and Node
  syntax checks for the Android proof scripts and picker helper.
- The provider write now runs away from Android's UI thread, and restored activity
  results without the in-memory bytes fail before opening a provider stream. No
  Android sync/build/install or emulator action was run for this change. Native UI
  save, independent empty-installation recovery, edit/relaunch comparison, merged
  package policy and Logcat checks remain pending the reserved emulator lane, so
  this feature is not ready for review yet.

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
  buffer rejects before opening the output stream; Android may already have created
  an empty destination, so the error says the backup was interrupted and the library
  is unchanged, then asks the user to export again. A missing `PluginCall` only clears
  the buffer because there is no callback to reject. Capacitor also logs plugin call
  data before invoking the plugin in debug logging mode, so this removal does not
  prevent that log; the shell's committed Capacitor configuration now sets
  `loggingBehavior: "none"` and Android backup/transfer is disabled in the source
  manifest rules. APK8's merged manifest, referenced legacy/cloud/device-transfer
  exclusions and packaged Capacitor configuration were inspected during native
  proof. The old runner attempted to match full export text in Logcat, but Android
  truncates long records; that check cannot establish that the complete payload was
  absent.
- Verified locally with web backup tests (32), prototype tests (90), catalog package
  tests (5), web and prototype TypeScript checks, scoped ESLint checks,
  `git diff --check`, and Node syntax checks for the Android proof scripts and
  picker helper. Review follow-up adds a filtered `appRestoredResult` listener
  regression which verifies retention and consumption of failed file-save results
  in the existing workspace alert. The adapter's missing-buffer unit test alone did
  not exercise Capacitor's app-restoration event.
- The provider write now runs away from Android's UI thread, and restored activity
  results without the in-memory bytes fail before opening a provider stream. The
  current APK8 includes this repair and was installed as a same-signature v7-to-v8
  source update with `adb install -r`; the source's actual pre- and post-update
  SAF exports match each other and the catalog owner's verified canonical snapshot.
  No Android process kill was induced to exercise callback restoration; the new
  mocked runtime test dispatches the actual Capacitor `appRestoredResult` event and
  checks that a matching failed file-save call is retained for the workspace alert.
- The portable runner now derives its full expected source from the committed
  synthetic fixture plus exactly the known edited-climb name/revision and the
  catalog provider append (including exact provider identity/order). Its canonical
  assertion was checked against the catalog owner's verified synthetic export; it
  does not use that export as a committed fixture or weaken the comparison to counts.
  Startup requires the two browser library databases to be absent while allowing
  only the distinct catalog receipt database. During the APK8 proof, the source
  export was saved through Android's `ACTION_CREATE_DOCUMENT` into Downloads, read
  back from the provider to the host, and decoded with the production codec. The
  actual bytes restored into the separate Android 36 recovery installation produced
  an exact canonical re-export. The recovery app was freshly installed before the
  restore; after a runner interruption, the resumed pass verified APK8 and zero
  climbs/playlists before proceeding. That resumed pass did not establish that the
  recovery package was newly installed in the resumed run; it did establish that
  its native library was empty before restore. A single synthetic editor name
  change was the only canonical difference, and it remained after force-stop and
  relaunch. The accepted APK8 fixture contained no grade and its edited climb was
  still angle 40. Existing native repository tests cover saving a V4 grade, but the
  APK8 portable round trip did not test grade persistence.
  APK8 policy inspection found `allowBackup=false`, 9 legacy exclusions, 18 cloud /
  device-transfer exclusions and `loggingBehavior: "none"`. Logcat windows around
  source export, restore/export, editor write/export and relaunch/export checked
  synthetic markers. The actual recovery import used a harness-injected `DataTransfer`
  file input; Android's system file chooser import was not exercised by that run.
  The Logcat collector truncates long records, so neither this nor the old full-text
  match proves the complete backup payload was absent. New proof checks explicit
  unique canary fragments and records no full-payload absence claim. Evidence is
  retained outside Git under `/tmp/cruxcontrol-android-portable-proof-v8-resume1-20261010`
  with the prior source-upgrade exports in `/tmp/cruxcontrol-android-portable-proof-v8-retry2-20261010`.
  The retry2 directory's `source-upgrade.json` was written by an operator; no
  original command output or source Logcat window was retained, so the retry2
  failure cause is unknown and incomplete as machine evidence. The new runner writes
  a machine receipt immediately after decoding and comparing the post-update SAF
  bytes, before Logcat capture or WebView cleanup, and stores Logcat results in
  separate files. The prior retry2 evidence remains unchanged. This verifies local
  provider save/readback and isolated emulator recovery; it does not verify
  cloud-provider upload, remote retention or an owner-phone destination.

## Review follow-up

- F1 is implemented in `bc8ef9d`: failed Android file-save results are accepted
  only for the `LibraryBackupFile/save` plugin and retained until the runtime
  subscriber consumes them. The existing workspace alert handles both backup and
  playlist file failures without labeling a playlist as a library backup. Generic
  interruption copy says the library is unchanged and an empty or partial chosen
  file may remain.
- F2 remains historical and unresolved: the original retry2 cause cannot be
  recovered. The operator-written receipt is not accepted by the runner. New runs
  produce a source comparison receipt at the exact SAF readback boundary and record
  build provenance (commit, tracked/index dirty state, APK hash and build interval)
  separately from Logcat checks.
- S3 is the outstanding native acceptance gap: the APK8 source contained no grade.
  A new isolated proof must set V4 and a different angle on emulator 5582, verify
  the exact save after relaunch, then export via SAF and compare a fresh empty
  recovery installation including grade and angle. It must preserve the older APK8
  evidence and must not alter source emulator 5580 or parity emulator 5584.
- S2 cancellation coverage now presses Android Back in the native Save picker and
  asserts the cancellation status. It does not claim that the provider created no
  destination; a provider may leave an empty file.
- The runner's new `grade-roundtrip` mode records the DataTransfer restore method,
  checks unique Logcat canary fragments, and explicitly disclaims full-payload
  absence because Logcat truncates long records. The system chooser import is
  covered separately by the Android parity proof.

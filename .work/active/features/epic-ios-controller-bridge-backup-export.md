---
id: epic-ios-controller-bridge-backup-export
kind: feature
stage: implementing
parent: epic-ios-controller-bridge
depends_on: [ios-simulator-build-smoke]
release_binding: null
gate_origin: null
created: 2026-10-09
updated: 2026-10-09
tags: [data, ui]
---

# Native prototype needs a working backup file export

Actual iPhone17/iOS27 WKWebView check: after saving one synthetic draft, press
Back up & restore → Download library backup. The app reports "Backup download
started", but no file/save sheet opens and no backup appears in its container.
Native App log confirms LaunchServices rejects opening a `blob:capacitor://localhost/`
URL with LSApplicationWorkspaceErrorDomain Code115. The pinned Capacitor navigation
delegate hands that URL to UIApplication.open; it has no download handler.

The browser-only anchor-download mechanism in LibraryBackupDialog does not establish
a native backup. Preserve the existing backup codec, complete-library coverage and
update safeguards when introducing an explicit native file-export boundary. The
iOS controller epic already requires an inspected export/restore round trip before
native storage acceptance; this concrete failure now explains that open gate.

Evidence outsideGit: `/tmp/cruxcontrol-native-app.log` (12:13:02 local), and
`/tmp/cruxcontrol-native-maestro-backup/`. Only synthetic records were involved.
Do not count the dialog's status message as successful export.

## Authorized scope and decisions

Andrew authorized resuming the iPhone proof after migration, including local tooling.
Repair this verified prototype gap while community catalog implementation proceeds.
Retain the complete backup service/codec and normal user-initiated backup UI. Browser
exports keep working. Native export must hand a real complete file to a supported
iOS save/share mechanism, report cancellation and failures honestly, and prove an
inspected synthetic export/restore round trip. No production framework or storage
migration decision, account, remote service, personal-data transfer or phone update.

## Simplification opportunity

Reuse the existing exportFile service and runtime injection conventions; establish
one explicit file-delivery seam rather than embedding platform checks in the backup
codec. Review installed Capacitor capabilities and official sources before choosing
the smallest native mechanism. Avoid new bespoke screens where the existing backup
dialog and native OS file controls serve the same flow.

## Execution

Medium feature: one cohesive prototype file-delivery integration, design before code.
Standard review from project conventions; implementation follows dependency-verified
native startup. Current native check story remains the owner of broader interaction
evidence; this feature owns the failing export contract and its corrected round trip.

## Grounding and design decisions

Designed under the active autopilot on 2026-10-09. The dependency is satisfied by
archived `ios-simulator-build-smoke` (`git_ref: 197013a`). Root also verified the
existing native file picker imports the synthetic fixture's four climbs and two
playlists, including B-before-A membership order. Import remains on the existing path.

- `LibraryBackupService.exportFile()` already produces a stable, complete JSON
  snapshot and filename. The defect is delivery in `LibraryBackupDialog.download()`;
  keep the service, codec, repositories, limits, and restore semantics unchanged.
- Add a platform-neutral delivery port and inject its native implementation through
  `createPrototypeRuntime()`. Shared UI and backup code do not import Capacitor.
  Native plugin failure must surface; never fall back to the rejected blob URL there.
- Use official `@capacitor/filesystem` **8.1.4** and `@capacitor/share` **8.0.3**, pinned
  only in the isolated prototype package and lockfile. npm registry versions and
  release source were checked on 2026-10-09; existing Capacitor 8.4.3 stays pinned.
- Filesystem supports UTF-8 writes and returns a URI; Share accepts local file URIs.
  Write the existing JSON to the app's cache, then pass the returned `file://` URI
  in `Share.share({ files: [uri], title: 'CruxControl library backup' })`. The OS sheet
  supplies Save to Files and other user-selected destinations. Do not set the backup
  JSON as message text or use an HTTP endpoint. [Filesystem API](https://capacitorjs.com/docs/apis/filesystem),
  [pinned Filesystem contract](https://github.com/ionic-team/capacitor-filesystem/blob/4a46c5ad3a170f479eb0f8b00a2fb93c68d47ebe/src/definitions.ts),
  [Share API](https://capacitorjs.com/docs/apis/share).
- The pinned iOS Share plugin resolves only when the native completion callback says
  completed; it rejects cancellation with the exact message `Share canceled`, and
  rejects activity errors separately. A resolved empty `activityType` still means
  completed; do not infer cancellation from it. Encapsulate the exact cancellation
  mapping in the native adapter and test it. [Share 8.0.3 iOS implementation](https://github.com/ionic-team/capacitor-plugins/blob/87c0bb8045db2b4560d3db4b7d8e565c23ec1736/share/ios/Sources/SharePlugin/SharePlugin.swift).
- A successful share callback proves OS activity completion, not that an independent
  backup survives at a particular destination. UI copy says to check the chosen
  destination; actual file inspection and a separate-simulator restore are acceptance
  requirements. No physical phone, framework choice, durable-storage migration,
  native authentication, or production distribution is established here.

## Architectural choice

Keeping anchor downloads or substituting Web Share inside WKWebView would retain an
unproven web delivery path. A custom Swift document-picker plugin could implement a
save-only flow but would add native code and a new bridge contract. Use the official
Filesystem and Share plugins behind one delivery port: supported file transfer with
existing OS controls, precise iOS cancellation behavior, and no parallel backup codec.

## Mockups

No new mock required under the project's existing-component/copy exception. Reuse
`LibraryBackupDialog` and the iOS share sheet. Native button/heading/status copy changes
within that layout; no custom picker, sheet, wizard, or visual-system change.

## Implementation units

### 1. Delivery contract and native file lifetime

New shared file: `web/src/library-backup/delivery.ts`, exported from the existing
`index.ts`. Derive the file type from the existing service instead of duplicating it:

```typescript
export type LibraryBackupFile = Awaited<ReturnType<LibraryBackupService['exportFile']>>;

export interface LibraryBackupDeliveryResult {
  readonly status: 'download-started' | 'shared' | 'cancelled';
  readonly warning?: string;
}

export interface LibraryBackupDelivery {
  readonly kind: 'download' | 'share';
  deliver(file: LibraryBackupFile, signal?: AbortSignal): Promise<LibraryBackupDeliveryResult>;
}

export const browserLibraryBackupDelivery: LibraryBackupDelivery;
```

The browser implementation extracts the dialog's existing JSON Blob/anchor/download
and object-URL cleanup into this port. It reports `download-started`, preserving the
limited browser guarantee. Check an already-aborted signal before clicking; failures
reject. Remove the dialog's old `createObjectUrl`/`revokeObjectUrl` testing props and
test that behavior at the delivery boundary; there are no verified external consumers.

New native file: `prototypes/ios/src/native-backup-delivery.ts`. This is the trickiest
unit: a real file must remain available for the complete native share operation.

```typescript
export interface NativeBackupDeliveryDependencies {
  readonly filesystem: Pick<FilesystemPlugin, 'writeFile' | 'rmdir'>;
  readonly share: Pick<SharePlugin, 'share'>;
}

export function createNativeBackupDelivery(
  dependencies: NativeBackupDeliveryDependencies,
): LibraryBackupDelivery;
```

Use one reserved directory, `cruxcontrol-backup-export`, under `Directory.Cache`.
The runtime owns one adapter and the prototype allows one scene. Reject overlapping
deliveries before filesystem work; hold that guard through final cleanup. Never delete
outside this owned directory. Accept only a nonempty basename for `file.filename`
(no separators, `.` or `..`) before constructing its relative path.

Native operation order:

1. If aborted, return cancelled. Remove this adapter's leftover cache directory from
   an interrupted previous export. Ignore only Filesystem's missing-file code
   `OS-PLUG-FILE-0008`; other preflight cleanup errors reject before another copy is
   written. This bounds abandoned copies without startup I/O or a background janitor.
2. Write `{ path: 'cruxcontrol-backup-export/' + file.filename, data: file.text,
   directory: Directory.Cache, encoding: Encoding.UTF8, recursive: true }`. Preserve
   the filename and full JSON bytes; no base64 conversion or record projection.
   Use `writeFile`'s returned URI rather than a redundant `getUri` round trip. Reject
   a missing/non-file URI before invoking Share.
3. Check abort again after asynchronous preparation. If still active, await
   `share({ files: [uri], title: 'CruxControl library backup' })`. Resolve `shared`
   for any successful result; normalize only the pinned exact cancellation rejection
   to `cancelled`. All other failures reject with a useful export error.
4. In `finally`, recursively remove the owned directory after Share resolves/rejects,
   or after any preparation/write/URI/abort failure. Attempt cleanup even when a
   failed write may have left partial bytes. Ignore only missing-file errors.
   Cleanup failure must not turn completed sharing into an export failure: return a
   warning with the completed/cancelled outcome. If export itself failed, retain that
   primary error and append that its temporary copy could not be removed. The next
   attempt retries cleanup. Do not log JSON, records, or file URIs.

Do not delete the cache file on a timer, on backgrounding, or when the share sheet is
first presented. The plugin has no sheet-cancellation API: if the caller aborts after
Share starts, continue awaiting native completion and cleanup; the unmounted UI ignores
the outcome. No arbitrary timeout may delete a file still being used by the OS. A
process kill can leave only the cache copy, reclaimed by the next export or the OS;
the cache copy itself is never represented as a durable backup.

### 2. Compose the port and preserve dialog safeguards

Files: `web/src/app/create-runtime.ts`, `web/src/app/CruxControlWorkspace.tsx`,
`web/src/library-backup/LibraryBackupDialog.tsx`, and `prototypes/ios/src/runtime.ts`.

Add optional `readonly backupDelivery?: LibraryBackupDelivery` to both
`CruxControlRuntime` and `CruxControlRuntimeDependencies`. The normal runtime returns
the injected port or `browserLibraryBackupDelivery`; the optional field preserves
existing lightweight test runtimes. Workspace passes it as the dialog's optional
`delivery` prop, whose default is the browser port. Native composition injects
`createNativeBackupDelivery({ filesystem: Filesystem, share: Share })` only when
`Capacitor.getPlatform() === 'ios'`. Constructing/opening the library does not call
Filesystem or Share. Browser inspection of the prototype keeps normal downloads.

`download()` awaits `service.exportFile()`, checks its generation, then awaits
`delivery.deliver(file, signal)`. Keep `operationPending` and phase `exporting` active
through delivery and cleanup. Close/Escape, duplicate export, and restore remain
disabled during that full period. Existing workspace `backingUp` update admission
stays active until the dialog actually closes. Do not call the update coordinator
from the native adapter or relax the existing native background/disconnect behavior.

Own an AbortController for this delivery and abort it during component cleanup.
Generation checks suppress stale state changes and prevent a late `exportFile()`
result from starting delivery. Aborting during native preparation prevents a late
sheet; an already presented sheet retains its file until native completion.

Copy stays in the existing components:

- Browser keeps **Download a backup**, **Download library backup**, and
  **Backup download started**.
- Native uses **Save a backup**, **Save or share library backup**, and a short helper:
  **Choose Save to Files or another destination in the iOS share sheet.**
- While native delivery is pending: **Preparing backup and opening share options…**
- `shared`: **Backup export completed. Check your chosen destination.**
- `cancelled`: **Backup export canceled.** No success message or error alert.
- Failure: the existing alert shows the export error and an export-appropriate
  **Try export again** action, rather than the import-specific **Choose another file**.
  An `export-failed` phase can distinguish that branch. Existing import recovery
  behavior stays intact. A cleanup warning uses the existing status area and states
  **The temporary backup copy could not be removed from this app's storage.**

### 3. Plugin packaging and repeatable proof

Update `prototypes/ios/package.json` and its lockfile with the pinned plugins, then
use the existing `sync` command under Node 22 to regenerate
`prototypes/ios/ios/App/CapApp-SPM/Package.swift`. Do not hand-edit generated plugin
lists, move dependencies into the web package, or upgrade the native framework.

No existing app privacy manifest was found. Add
`prototypes/ios/ios/App/App/PrivacyInfo.xcprivacy` and its resource/target membership in
`prototypes/ios/ios/App/App.xcodeproj/project.pbxproj`. Declare
`NSPrivacyAccessedAPICategoryFileTimestamp` with the documented Filesystem reason
`C617.1` for this app-container file access. Preserve any manifest entries introduced
concurrently; do not invent tracking/collection declarations or claim App Store
acceptance. Verify the manifest is present in the built app. [Filesystem manifest requirement](https://capacitorjs.com/docs/apis/filesystem#apple-privacy-manifest-requirements),
[Capacitor target-membership instructions](https://capacitorjs.com/docs/ios/privacy-manifest).

This cache-to-share path does not require exposing the app's Documents directory with
`UIFileSharingEnabled`/`LSSupportsOpeningDocumentsInPlace`; do not add those flags merely
to make testing convenient. Update `prototypes/ios/README.md` with actual native export
steps, plugin pins, cancellation/cleanup behavior, and the verified scope after proof.

## Implementation order

Implement and test the delivery boundary first, then compose it into the runtime and
dialog, synchronize plugins and build, and perform the actual native round trip. The
units form one small feature with one owner; no child stories or additional harness
are necessary. Coordinate the additive `create-runtime.ts` change with the upcoming
community-browser runtime integration; do not overwrite its catalog member.

## Testing and acceptance

- `web/src/library-backup/delivery.test.ts`: browser delivery uses the original JSON
  filename/type/content, clicks once, cleans its URL on success/failure, reports only
  download initiation, and performs no side effect for an already-aborted request.
- `prototypes/ios/src/native-backup-delivery.test.ts`: fake the narrow plugin interfaces.
  Verify exact UTF-8 text, app-cache path and URI passed as a file; defer the Share
  promise to prove cleanup does not happen early. Cover success with empty activity
  type, exact cancellation, unrelated rejection, failed/partial write, invalid URI,
  abort before/during preparation, abort after sheet opening, cleanup failure without
  losing the primary outcome, retry of leftovers, and overlapping-call rejection.
- Extend `LibraryBackupDialog.test.tsx`: a pending delivery keeps Close/Escape, export,
  and import guarded; completion/cancellation/failure use distinct copy. A late
  export after unmount cannot invoke delivery, and unmount during delivery aborts its
  signal without stale UI updates. Preserve existing restore/conflict/refresh tests.
- Extend `prototypes/ios/src/runtime.test.ts` and focused workspace coverage to prove
  the injected delivery reaches the dialog, native startup does not call plugins,
  and browser inspection retains web export. Existing backup service/codec tests and
  packaged-browser smoke remain regression coverage for full-library contents.
- Run affected unit tests, web/prototype lint and typecheck, prototype sync/build,
  and the existing browser smoke. Build/install the resulting native app on the same
  isolated simulator without uninstalling or resetting it; verify plugin registration
  and packaged privacy manifest. Linux/browser tests alone cannot close this feature.

Actual native acceptance is parent-operated with Maestro/OS controls and synthetic
data only. The current first simulator has the four fixture climbs plus one created
V4 draft and two playlists; capture the exact baseline before the run. Then:

1. Export from the normal dialog; first cancel the OS sheet and observe cancellation,
   unchanged library, enabled retry, and removed temporary cache file.
2. Retry and choose Save to Files. Inspect the actual saved JSON outside Git, decode
   it with the existing codec, and compare all saved record IDs/revisions, drafts,
   finished/Trash states and dates, ordered memberships (including the missing local
   reference), and effect recipes to the baseline. Verify cache cleanup after the OS
   completes. Dialog text and mere share-sheet presentation are insufficient.
3. Restore that exported file through the normal file picker into a separate empty
   test simulator. Verify the same content/order and preservation after relaunch;
   an additional export can establish canonical snapshot equality ignoring the
   envelope's export timestamp. Never clear the first simulator as a test shortcut.
4. Record commit, Xcode/runtime, observed outcomes and evidence locations in this
   item; keep actual backup contents and simulator identifiers outside Git. Obtain
   the standard single independent feature review and required CI before completion.

## Risks and limits

- **Save to Files availability and bytes:** the plugin contract supports local files,
  but only actual iOS 27 execution proves a usable destination and intact backup. If
  the normal sheet cannot deliver the file, leave acceptance open and report that
  concrete mechanism failure; do not silently switch to raw container extraction as
  proof or expand to a custom Swift exporter without revisiting this decision.
- **OS completion is narrower than durability:** a share target may accept an item
  without giving the app a path to inspect. Keep honest UI wording and require the
  synthetic inspected-file/restore evidence. This does not establish physical-device
  backup behavior or durable native storage across updates.
- **Cleanup and lifecycle:** retain the cache file while the OS owns the share flow;
  failed cleanup is reported, and an interrupted process can leave an app-cache copy.
  Removing that copy never removes the user-selected destination file.
- **Version-specific cancellation:** the plugin offers no typed cancellation code on
  iOS 8.0.3. Pin and test the exact source-observed message; all unknown failures stay
  errors. Recheck that behavior before any plugin upgrade.

## Implementation notes

- Execution capability: Luna xhigh per the active autopilot instruction; one cohesive
  delivery seam with a bounded native plugin adapter.
- Review weight: standard, from `.work/CONVENTIONS.md`.
- Files changed: `web/src/library-backup/delivery.ts` and `delivery.test.ts`;
  `web/src/library-backup/index.ts`; `LibraryBackupDialog.tsx` and its tests;
  `web/src/app/create-runtime.ts` and its tests; `CruxControlWorkspace.tsx` and its
  tests; `prototypes/ios/src/native-backup-delivery.ts` and its tests; native runtime
  composition and tests; pinned prototype package dependencies and lockfile; generated
  `CapApp-SPM/Package.swift`; Xcode privacy-manifest membership and
  `PrivacyInfo.xcprivacy`.
- Tests added: browser delivery URL/content cleanup and pre-abort checks; native adapter
  UTF-8/cache/share lifetime, cancellation, URI validation, abort, cleanup, retry, and
  overlap cases; dialog admission and outcome copy; runtime/workspace delivery
  composition. These protect the new file-delivery boundary and the observed native
  export failure.
- Simplification: moved Blob/anchor/object-URL handling out of the dialog into the
  browser delivery adapter and removed dialog-only URL factory props.
- Discrepancies from design: none in code. Actual iOS share-sheet/export/restore proof
  remains parent-operated; update the prototype README after that proof records the
  observed scope and outcomes.
- Adjacent issues parked: none.
- Implementation commit: `40920db`.
- Verification: web 48 focused unit/integration tests, typecheck, and lint pass; iOS
  prototype 25 focused tests, typecheck, and lint pass. `npm run sync` regenerated the
  plugin SPM list with Filesystem 8.1.4 and Share 8.0.3 and built `dist-ios-prototype`.
  The packaged-browser Playwright smoke passed 1/1; privacy plist and Xcode project
  parse checks pass. Native build/install and OS round trip are intentionally still
  open for the parent-operated acceptance step.

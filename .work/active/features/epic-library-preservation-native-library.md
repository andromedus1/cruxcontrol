---
id: epic-library-preservation-native-library
kind: feature
stage: review
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

## Design decisions

All product direction is inherited. Existing UI is reused without a new visual
surface. Android is the only new persisted-library target in this feature; the iOS
prototype retains its current storage until its own explicit migration/acceptance.
The same Capacitor package under `prototypes/ios` gains Android support to avoid
forking the shell; defer a directory rename that adds no capability. Keep its app
identity stable for upgrades. This is a synthetic-data proof until the remaining
preservation capabilities pass.

## Architectural choice

1. **Shared UI with a native SQLite library (chosen):** reuse React, domain codecs,
   editor, playlists and controller. Add a narrow runtime library factory and native
   repositories in one persistent database. The verified comparison identifies
   `@capacitor-community/sqlite` 8.1.1 as the concrete bridge candidate; pin it and
   prove it on Android before admitting the client.
2. **Persisted browser IndexedDB inside the shell:** less integration work but does
   not satisfy the requested actual-native-storage direction. Keep as comparison,
   not a hidden fallback if native initialization fails.
3. **Rewrite UI/domain with native views:** greater rewrite and parity risk without
   eliminating independent-backup requirements. No justification for this dogfood target.

The trickiest unit is transaction/lifetime correctness across asynchronous plugin
calls: all library operations share one serialized connection; snapshot capture must
see a single coherent database state; closing/reopening under React StrictMode must
not race an in-flight commit or attach a new runtime to a disposed connection.

## Implementation units

### 1. Runtime library composition

Files: `web/src/app/library.ts` (new), `web/src/app/create-runtime.ts`, runtime tests.

```typescript
export interface AppLibrary {
  readonly drafts: LocalDraftRepository;
  readonly playlists: LocalPlaylistRepository;
  readonly backupStore: LibraryBackupStore;
  close(): void;
}
// Added to CruxControlRuntimeDependencies:
readonly openLibrary?: () => Promise<AppLibrary>;
```

Encapsulate the current two-IDB opening/cleanup in the default factory. Retain the
existing database-opener test seams unless an equivalent focused replacement makes
them unnecessary. Injected native storage must never open either browser library DB.
Runtime construction errors and idempotent close release exactly their owned resources.
Catalog composition stays separate and lazy.

### 2. Reuse validated domain construction

Files: `web/src/drafts/record.ts`, `web/src/playlists/record.ts` (new if needed),
existing IndexedDB repositories.

```typescript
export function draftFrom(content: DraftContent, identity: {
  id: LocalDraftId; revision: DraftRevision; createdAt: string;
  updatedAt: string; trashedAt?: string;
}): LocalClimbDraft;
export function draftContentOf(draft: LocalClimbDraft): DraftContent;
export function draftInCollection(draft: LocalClimbDraft,
  collection: NonNullable<DraftListOptions['collection']>): boolean;
export function playlistFrom(content: PlaylistContent, identity: {
  id: PlaylistId; revision: PlaylistRevision; createdAt: string; updatedAt: string;
}): LocalPlaylist;
```

Extract the existing pure constructors/filter rules only where the second adapter
needs them. Reuse codecs as the contract authority; preserve browser behavior.

### 3. Transactional native library

Files: `prototypes/ios/src/native-library.ts`, `native-library.test.ts`.

```typescript
export interface NativeLibraryDatabase {
  execute(sql: string): Promise<void>;
  run(sql: string, values: readonly unknown[]): Promise<void>;
  query(sql: string, values?: readonly unknown[]): Promise<readonly Record<string, unknown>[]>;
  close(): Promise<void>;
}
export async function createNativeLibrary(database: NativeLibraryDatabase,
  options?: DraftRepositoryOptions & PlaylistRepositoryOptions): Promise<AppLibrary>;
```

One native database, schema version checked before use, stable IDs as primary keys
and strict versioned JSON records stored in separate climb/playlist tables. Bound SQL
values, no interpolated user input. No speculative ORM or syncing tables. Serialize
all operations on the connection, and use explicit transactions for revision checks,
writes, restore batches and complete snapshot capture. Commit must succeed before
reporting success. On ambiguous rollback/connection failure, fail subsequent writes
until reopen rather than continuing on unknown transaction state. Do not delete,
recreate, or silently fall back when open/schema/decode fails.

Implement existing repository semantics: UUID collision handling; expected-revision
conflicts; immutable dates/identities; active/draft/finished/Trash collection filtering;
update rejection for trashed climbs; strict reads unless diagnostics opt-in is given;
playlist ordering; atomic per-batch missing-only restore with canonical equality.
Malformed JSON and key/payload ID mismatches are corrupt records. Backup capture
remains strict even when the browsing list elects partial diagnostic reads.

### 4. Coherent complete capture

Files: `web/src/library-backup/types.ts`, `service.ts`, tests; native library.

```typescript
// Optional strong snapshot boundary on LibraryBackupStore:
readSnapshot?(): Promise<LibrarySnapshot>;
```

Use the atomic snapshot method when supplied. Retain the browser's bounded repeated
reads as its existing weaker fallback; never describe them as a transaction.
`exportFile` and `review` must read all saved records, including Trash, grades,
recipes and memberships, through strict decoding. Existing per-store restore outcome
contracts remain accurate; whole-restore atomicity is not required in this unit.

### 5. Actual Capacitor connection and Android bootstrap

Files: `prototypes/ios/src/open-native-library.ts`, `runtime.ts`, tests, package/lock.

```typescript
export function openNativeLibrary(): Promise<AppLibrary>;
```

Pin the SQLite plugin at 8.1.1 and Android runtime at the existing Capacitor 8.4.3.
Connect in persistent native database storage, not cache/WebView. Configure or verify
appropriate journaling and synchronization; let the plugin expose its real failures.
Use a serialized lease/lifetime if necessary to handle overlapping React initialization
and close/reopen. Native Android startup injects this factory; iOS keeps its current
library for now. Enable the existing native BLE/lifecycle and file-delivery composition
for Android without initializing Bluetooth before Connect.

### 6. Android package and build

Files: `prototypes/ios/android/**`, package scripts, `.gitignore`, CI as appropriate.
Generate the Android project from the pinned CLI. Provide `sync:android` and a
repeatable Gradle build with JDK 21/Android SDK 36. Keep binaries, SDK paths, device
identifiers, databases, signing keys and private artifacts out of Git. Configure
Bluetooth permissions and existing native app semantics following the pinned plugin.
Bundle shared assets without a service worker or remote development-server URL.
The parent owns local SDK installation; no physical-phone maintenance in this unit.

### 7. Verification and operational entry

Files: `prototypes/ios/scripts/*android*`, `prototypes/ios/README.md`, tests above.
Use the existing synthetic whole-library fixture. A real SQL engine exercises
repository transactions, conflict/rollback, corrupt rows and canonical full export
round trips (Node 22 SQLite is acceptable for adapter-independent SQL tests).
Plugin mocks establish composition and lifecycle only; they do not prove native
storage. Compile Android, launch in an isolated emulator, restore/edit/save/relaunch,
then install an update with the same identity and compare a complete exported snapshot.
Document precisely which checks ran; failure to run native acceptance leaves the
feature implementing rather than claiming device durability.

## Implementation order

Start package/toolchain compilation early, then library composition and native
transactions, snapshot capture, runtime integration, exact synthetic comparisons and
emulator update proof. Cohesive ownership: one worker implements this feature; no
child-story fan-out or separate database/API/UI owners. The host owns SDK installation
and independent review; work through interfaces and acceptance above as checkpoints.

## Testing

- Real SQL lifecycle/revision/collision/Trash/list/order behavior, reopen persistence,
  strict corruption failures, rollback under failed writes, and concurrent operations.
- A complete native snapshot matches the fixture exactly and never mixes a queued
  write between climb/playlist reads; unchanged restore is idempotent and conflicts
  preserve originals.
- Native runtime opens no IndexedDB library, retains native BLE/file injection, cleans
  up startup failures, and handles overlapping init/disposal. Browser/iOS paths keep
  their established behavior.
- Root lint/typecheck/tests/build, native-package lint/typecheck/tests/build, Android
  compile, existing packaged browser smoke and the isolated emulator preservation check.

## Risks

- Plugin transaction defaults can accidentally nest transactions: disable implicit
  transactions in adapter calls and own the explicit boundary; inspect pinned API.
- Failed rollback can poison queued operations: fail closed and preserve disk state.
- Native plugin and wrapper connection registries can race React StrictMode: exercise
  actual startup and sequential reopen, not just a fake happy-path database.
- A new app identity cannot inherit PWA storage: only explicit validated import can
  transfer a surviving library. Do not touch the real phone in the proof.
- Android catalog support is still a separate early proof; successful startup is not
  full dogfood parity or independent protection.

## Execution

One feature-owning implementation worker is authorized by implement-orchestrator.
Preferred GPT-5.6 Luna is unavailable in this session; use available GPT-6.1 Sol at
xhigh for the storage/transaction risk. Review weight is standard (project policy):
one independent review after integrated verification, then fix and verify material
findings without a repeated review loop. Host handles review, SDK and subsequent
capabilities. Worker must not delegate or use peeragent.


## Implementation notes

- Execution capability: one feature-owning Codex implementation worker, direct source
  reads and integrated implementation; no child fan-out or peer delegation. The
  serialized connection and strict complete-library contract determined the scope.
- Review weight: standard, from project policy and caller. The host owns the one
  independent Claude pass and PR/CI; this implementation stops at review.
- Runtime composition: `web/src/app/library.ts` owns browser library resources;
  `create-runtime.ts` accepts an injected `AppLibrary` without opening either browser
  database, closes once, and releases its library/catalog on construction failure.
  Shared draft/playlist constructors now live in their `record.ts` modules, keeping
  codecs authoritative and browser repository behavior intact.
- Native storage: `native-library.ts` implements both current repository ports and
  missing-only backup restore in one persistent SQLite file. Bound values, serialized
  operations, explicit revision/write/restore/snapshot transactions, checked schemas,
  strict row/key decoding, collection rules and canonical conflict handling preserve
  the domain. Commit must resolve before success. Failed begin, ambiguous commit or
  failed rollback poisons the connection; pending operations fail until reopening.
  Close rejects new work and drains admitted transactions before releasing the native
  lease. A failed native close prevents unsafe reconnect until app restart.
- Coherent capture: optional `LibraryBackupStore.readSnapshot` is used for one native
  export/review capture. Browser backup retains its bounded repeated-read fallback;
  restore continues to report separate climb/playlist commits accurately.
- Android composition: same package and stable app identity under `prototypes/ios`;
  pinned SQLite 8.1.1 and Capacitor Android/CLI 8.4.3. Android selects SQLite and the
  existing native BLE/lifecycle/file composition. iOS keeps IndexedDB. Neither
  Bluetooth initialization nor permission requests occur at library startup.
- Build/operations: committed generated Android project, API 36 / Build Tools 36.0.0
  / JDK 21 build, `sync:android`, `build:android`, compile CI lane, documented Gradle
  version-code override and an emulator-only synthetic preservation runner. Native
  assets are bundled without a remote URL or service worker. SDK paths, databases,
  signing material, APKs and proof artifacts remain outside Git. Removed generated
  example arithmetic/package-name tests; they establish no application behavior.
- Tests: real Node 22 SQLite covers lifecycle, metadata, revisions, collision retry,
  ordering, strict malformed/unsupported/mismatched records, atomic restore conflict
  rollback, failed writes, ambiguous commits, failed rollback/begin, coherent capture,
  persistent file reopen and pending-close behavior. Bridge/runtime tests cover
  explicit transaction flags, WAL/FULL verification, failure cleanup, overlapping
  lease initialization/disposal and no browser-storage fallback.
- Simplification: extracted only the shared validated constructors/filter rules;
  reused current repository ports/codecs and current shell. The opener uses the
  plugin's direct connection API with a serialized lease, avoiding another mutable
  JavaScript connection registry or an ORM.
- Discrepancy reconciled: actual Android SQLCipher rejects a returning
  `PRAGMA journal_mode = WAL` through `execute`, despite the plugin API's general
  PRAGMA guidance. Use `query` for that assignment and verify the resulting mode;
  an adapter regression asserts returning journal PRAGMAs never use `execute`.
- Adjacent issues: Android destination delivery/cancellation and platform-specific
  backup-dialog copy remain owned by the existing portable-files feature. No new
  unrelated product bug was silently fixed. The first proof runner's immediate
  Back press raced native chooser presentation; corrected the harness to wait for
  `ChooserActivity` and a newly timestamped export file. Synthetic records were
  retained and retries validated prior restore evidence and the exact edit.

## Integrated verification

- Root `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`: passed;
  96 test files / 806 tests. Existing React act diagnostics and bundle-size advisories
  did not fail checks.
- Native package (Node 22.23.3) `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build` and `npm run sync:android`: passed; 5 test files / 73 tests.
  SQLite's Node experimental notice is expected for this real-engine test lane.
- Existing `npm -w web run test:ios-prototype`: passed, one packaged browser smoke.
- Android Gradle `assembleDebug`: passed with JDK 21 / Android API 36; repeated
  version-code builds produced same-signature synthetic upgrade APKs. Verified the
  merged Bluetooth/scan/connect and legacy location permissions from the pinned
  BLE plugin. The compile lane is added to CI; remote PR CI remains host-owned.
- Existing iOS `npm run sync` and generic iOS Simulator `xcodebuild` with Xcode 27 /
  iOS 27 SDK: passed after SQLite was added to the shared SPM package graph. The
  resolved native dependencies are committed. No physical-device operation occurred.
- Actual Android 36 arm64 emulator: the fixture was restored through the app's
  backup file input, a synthetic finished climb's name was edited through the
  editor and autosaved, then the process was force-stopped/relaunched and updated
  with the same application ID/signing identity. Version 1→2 ran first; the corrected
  runner completed verified 2→3 and final-source 3→4 upgrades. The final-source run
  used airplane mode during startup and preservation, then restored its prior state.
- Each complete native JSON export was decoded by the production backup codec and
  compared canonically: all four climb records and both playlist records, original
  IDs/creation dates, status/Trash, assignments, effect recipe, metadata and every
  ordered shared/missing-reference membership. The only allowed changes were the
  named finished climb's intentional name, incremented revision and update timestamp.
  Relaunch and upgrade exports matched the edited snapshot exactly. Native WAL and
  FULL synchronization were queried through the actual bridge; the persistent
  database file existed and `indexedDB.databases()` reported no library databases.
  Bundled startup had no service-worker registration or manifest injection.
- Local evidence: `/tmp/cruxcontrol-android-native-proof/evidence/` contains the
  complete restore/edit/relaunch/upgrade JSON files, screenshots and `result.json`;
  build output is outside Git alongside it. The runner records when it resumes a
  previously validated edit instead of changing existing synthetic records again.
- Evidence boundary: native file creation/capture was inspected before dismissing
  the Android chooser; successful external destination delivery belongs to the
  portable-files feature. This feature's synthetic native-storage proof does not
  establish automatic account protection, clean-client recovery, private signing-key
  preservation, physical-board BLE or actual-phone storage-pressure durability.
  Real authoring remains gated by the epic's required independent preservation work.

## PR verification follow-up

Draft [PR #32](https://github.com/andromedus1/cruxcontrol/pull/32) carries this
foundation. The first CI run passed the iOS adapter/build/browser lane. Android
setup failed before compilation because setup-android v3 defaults to the removed
`tools` package; explicitly request `platform-tools` while retaining the separate
API/build-tools installation. Web tests exposed an existing synchronous query for
the list form during its legitimate asynchronous loading state; wait for the form
before editing it. These are CI configuration and test-harness repairs, with no
application behavior change. Repeat CI after the repairs; independent review is
still in progress.

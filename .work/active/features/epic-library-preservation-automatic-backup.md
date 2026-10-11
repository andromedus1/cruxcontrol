---
id: epic-library-preservation-automatic-backup
kind: feature
stage: implementing
tags: [data, security, ui]
research_refs: [independent-library-preservation]
parent: epic-library-preservation
depends_on: [epic-library-preservation-native-library, epic-library-preservation-private-vault]
release_binding: null
gate_origin: null
created: 2026-10-10
updated: 2026-10-11
---

# Automatically protect saved native library changes

## Brief

Capture a coherent committed library revision, persist pending work and automatically upload complete immutable snapshots while the app can execute and reach the service. Verify authenticated readback against the exact capture before acknowledging protection. Retry safely across interruption and app relaunch; newer edits must stay pending rather than borrowing an older receipt.

Own the compact protection status and Manage hub from the prepared flow, including offline, expired session, quota, capture failure and failed local-save states. Recovered OS/app state cannot silently re-establish authority to upload empty or stale snapshots. Retain prior good copies; the first release pauses at capacity instead of silently pruning. This is recovery backup, not live multi-device synchronization or group publication.

This feature also owns the clean-install online recovery journey: discover retained versions through the private-vault account, select/review a copy, preserve IDs and exact content on restore, report conflicts/partial outcomes, and compare a complete canonical snapshot after relaunch. A restored or empty installation cannot upload until recovery/discovery admission is resolved. Keep the source backup intact.

## Epic context

- Parent: `epic-library-preservation` — Android dogfood with parity, independent backup and the older Kilter catalog.
- Inherit the parent’s settled no-interim-PWA, offline-use, dual-backup and account-recovery decisions.
- User target: a private dogfood build in the next few days, contingent on demonstrated platform and recovery behavior rather than an unverified date promise.

## Grounding

- [Preservation comparison](../../../.research/analysis/briefs/independent-library-preservation.md).
- [Specification](../../../docs/SPEC.md), especially private library preservation and current wall-session capabilities.
- [Architecture](../../../docs/ARCHITECTURE.md), especially runtime composition, native transport and independent preservation.
- [Existing native shell](../../../prototypes/ios/README.md); Android uses native SQLite library persistence; integrated online preservation remains this feature’s work.

## Mockups

- Inherit [library preservation](../../../.mockups/flows/library-preservation/index.html) where backup surfaces apply.
- Existing editor, library, playlist and Kilter browser reuse their current UI; mock only genuinely new structure.
- Andrew’s 2026-10-10 instruction to proceed supplies authorization to continue this prepared direction; no new UI redesign milestone.

## Application backup design (2026-10-11)

The settled product direction is native offline authoring, automatic private
account-protected backups while the app can execute, owner-controlled portable
files, and demonstrated recovery before real dogfooding. These are release gates;
a later outage or sign-out must not stop ordinary local wall use. The approved
preservation flow supplies the compact status, Manage hub, connect, history,
review and restored surfaces. No new provider, account policy or UI comparison
is needed. The private-vault feature owns Firebase/native transport and bounded
immutable storage. This feature consumes its exact `PrivateVault` port.

### Architectural choice

Choose a native SQLite revision/control record and an application coordinator,
composed through the existing runtime. The database transaction owns whether an
edit committed; the coordinator owns network work and never infers a commit from
a React event. One immutable complete snapshot covers climbs, drafts, Trash,
playlists, membership order, grades, metadata and effects.

A React-only effect queue would lose pending identity on process death and cannot
bind receipts to committed revisions. A new native background-worker/sync engine
would add lifecycle and duplicated domain logic beyond the foreground backup
promise. Neither is needed for this release. Browser/PWA storage and online
behavior remain outside this feature; shared ports use native adapters on Android.

### Unit 1 — durable revisions and indivisible recovery

**Files:** `web/src/automatic-backup/{types,state}.ts`,
`web/src/app/library.ts`, `prototypes/ios/src/{native-library,open-native-library}.ts`,
`web/src/library-backup/{types,service}.ts`, and their corresponding tests.

This is the trickiest unit. There must be no point where an incomplete restore or
an older upload receipt can be treated as protection of the current library.
Add an optional `preservation` port to `AppLibrary`; native supplies it. Exact
contracts (import the existing snapshot/restore/vault types):

```typescript
interface VaultBinding {
  readonly uid: string;
  readonly installationId: string;
  readonly scope: 'library-v1' | `acceptance-v1/r00${1 | 2 | 3 | 4}`;
}
interface PendingBackup {
  readonly id: string;
  readonly revision: number;
  readonly slot: string;
  readonly staged: StagedBackup;
  readonly capturedAt: string;
}
interface ProtectedRevision {
  readonly revision: number;
  readonly snapshot: VaultSnapshot;
  readonly verifiedAt: string;
}
interface BackupControl {
  readonly binding: VaultBinding | null;
  readonly admission: 'discovery' | 'active';
  readonly history: readonly VaultSnapshot[];
  readonly pending: PendingBackup | null;
  readonly protected: ProtectedRevision | null;
}
interface RecoveryVerification {
  readonly revision: number;
  readonly sha256: string;
}
interface PreservationRecord {
  readonly revision: number;
  readonly version: number;
  readonly control: BackupControl;
  readonly recovery: RecoveryVerification | null;
}
interface LibraryPreservation {
  read(): Promise<PreservationRecord>;
  capture(): Promise<Readonly<{ revision: number; snapshot: LibrarySnapshot }>>;
  compareAndSet(version: number, control: BackupControl): Promise<boolean>;
  verifyRecovery(): Promise<void>;
  subscribe(listener: (event: 'committed' | 'write-failed') => void): () => void;
}
```

Use a preserving SQLite schema v1 → v2 migration in the existing serialized
connection. Add one validated singleton metadata table with aggregate `revision`,
control CAS `version`, small JSON `control`, and nullable recovery verification
fields; no library rows or authored fields are rewritten. Read complete tables
in bounded `ORDER BY id` pages within the same capture transaction: the SQLite
plugin otherwise returns one potentially huge Java JSArray. Use pages of at most
32 rows, returning small payloads only when their UTF-8 size is at most 8 KiB
(so one page is at most 256 KiB payload plus bounded IDs/metadata). Return length
and ID for larger rows and read their payload as 32 KiB BLOB byte ranges encoded
with SQL `hex(substr(CAST(payload AS BLOB), ?, ?))`; decode bytes with one fatal
streaming TextDecoder. Reuse bounded record reads for `get`, review and restore.
A single record cannot be silently truncated or skipped. On insert/update,
split serialized record text at UTF-16 boundaries that preserve surrogate pairs
into at most 16 Ki code units per call; append chunks to the row inside the same
mutation transaction. This avoids a large individual record exhausting Android's
CursorWindow or JSON bridge. Revision advances once after the complete mutation;
an intermediate chunk is never committed or visible to capture. Small rows retain
a single ordinary parameterized insert/update; tables remain existing TEXT JSON. Empty stores initialize
v2 in a transaction. Verify exact known v1/v2 table/column shapes; reject foreign,
partial or newer schemas rather than repairing destructively. Existing native
SQLite plugin 8.1.1 `Database.open` only performs its own upgrade when explicit
upgrade statements exist; keep migrations owned by `createNativeLibrary`, with
no plugin upgrade object. Assert the resulting `user_version` after native reopen.

Increment the aggregate revision in the *same transaction* as every successful
content-changing mutation, including Trash, permanent deletion, playlist order and
restore; never for reads, failed rollback, unchanged restore, or control updates.
Revision and CAS version are nonnegative safe integers; fail before overflow.
Failed/ambiguous commits retain the existing poisoned-connection behavior. Emit
commit events after commit only, and bounded write-failure events for mutation
failures. A missed event cannot lose work because launch/resume reads the durable
revision. `capture` reads both tables and revision in one transaction and refuses
while recovery verification is pending. CAS validates complete control state,
binding, bounded history, pending revision and receipt metadata before writing;
it cannot clear the separate recovery barrier.

Extend `LibraryBackupStore` with optional
`restoreMissingSnapshot(snapshot: LibrarySnapshot): Promise<Readonly<{ drafts:
RestoreBatchResult; playlists: RestoreBatchResult }>>`. `LibraryBackupService`
uses it when present; existing browser per-store restore remains as-is. Native
restore preflights and writes both tables in **one SQLite transaction**, preserves
unchanged records exactly, and rejects conflicts without writes. Compute the
canonical SHA-256 of the expected merged library (existing extras plus imported
missing records) and commit a recovery verification barrier with the resulting
revision. No ordinary writes or backup capture are admitted while that barrier
exists. A second coherent read verifies the actual complete canonical library
and transactionally clears only that barrier. Restart retries this verification;
never clear it because a timer elapsed or because the network is available.
Existing records absent from the selected copy stay intact, so exact verification
must compare the merged result, not falsely claim equality to the source alone.

A verification failure after a committed atomic restore needs an explicit typed
`LibraryRestoreVerificationError` carrying the committed per-table counts.
Extend the service failure union with `phase: 'verification'` and those counts;
render it honestly in the existing portable dialog as records saved but recovery
verification incomplete. An atomic failure before commit reports no additions.
Do not silently reuse the old 'playlists failed, no playlists added' wording.
Browsing/export remain available under a verification hold; ordinary mutations
fail visibly until verification succeeds. No repair/reset/delete fallback.

**Acceptance:** real SQLite reopen preserves a populated v1 library exactly;
every mutation surface advances the aggregate revision correctly; rollback and
ambiguous-commit tests stay honest; coherent capture under concurrent edits;
CAS races; atomic whole-library restore rollback; crash after restore commit
before verification; failed verification cannot upload or admit authoring; exact
merged canonical comparison on reopen, including Trash/order/effects and extras.

### Unit 2 — automatic capture, receipt and admission coordinator

**Files:** `web/src/automatic-backup/{coordinator,status}.ts` and tests.

```typescript
interface BackupStatus {
  readonly phase: 'checking' | 'not-configured' | 'signed-out' | 'discovery'
    | 'recovery-required' | 'pending' | 'uploading' | 'protected' | 'offline'
    | 'capacity' | 'error' | 'verifying-recovery';
  readonly account: VaultAccount | null;
  readonly revision: number | null;
  readonly protectedRevision: ProtectedRevision | null;
  readonly localSaveFailed: boolean;
  readonly error: string | null; // bounded user copy, not provider exceptions
}
interface OnlineBackupReview {
  readonly snapshot: VaultSnapshot;
  readonly backup: DecodedLibraryBackup;
  readonly review: BackupReview;
}
interface AutomaticBackup {
  getSnapshot(): BackupStatus;
  subscribe(listener: () => void): () => void;
  start(): void;
  setForeground(active: boolean): void;
  retry(): Promise<void>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  history(): Promise<VaultListing>;
  review(snapshot: VaultSnapshot): Promise<OnlineBackupReview>;
  restore(review: OnlineBackupReview): Promise<LibraryRestoreOutcome>;
  useLocalLibrary(): Promise<void>;
  close(): void;
}
```

`createAutomaticBackup({ preservation, backupService, vault, now, ...clock })`
returns the observable port. Inject timers/online state for deterministic tests;
production uses the platform clock and online/resume hints. One serial coordinator
operation runs at a time. No user action, auth completion, timer, retry or stale
promise may bypass close/session generations. Sign-out invalidates completions
immediately, even before the SDK completes; it retains cloud copies and local
library. Finalization only acknowledges the exact durable pending ID/binding.

On startup, verify a pending local recovery barrier first. Read native status and
stored control; compare native **installation ID, account UID and pool**. A fresh
installation or restored/copy of SQL state needs authenticated discovery before
upload, regardless of copied 'active' flags. Signing back into an existing binding
also performs discovery. A new empty library with retained cloud history displays
recovery-required and cannot upload an empty copy automatically. A nonempty local
library with unknown history also requires explicit review/admission. The user
can restore a reviewed copy or explicitly choose 'Use this phone’s library', with
counts and the statement that existing backup copies will be retained. This is
an intentional admission choice, never an implicit background fallback.

Before each capture/retry, list and validate remote history. Compare identity of
known snapshots (slot, generation, digest, bytes) with durable history; any missing,
changed or unknown copy, other than the exact unresolved pending upload, suspends
admission for discovery. Concurrent writers do not automatically interleave: a
conditional slot conflict causes discovery, not a loop picking another slot.
This product supplies backup/recovery, not reconciliation between active devices.

Capture a committed revision, encode with the shared portable codec, then stage
through the native vault. Commit the pending ID/revision/slot/staged metadata by
CAS **before** upload. Keep only small metadata in SQL, never a 25 MiB bridge
string in a control-row write. A crash after staging but before CAS leaves an
orphan; `retainStaged` receives durable pending IDs at safe startup/idle points.
Do not run cleanup alongside staging. Once pending is durable, do not replace it
because a newer edit exists: resolve that exact upload outcome first.

Upload the pending file. A verified receipt must match its slot, bytes and digest;
then persist protected revision R and updated known history by CAS, clearing
pending. Only after that succeeds discard staged bytes. Revision R+1 remains
pending; an R receipt cannot claim the newer edit protected. Lost response retries
the same slot/bytes, yielding the same immutable receipt. If a stage file is
missing, first reconcile authenticated history and download an exact matching
pending snapshot before acknowledging R. If no such snapshot exists, abandon
that unuploaded pending record explicitly and capture the current coherent library;
never infer protection from absence, timestamps or the latest slot. Different
bytes at that slot require discovery. An inability to establish the outcome stays
visible and preserves metadata. Admission changes invalidate old-binding pending
work without deleting those cloud snapshots; native cleanup is limited to current
owner/pool and authoritative pending references.

While active, coalesce committed changes for 30 seconds with a 60-second maximum
wait. Initial admitted setup, explicit Retry, resume and restored connectivity
attempt promptly. Retain durable pending work over offline periods/process death;
retry transient failures with a bounded 5/15/60-second foreground backoff, then on
resume/connectivity/manual Retry. Pause, close, capacity and sign-out cancel timers,
not authored data. Never auto-upload a completely empty capture; retain prior
verified history and show that the current library has no records. An empty
installation with cloud copies always requires discovery, even after a local
permanent deletion or a missing/corrupt control record. A network hint never proves a request succeeded. Capacity at
512 retained versions visibly pauses new captures/uploads; show remaining version
capacity in Manage. At 20–60 copies per active setting session this is roughly
10–25 sessions, not indefinite daily retention. Keep the short capture interval
for the first dogfood protection target; a later explicit bounded capacity or
retention change must precede a promise of indefinite use.
 retain earlier copies
and expose portable export. Do not promise background execution after Android
suspends/kills the app or unlimited snapshot retention.

`protected` means current saved revision equals the verified receipt revision and
no recovery/identity/admission error exists. Display 'All saved changes backed up'
with last verification time, never 'everything is safe'. Local-save failure takes
precedence in presentation; a subsequent successful save or reopen clears the
session notice, while existing editor failure/retry behavior remains authoritative.
Sign-out/offline/error keep the last verified-copy detail without suggesting newer
edits are protected. No auth/backup network error makes ordinary app startup fatal.

**Acceptance:** injected clock and deferred transport tests prove offline create
→ reconnect, process restart at each durable boundary, R receipt vs R+1 edit,
lost response, absent/corrupt stage, failed CAS/SQL writes, account switch and same
UID sign-out/sign-in late completion, installation/pool mismatch, empty fresh
recovery, unknown/missing cloud versions, full capacity and closed lifecycle.
Use real native SQLite tests for the persistence invariants; coordinator fakes
exercise races with meaningful contract assertions rather than mirroring code.

### Unit 3 — account, status and integrated recovery surfaces

**Files:** `web/src/automatic-backup/{BackupStatusLine,BackupManageDialog}.tsx`
and CSS/tests, `web/src/app/{library,create-runtime,CruxControlWorkspace}.ts(x)`,
`prototypes/ios/src/runtime.ts` and lifecycle tests. Reuse existing primitives and
prepared flow, and preserve the current portable backup dialog as the file entry.

Add optional `automaticBackup` to runtime and a native-only factory dependency
created after the library opens. Start the coordinator after composition without
awaiting network. Android binds foreground/resume and online hints; cleanup closes
the coordinator before library shutdown and removes listeners. iOS/PWA keep their
current paths. StrictMode open/close races cannot leak a coordinator or connection.

Workspace replaces the Android backup entry with the prepared compact status +
Manage button. Manage shows account/connect/sign-out, latest verified copy, pending
or paused explanation, Retry, retained history and portable file actions. History
lists server creation time and size; download and strict validation supply content
counts/date before review. Review uses the existing portable conflict/count logic,
then invokes the same atomic library restore. Restore cancels debounce and waits
for admitted in-flight transfer settlement under the coordinator lock. Record every
validated committed cloud copy in known history even if a later local revision
prevents acknowledging it; CAS retry must preserve that evidence. A pending upload
whose outcome is unknown must be resolved before a restore changes admission. The complete review object is
memory-only and bound to selected account/session; stale reviews cannot restore
after sign-out/account change. Existing local same-ID conflicts block all writes;
no overwrite choice. Success refreshes browser/playlists and verifies the complete
library before enabling backup admission. Refresh failure retries refresh only,
not import again. If the verified restored canonical library exactly equals the
selected online source, bind the current aggregate revision to that retained
source receipt and add it to known history, without uploading a duplicate merely
because a fresh export time differs. For a merged result containing local extras,
keep the new revision pending and capture after explicit admission. A selected older copy never deletes newer retained versions.

Reuse dialog focus return, Escape/Android Back, pending-operation guards and
Workspace update admission. Restore/write verification blocks dismissal/update
while committing; ordinary queued cloud work does not trap offline exit/update.
Do not offer recovery while unsaved editor work, pending writes or connected-board
operation would be displaced; explain the existing admission reason. User account
cancellation is a recoverable state. Errors never display raw SDK/SQL exceptions.

**Acceptance:** RTL covers statuses, account cancellation/expiry, quota, stale
account review, conflicts/no-op, recovery refresh retry, focus/back/escape and
local editing/BLE availability during outage. Browser integration uses a mocked
vault over real shared services; native acceptance below proves actual transport.
No PWA sign-in requirement or route/navigation regression.

### Unit 4 — integrated native recovery acceptance

Use the isolated `acceptance-v1/r00N` pools and synthetic fixtures only. Update emulators
only after preserving and validating their whole libraries outside Git. Prove a
saved edit/playlist order change automatically produces a verified remote copy;
offline edit survives process death and uploads after foreground connectivity;
newer edits do not borrow an older receipt; pending staging survives relaunch.

A separately installed empty emulator signs into the same account, discovers the
copy and restores it entirely through app UI. No operator-carried download, ADB
import or developer-console restore counts as this gate. Compare full canonical
records before/after relaunch, including drafts, Trash, grades, ordered playlist
membership, unavailable references and every effect recipe. Verify local database
and cloud source remain unchanged on conflict/cancel. Test large payload transport
and maximum practical structured fixture memory in the real WebView; a whitespace-
padded 25 MiB proof alone does not establish record-count scalability.

Run authoritative typecheck/lint/unit/build and relevant Playwright checks, plus
configured signed Android and non-debuggable release-isolation checks. Standard
feature review is one independent Claude pass, adjudicated fixes and verification.
Phone/Fullride acceptance remains in android-parity and requires physical hardware;
no real authoring before these preservation gates and device parity checks pass.

### Risks, ownership and execution

The least certain boundary is maximum structured-library memory in the WebView;
exercise it with a real installation before claiming the codec's upper record
limits are practical. If it fails, reduce admitted limits explicitly or stream the
domain parse; do not silently exclude records. Crash-consistent recovery and staged
file/control coordination have no destructive fallback. A failure leaves a visible
hold and retained source. The fixed version pool will eventually fill; that is a
visible stop requiring a future deliberate retention decision, not permission to
prune good backups.

One feature owner preserves cross-store/coordinator/UI coherence. Four sequential
checkpoint stories (durable-state, coordinator, surfaces, acceptance) have distinct
test surfaces and resume value. Native vault must be verified at review/done before
implementation starts; design may proceed while that dependency is implementing.
Worker capability/review weight follows project conventions and the implementation
orchestrator. Root owns live acceptance and device preservation. No secrets, personal
library contents or device identifiers enter Git.

### Advisory integration

The private-vault design's 2026-10-11 Claude advisory also inspected this feature's
capture/restore boundary. Accepted paged bridge reads, exact structured-size memory
acceptance, pending target-slot/history separation, atomic verification hold,
remote-history admission and same-UID session-epoch invalidation. Known-history
comparison is the primary stale-writer safeguard; non-restorable native installation
identity is an additional mismatch signal. A newly generated installation ID may
never reauthorize copied control state. Empty captures do not automatically upload.
The short scheduling interval and explicit capacity pause are deliberate first-
dogfood tradeoffs; no promise relies on inactive/background callbacks.

### Implementation readiness

Private vault reached verified review at `fd261f8` after all three checkpoints
and integrated native/cloud acceptance passed. The implementation dependency is
satisfied while its standard Claude review runs. Four sequential stories expose
durable-state → coordinator → surfaces → integrated-acceptance order.

Dispatch: one fresh feature-owning GPT-6 Luna worker at xhigh (the workflow's
older default GPT-5.6 Luna is unavailable) implements the first three checkpoints
sequentially, preserving store/coordinator/UI context. Root owns synthetic live
acceptance, packaging, private credentials and final review. Worker owns feature
production code/tests and checkpoint records; root owns foundation documentation
coordination and any disjoint vault-review fixes. No overlapping edits, deployment,
physical device operations, or pushes by the worker. Existing approved preservation
mocks are the UI baseline. Standard feature review follows integrated acceptance.

## Verified implementation ready for review

All five child checkpoints are done: native revision/atomic recovery state,
automatic coordinator, account/status/Manage surfaces, the bounded mobile layout
correction, and integrated acceptance. Primary implementation commits are
`76bd505`, `4605838`, `6d0ac64` and `de8421b`. The acceptance story owns exact
tool evidence: automatic edits/order changes, offline restart/reconnect, pending
staging process death, separate empty-install in-app recovery, conflict/cancel
preservation, and exact 10,000-climb/1,000-list/100,000-membership cloud UI restore
after relaunch. Local unit/typecheck/lint, relevant browser checks and signed
packaging pass. Real `library-v1` and physical hardware remain untouched.

Standard review is one independent Claude pass through the installed peeragent
wrapper, followed by root adjudication and verification of accepted material
fixes without a second pass. PR CI must also pass before feature closure.

## Review (2026-10-11)

**Verdict:** Request changes; standard weight, one completed independent Claude
pass via peeragent job `20261011T172817Z-7aa47a5e` at verified implementation
checkpoint `88014e4`. Reviewer performed read-only code/contract inspection and
used the committed acceptance evidence; it did not independently rerun devices.

**Blockers:** `epic-library-preservation-automatic-backup-review-fixes` owns
offline local verification, late sign-out publication, refreshed pending history,
empty-library discovery, actionable wrong-account handling, and identity/CAS
regressions. Root confirms the code paths. Findings 2–5 are bounded but merit
correction now because they affect truthful backup/recovery admission and status.

**Important:** Remaining capture cost and no-op recovery adoption/save-failure
polish are recorded separately in backlog. Root will additionally exercise actual
maximum structured automatic upload; the earlier large UI restore bound the
existing receipt and did not itself run automatic capture/upload at that size.

**Nits/rejected:** Future state-schema changes requiring migration are a normal
versioning obligation, not evidence of a present unsupported format or bug. No
speculative compatibility layer is warranted. The live offline/reconnect proof
already covers that integration scenario, while the interrupted local verification
case needs the newly specified regression. The reviewer found no demonstrated
authored-data loss or incorrect acknowledgement of a newer committed revision.

Fix/verify/CI closes this standard review administratively; do not request another
independent pass. The previously passing emulator recovery evidence remains valid
for its measured paths, and real authoring stays gated on physical parity.

### Native reproduction of interrupted recovery

The root reproduced finding 1 on signed proof 26 using normal Manage recovery of
the retained 10,000-climb/1,000-list/100,000-membership synthetic snapshot. The
app was stopped after observing its persisted verification barrier, then reopened
offline. A complete bounded read proves all restored content committed exactly;
the recovery hold remains despite matching local content. No database writes or
injected restore implementation fabricated this state. The emulator remains
offline for a preserving fixed-build update. Whole-library evidence is retained
outside Git under `.private-firebase/automatic-app-acceptance/offline-hold26/`.

Committed runners `smoke-android-recovery-hold.mjs` and
`smoke-android-offline-recovery-resume.mjs` separate the pre-fix reproduction from
the required fixed-build continuation. The latter must clear the hold offline,
allow an ordinary grade save, protect the full structured library after network
returns, automatically protect another edit, and preserve exact content on
relaunch. Preparing that runner is not evidence that the continuation has passed.

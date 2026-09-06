---
id: epic-build-effects-hardening-library-backup
kind: feature
stage: implementing
tags: [ui, data]
parent: epic-build-effects-hardening
depends_on: [epic-build-effects-hardening-curious-bee]
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
---

# Whole-library backup and recovery

## Brief

Export and restore a bounded, versioned file containing every local climb/draft including Trash and climbs outside playlists, all playlists, shared membership references, stable IDs, lifecycle metadata and saved effect recipes. Keep existing IndexedDB databases and ordinary playlist sharing semantics. Validate the whole file before writes; offer a reviewable non-destructive recovery strategy for ID conflicts and partial failures rather than wiping the library or silently duplicating shared climbs. Recovery must be repeatable/idempotent and report failures honestly. Provide UI mockup before production, download/upload UI and proportionate codec/repository/browser tests. No account/cloud backend or origin migration.

## Inherited direction

Parent epic owns priorities and accepted decisions. Preserve authored content, IDs,
memberships and old saved recipes. Resolve routine design choices under the authorized
autopilot scope. No controller upgrade or increased hardware capacity claim.

## Grounding

Read docs/SPEC.md, docs/ARCHITECTURE.md and docs/PRINCIPLES.md plus current code and
relevant completed route-creation/playlists features. Research navigator has no brief
blocking this epic. Existing protocol/board-control briefs and measured capacity feature
remain constraints; they are not evidence of unmeasured hardware performance.

## Mockups

- Recovery flow: `.mockups/flows/library-backup/index.html`.
- Chosen under authorized autopilot: compact library dialog, explicit review before adding
  records, conflict list, complete and partial outcomes. Inherits the existing palette,
  typography and components; no new aesthetic decision needed.
- The five standalone pages are states of one dialog, not five new app routes. The
  index exposes error branches for inspection; production only follows actual results.

## Simplification opportunity

Extend existing pure frame/repository/UI boundaries; avoid new frameworks or replacement
storage. Share validated logic only where repeated consumers and contracts justify it.


## Prepared design status

Design prepared during the animation implementation wave. Keep `stage: drafting` until
`epic-build-effects-hardening-curious-bee` satisfies the dependency; no backup production
changes have been made by this design task. One implementation owner is sufficient:
codec, transaction adapter, service and dialog form one recovery contract. No child
stories yet; the units below are useful implementation checkpoints without extra agents.

## Grounding and design decisions

Read the navigator, parent epic, foundation documents, current draft and playlist
codecs/repositories, runtime and workspace. No blocking research brief or local patterns
skill exists for this capability. Design uses the feature-design and flows workflow;
routine choices are resolved under the user's scoped autopilot authorization. Independent
implementation review remains required; no additional design agent was dispatched.

- Existing authorities remain `cruxcontrol-local-drafts` and
  `cruxcontrol-local-playlists`. Their transaction scopes cannot be combined. Do not
  migrate schemas, rewrite existing records, allocate new IDs or use playlist-sharing
  import (which intentionally creates copies).
- Export all records, across all installations: Draft, Finished, every Trash entry,
  playlist metadata and ordered references. Preserve IDs, revisions, created/updated/
  trashed timestamps, assignments, metadata and complete saved effect recipes, including
  legacy recipe snapshots and the new bee. Export normalizes supported historical record
  schemas through existing codecs in memory only; it does not upgrade saved behavior.
- Canonical equality means equality of existing `encodeStoredDraft(decodeStoredDraft(x))`
  or playlist equivalent, including revisions/timestamps and ordered content. Compare
  deterministic encoded records, not raw object key order or a lossy display projection.
- Restore adds missing IDs and skips identical IDs. Any differing record with the same
  ID blocks the entire preflight. No overwrite, choose-newer, silent skip of a conflict,
  fresh-ID duplication, rollback deletion or library replacement in this feature. User
  can retain the file, export the current library and use a separate browser/profile to
  recover a divergent snapshot without destroying the current version.
- Preserve dangling local references and unavailable provider references exactly. These
  are already valid playlist states after a purge; count and explain them during review.
  Do not require every referenced local ID to exist in the backup or current library,
  synthesize missing climbs, silently drop references or bind them to different IDs.
- Current workspace refresh calls `purgeExpiredTrash()` before reading. Remove automatic
  deletion and its dead repository method/retention constant. Trash remains until the
  user chooses existing, confirmed **Delete forever**. Remove the 30-day promise from
  UI and SPEC. Do not reset restored `trashedAt` or create a hidden preservation flag.
  This is the smallest coherent protection behavior, with no new bulk-delete UI.
- Backup captures saved library contents. Launch only from the library workspace, after
  leaving the editor through its existing save/navigation guard; it cannot capture
  unsaved in-memory edits. Keep export and recovery mutually exclusive in the dialog.
- Downloads and imports remain local. No cloud/account backend, upload, persistence
  permission prompt or claim of browser-eviction protection; the downloaded file is the
  user's independent copy. Ordinary playlist sharing keeps its existing behavior.

## Architectural choice

1. **Replace both libraries from one file:** simple-looking UI but destructive, breaks
   concurrent edits, and cannot commit atomically across the current databases. Rejected.
2. **Reuse portable playlist imports:** uses working code but creates fresh IDs, duplicates
   shared climbs, loses orphan/Trash/lifecycle fidelity and is not idempotent. Rejected.
3. **Validated missing-only recovery through a dedicated backup port:** selected. Reuse
   codecs and existing database handles, add no storage system, preflight all data, then
   use a transaction per store to reject conflicts and add only absent records. Expose
   partial completion and safe retry, with no compensating deletions.

A small `LibraryBackupStore` port avoids expanding ordinary draft/playlist CRUD
interfaces or forcing unrelated consumers to implement recovery methods. Production
runtime always constructs the concrete adapter with its already-open database handles;
optional UI injection exists only so partial runtime/test compositions can omit this
capability rather than pretending to implement it.

## Implementation Units

### Unit 1: Transaction-safe recovery boundary — trickiest unit

**Files:** `web/src/library-backup/types.ts`,
`web/src/library-backup/indexeddb-store.ts`

```typescript
import type { LocalClimbDraft, LocalDraftId } from '../drafts/types';
import type { LocalPlaylist, PlaylistId } from '../playlists/types';

export interface LibrarySnapshot {
  readonly drafts: readonly LocalClimbDraft[];
  readonly playlists: readonly LocalPlaylist[];
}
export interface RestoreBatchResult {
  readonly added: number;
  readonly unchanged: number;
}
export interface LibraryBackupStore {
  readDrafts(): Promise<readonly LocalClimbDraft[]>;
  readPlaylists(): Promise<readonly LocalPlaylist[]>;
  restoreMissingDrafts(records: readonly LocalClimbDraft[]): Promise<RestoreBatchResult>;
  restoreMissingPlaylists(records: readonly LocalPlaylist[]): Promise<RestoreBatchResult>;
}
export type BackupConflict =
  | Readonly<{ kind: 'climb'; id: LocalDraftId; name: string }>
  | Readonly<{ kind: 'playlist'; id: PlaylistId; name: string }>;
export class BackupConflictError extends Error {
  readonly conflicts: readonly BackupConflict[];
}
export class IndexedDbLibraryBackupStore implements LibraryBackupStore {
  constructor(drafts: IDBDatabase, playlists: IDBDatabase);
  // Implements the four methods above using existing store-name constants/codecs.
}
```

Read each object store directly in one readonly transaction, including every Trash row
and all installations. Do not read the current workspace list, default active-only
`drafts.list()`, or rely on an index that might omit malformed records. Decode every row;
fail export on corruption/unsupported schema instead of presenting a partial library as
complete. Resolve reads on transaction completion, reject on abort.

For each restore batch, validate all incoming records and duplicate IDs before opening
one `readwrite` transaction on that store. Schedule reads for every incoming ID; compare
all existing values canonically and queue `add()` for absent IDs inside request callbacks.
A conflict, decoding error, request failure or quota error aborts the entire transaction,
including any earlier queued adds. Never `put()` over an existing ID. Never await a file
read, timer, unrelated promise or other database transaction inside the IDB transaction.
Return counts only after `oncomplete`; preserve semantic errors on `onabort`. Use a small
private generic transaction helper for the two identical store algorithms if it reduces
duplication, not a public repository framework.

**Acceptance criteria:**

- [ ] Reading sees active and old Trash rows, including other installations; no writes.
- [ ] One batch commits all absent records with their exact IDs/revisions/timestamps,
      skips identical rows, and makes no changes on any differing-ID conflict.
- [ ] A second connection inserting/changing an ID after review cannot be overwritten:
      the transactional re-read rejects it or skips an identical concurrent insert.
- [ ] Error after one queued add aborts that whole store batch; errors never return
      successful counts. Existing records remain byte-for-byte untouched.

### Unit 2: Bounded versioned file and pure review

**Files:** `web/src/library-backup/codec.ts`, `web/src/library-backup/types.ts`

```typescript
import type { StoredDraftV4 } from '../drafts/types';
import type { StoredPlaylistV1 } from '../playlists/types';

export interface LibraryBackupV1 {
  readonly format: 'cruxcontrol-library-backup';
  readonly version: 1;
  readonly exportedAt: string;
  readonly drafts: readonly StoredDraftV4[];
  readonly playlists: readonly StoredPlaylistV1[];
}
export interface DecodedLibraryBackup extends LibrarySnapshot {
  readonly exportedAt: string;
}
export interface BackupReview {
  readonly add: Readonly<{ climbs: number; playlists: number }>;
  readonly unchanged: Readonly<{ climbs: number; playlists: number }>;
  readonly conflicts: readonly BackupConflict[];
  readonly trashClimbs: number;
  readonly unavailableLocalReferences: number;
}
export function encodeLibraryBackup(snapshot: LibrarySnapshot, exportedAt: Date): string;
export function decodeLibraryBackup(text: string): DecodedLibraryBackup;
export function reviewLibraryBackup(
  backup: DecodedLibraryBackup, current: LibrarySnapshot,
): BackupReview;
```

Use JSON with a clear format discriminator and independent backup version. Reuse stored
record codecs for fields; accept their supported historical schema versions on read and
emit current supported record encoding. Unsupported backup/record/recipe versions fail
with an actionable message before any writes; never reinterpret future recipes.

Bound file size at **25 MiB UTF-8**, **10,000 climbs**, **1,000 playlists**, and **100,000
playlist references total**. Check `File.size` before reading, then UTF-8 size in the pure
text boundary too. Check array types/counts before walking rows. Reject duplicate IDs
within each record kind even when duplicate contents match. Validate canonical timestamp,
format, version and every record; errors identify array index/record name where possible
without rendering file contents as HTML. Export applies the same bounds and fails
without offering a truncated download. These are explicit supported-file limits, not
statements that the underlying libraries have those limits.

Review considers current IDs plus incoming IDs to count unresolved local references.
Preserve ordering and shared references. Names are labels; IDs decide identity. Canonical
comparison of supported old records must not itself write/upgrade source records. Stable
ID sort of records permits order-independent comparison of library snapshots; preserve
playlist entry/assignment/effect order within records.

**Acceptance criteria:**

- [ ] Round-trip fixture includes an orphan climb, shared climb in two lists, old Trash,
      provider and dangling references, full metadata, both recipe versions and bee;
      all modeled data survives exactly after decoding.
- [ ] Oversized, malformed, duplicate-ID, unsupported-version and invalid nested records
      fail before any storage call; an invalid later row cannot partially import.
- [ ] Equal records with differing JSON key order are unchanged; changed notes, revision,
      timestamps, membership order or recipes conflict; equal names with distinct IDs add.
- [ ] Empty valid backup is allowed and reviews/restores as no-op; an empty export works.

### Unit 3: Coherent export and honest orchestration

**File:** `web/src/library-backup/service.ts`

```typescript
export type LibraryRestoreOutcome =
  | Readonly<{ status: 'complete'; drafts: RestoreBatchResult; playlists: RestoreBatchResult }>
  | Readonly<{ status: 'blocked'; review: BackupReview }>
  | Readonly<{
      status: 'failed'; phase: 'preflight' | 'drafts' | 'playlists';
      drafts: RestoreBatchResult | null; error: Error;
    }>;
export class LibraryBackupService {
  constructor(store: LibraryBackupStore, now?: () => Date);
  exportFile(): Promise<Readonly<{ filename: string; text: string }>>;
  review(backup: DecodedLibraryBackup): Promise<BackupReview>;
  restore(backup: DecodedLibraryBackup): Promise<LibraryRestoreOutcome>;
}
```

Export reads both store snapshots, then reads both again and compares canonical data. If
anything changed, repeat the pair once; if still unstable, fail with **Library changed
while preparing the backup. Finish editing in other tabs and retry.** No automatic
purges, upgrades or writes occur. The bounds apply before serialization/download too.
This is a bounded stability check, not a cross-database atomic snapshot guarantee;
independent external edits can still occur between store reads. Document that limitation
and ask users to finish other-tab edits in the backup help. Do not retrofit every writer
with a global lock for this feature.

Restore always runs fresh preflight over both stores when the user confirms. Any existing
conflict returns `blocked` and writes nothing. Then call `restoreMissingDrafts` followed
by `restoreMissingPlaylists` using **all** incoming records, not just the UI's earlier
missing set; this revalidates records classified identical as well as absent. Per-store
transactions remain authoritative if another tab changes data after preflight. Unrelated
current records are never touched. A later conflict/failed playlist batch reports the
committed draft result and zero newly committed playlists for that attempt; if drafts
added zero, say that accurately instead of claiming partial additions.

Retry re-runs full validation/preflight on the retained decoded file. Previously added
unchanged records become skips. If someone has since edited one, block with its conflict;
do not undo it. No rollback delete can race with someone editing a newly recovered climb.
If the page closes after drafts commit, the same file is sufficient to resume after
reopening; no durable journal or hidden recovery state is needed. A successful return is
a statement about completed transactions, not a lock against later external edits.

**Acceptance criteria:**

- [ ] Export's stability retry is bounded; observed concurrent changes fail or produce
      a stable pair. Source databases remain unchanged even on export failure.
- [ ] A conflict in either store at confirm-time preflight causes zero writes anywhere.
- [ ] Draft failure prevents playlist writes; playlist failure retains committed drafts
      and reports exact results, without cleanup deletes or claiming complete restore.
- [ ] Retrying partial/full imports skips unchanged records and completes missing work
      with stable IDs and shared memberships; a conflicting concurrent edit is retained.

### Unit 4: Library dialog, retention and composition

**Files:** `web/src/library-backup/LibraryBackupDialog.tsx`,
`web/src/library-backup/library-backup.css`, `web/src/app/CruxControlWorkspace.tsx`,
`web/src/app/create-runtime.ts`, `web/src/drafts/repository.ts`,
`web/src/drafts/indexeddb-repository.ts`

```typescript
export interface LibraryBackupDialogProps {
  readonly service: LibraryBackupService;
  readonly onClose: () => void;
  readonly onRestored: () => Promise<void>;
}
// CruxControlRuntime: readonly backup?: LibraryBackupService;
// Production createCruxControlRuntime always supplies backup using opened DB handles.
```

Add **Back up & restore** to library actions, available from My Climbs, Drafts, Trash and
Lists. Keep it outside the editor. One labeled dialog owns idle/read/review/restoring/
complete/blocked/failed states, with focus return and normal close/Escape while idle.
Disable close, file selection and duplicate submission during writes; communicate busy
state. Browser-level termination remains possible and is recovered by reusing the file.
Use a labeled local JSON file input. File picker cancellation leaves state unchanged;
invalid file displays an error with Choose another file. Ignore late file-read/review
results after selection changes/close; catch download and refresh errors explicitly.

Download via Blob/object URL and existing file-download idiom; revoke URLs after dispatch.
Say **Backup download started**, not that the OS saved or verified the file. Review names
file/date, total climbs including Trash, playlists, counts to add/unchanged/conflicting and
unavailable references. The primary button names exact counts to add; if all are already
present show **Everything in this backup is already here** and no write CTA. A conflict
list has names/kinds plus IDs in expandable detail and disables restore; explain current
records and the file remain intact. Large lists scroll, they do not grow beyond viewport.

On restore completion refresh the workspace. Distinguish storage completion from a later
refresh error: **Recovery saved. The library view could not refresh. Retry refresh.**
Do not invite another import to fix a view-only failure. Partial failures offer **Review
and retry** and retain the file in dialog memory; never overwrite the result by a failed
refresh. Retry always returns through a fresh review before another confirm.

Remove automatic `purgeExpiredTrash` and now-unused repository method/constant. Keep
`deletePermanently` and existing per-climb confirmation. UI copy becomes **Climbs stay in
Trash until you delete them forever.** Adapt old purge tests/mocks to the new explicit
retention contract, preserving CRUD/conflict test coverage.

**Acceptance criteria:**

- [ ] Keyboard/mobile users can export or pick/review/confirm a local file; cancel,
      invalid data, ID conflict, identical no-op, full success and partial retry are clear.
- [ ] Pending operations cannot double-submit; stale results cannot overwrite a later
      selected file; close/reopen returns to predictable idle state.
- [ ] Export reports actual saved records, never just the current collection/installation.
- [ ] An old restored Trash timestamp survives refresh, tab navigation and reload;
      Delete forever still requires explicit confirmation and uses the existing revision.
- [ ] A successful write followed by refresh failure remains a successful recovery with
      a distinct view-refresh retry, not a misleading failed import.

## Implementation order

1. Unit 1 plus codec boundaries and meaningful transaction tests: prove no overwrite and
   atomic per-store abort before connecting UI.
2. Unit 2 review/format and Unit 3 orchestration; exercise partial failure/retry.
3. Unit 4 dialog/retention/composition against the committed flow, then browser contract.
4. Update README, SPEC and ARCHITECTURE current claims; independent feature review and CI.

## Testing

- `web/src/library-backup/codec.test.ts`: one rich preservation fixture plus malformed,
  duplicate, future-version, bounds and equality cases. Reuse existing draft/playlist
  fixture factories and actual effect constructors rather than duplicating schemas.
- `web/src/library-backup/indexeddb-store.test.ts`: `fake-indexeddb` with both real
  repositories/openers; add-only atomic batches, late conflicts through a second DB
  connection, old Trash/raw v1-v4 records, closed DB and injected transaction failure.
  Observe raw storage before/after; logical equality alone cannot prove no rewrite.
- `web/src/library-backup/service.test.ts`: injected port failures between commits,
  instability, repeat import and changed-record retry. Assert absent rollback calls and
  exact committed counts. Service test fixtures do not manufacture atomicity across DBs.
- `web/src/library-backup/LibraryBackupDialog.test.tsx`: user-visible review, file bounds,
  delayed reads, no-op/conflict/partial/success, duplicate-submit guard and refresh failure.
- `web/src/app/CruxControlWorkspace.test.tsx`: no automatic deletion on refresh; old Trash
  remains recoverable. Update outdated 30-day and purge-error assertions in the same pass.
- `web/e2e/library-backup.spec.ts`: on an isolated browser context seed actual stores with
  rich fixture, download backup, restore into a second isolated context, inspect IDs,
  revisions, old Trash and shared references after reload, repeat file unchanged, then
  edit one record and confirm conflict preserves the edit. Use production preview and
  real browser IndexedDB, not mocked repository methods.
- Run lint, typecheck/build, unit tests and CI browser suite after implementation;
  mock-only design verification does not count as implementation verification.

## Risks and limits

- **Two independent commit scopes:** playlists may fail after climbs commit. Keep added
  climbs, report that outcome, re-review/retry the same file. No distributed transaction
  or rollback-delete mechanism is warranted.
- **Other tabs:** preflight and bounded export stability checks reduce stale review but
  do not freeze cross-database state. Transactional revalidation prevents overwrites;
  document that concurrent post-commit edits/deletes are independent user actions.
- **Unsupported/corrupt stored row:** fail export with its location instead of silently
  dropping it. Raw forensic salvage is outside this feature; existing stored data stays.
- **Phone memory/quota:** explicit file/count bounds prevent unbounded recovery work;
  quota aborts the store batch and partial progress remains recoverable. Exact upper-bound
  performance on Andrew's phone remains dogfooding, not a CI performance claim.
- **Retention becomes explicit:** Trash uses space until intentionally deleted. This is
  deliberate data protection; UI/documentation must not continue promising automatic
  30-day cleanup. A future cleanup capability would be separate, explicit user action.
- **Backup scope:** saved local climb and playlist authorities only. Catalog caches,
  transient editor edits, board pairing and PWA settings are not included; the dialog
  labels exactly what is captured.


## Design verification

- Six standalone HTML pages (flow navigator plus five states) opened in Chromium at
  390px and 1440px widths, with no horizontal overflow or JavaScript errors.
- Download preview feedback, conflict disabled state/identity disclosure, and partial
  recovery retry navigation were exercised. Retry review correctly reduces new climbs
  from eight to zero while retaining the two missing playlists.
- Phone screenshot inspected at 390px; touch actions remain readable and stack without
  clipping. Mock verification is UI-design evidence only, not production recovery testing.

## Implementation notes

- Execution capability: GPT-5.6 Luna xhigh, selected for the cross-store persistence and recovery risk.
- Review weight: standard, from `.work/CONVENTIONS.md`; stop at feature review for an independent pass.
- Files changed: `web/src/library-backup/{types,codec,indexeddb-store,service,LibraryBackupDialog,library-backup.css,index}.ts`; runtime/workspace composition; draft repository retention contract; related repository mocks/tests; `web/e2e/library-backup.spec.ts`.
- Tests added/removed: codec, service, transaction-boundary and dialog tests (45 focused tests); real Chromium isolated-context download/restore/no-op/conflict test. Removed obsolete automatic-purge assertions and mocks while retaining CRUD, lifecycle and conflict coverage.
- Simplification: removed the 30-day purge constant and repository method; recovery uses existing v1 IndexedDB object stores and existing stored-record codecs with one small private transaction algorithm shared by both stores.
- Discrepancies from design: the backup action is a single workspace-level library action visible on all four destinations, which keeps it outside the editor without duplicating controls in each child surface. The browser dialog exposes injectable file/download adapters for deterministic UI tests; production uses native File/Blob APIs.
- Adjacent issues: two codec boundary bugs were parked and absorbed into the verified child `story-library-backup-codec-boundaries`. README, SPEC and ARCHITECTURE document the current backup scope and permanent-until-explicit-delete Trash retention.
- Verification: `npm --prefix web test -- --maxWorkers=2` (80 files / 526 tests), `npm --prefix web run lint`, `npm --prefix web run typecheck`, `npm --prefix web run build`, and `npm --prefix web run test:e2e -- e2e/library-backup.spec.ts` (1 passed).

## Implementation dispatch

Bee dependency is verified at review (75 files / 509 unit tests, 8 browser scenarios,
lint/typecheck/build green). Prepared design and committed flow are ready. One Luna
xhigh feature owner carries codec, transaction adapter, service, retention and dialog
together because the recovery guarantee spans them. Standard review from project
conventions; root handles independent review and foundation documentation. No schema
replacement, destructive restore, identity rewrite or cloud backend is authorized.

Root integration: all 9 production browser scenarios pass after making the two
existing per-climb Restore selectors exact (the new backup launcher contains the
same word). This was locator drift, with no production behavior change. Independent
feature review is running against 7e8c386.

## Review (2026-09-05)

Verdict: Request changes. One independent standard Sol xhigh pass against 7e8c386;
same-harness fallback after earlier different-class OAuth failure. Root confirms all
four proposals: ambiguous partial-failure counts, stale/raceable refresh retry, export
continuation after Escape, and missing verification of the specified data-loss boundaries.
Root owns the named correction child and backup source/tests. Safe-update owner proceeds
with disjoint code and coordinates any backup operation interface. No rereview; close
by verification of accepted fixes plus full integrated checks and CI.

## Named-fix verification

The review correction and codec audit children are done. Exact outcomes and retry
lifetimes have 14 focused UI tests; schema/bounds, real transaction races/aborts and
service sequencing have 31 tests. The rich native-file browser scenario preserves
four historical record schemas, old Trash, metadata, original/seamless/bee recipes,
shared lists, orphan climbs and unavailable references with exact raw storage checks.
All 565 integrated unit tests and 10 browser scenarios pass; lint/typecheck/build pass.
Independent pass count remains one; only remote CI closure remains for this feature.

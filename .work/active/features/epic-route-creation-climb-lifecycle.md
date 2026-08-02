---
id: epic-route-creation-climb-lifecycle
kind: feature
stage: done
tags: [ui, data]
parent: epic-route-creation
depends_on: [epic-route-creation-local-draft-library, epic-route-creation-animated-light-designs]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Draft, Finished, and Trash Climb Lifecycle

## Brief

Give locally authored climbs an explicit Draft or Finished status. Keep drafts out of
the overall My Climbs library and place them in a dedicated Drafts workspace; My
Climbs presents finished climbs. Add a recoverable Trash for deleted drafts and
finished climbs, with automatic removal after 30 days.

Lists may reference both drafts and finished climbs because flexible collections such
as Current Projects naturally include unfinished work. Trashing and restoring a climb
must preserve its list memberships while the climb remains recoverable.

## Strategic decisions

- **Library visibility**: My Climbs contains finished climbs; drafts have a separate
  workspace so incomplete experiments do not crowd the main library.
- **Deletion**: deletion moves climbs to recoverable Trash for 30 days.
- **List compatibility**: both drafts and finished climbs can belong to any number of
  lists, and recoverable deletion retains those memberships.

## Simplification opportunity

Extend the existing local draft aggregate and repository instead of introducing a
parallel finished-climb store. Derive library, drafts, and trash views from one
lifecycle field and deletion metadata.

## Design decisions

- **Finished validity**: marking a climb Finished adds no role-count, naming, hold,
  or metadata validation. Local saving and lighting remain unrestricted in every
  lifecycle state.
- **Trash retention**: a trashed record keeps its stable local ID, content, effects,
  Draft/Finished status, and future list references. It is recoverable for 30 days;
  expiry is inclusive at `trashedAt + 30 days`.
- **Cleanup trigger**: the workspace requests an explicit expired-trash sweep before
  refreshing the library. The repository never mutates storage as a hidden side effect
  of `get` or `list`.
- **Permanent deletion**: Trash offers Delete forever per climb. Automatic expiry and
  manual permanent deletion share one physical-delete primitive.
- **Storage query**: lifecycle views filter a decoded local collection in memory. The
  expected personal collection is small, so a database-version/index migration is not
  earned yet.
- **Editor coordination**: Draft/Finished status is part of autosaved `DraftContent`;
  trash metadata is repository-owned and cannot be overwritten by an editor content
  save. Trash actions occur from the library rather than an open editor.
- **Incompatible records**: incompatibility never hides a record from Drafts or Trash;
  it disables opening/finishing while retaining restore and deletion recovery actions.

## UI alignment

The existing selected hybrid climb-browser mock and implemented list/detail workspace
already pin the composition. This feature is a bounded extension of that surface: a
three-choice My Climbs / Drafts / Trash collection switch with counts and contextual
Finish, Move to drafts, Move to trash, Restore, and Delete forever actions. No new
screen topology or design-system primitive is introduced, so a feature-tier mock is
not warranted.

## Architectural choice

Three shapes were considered. Separate Draft, Finished, and Trash stores would make
movement and future list references transactional across identities and was rejected.
A dedicated indexed lifecycle projection would optimize queries before the local data
volume justifies its migration cost. The chosen shape evolves the one authoritative
local climb aggregate additively with a lifecycle status and optional trash timestamp,
then derives all three views in the workspace.

The repository owns revision-checked trash/restore/permanent-delete commands and an
explicit expiry sweep. Ordinary autosave continues replacing only `DraftContent`, which
includes Draft/Finished status but never deletion metadata. This keeps the existing
optimistic concurrency contract intact and ensures delayed editor writes cannot
silently resurrect a trashed record.

## Implementation Units

### Unit 1: Versioned lifecycle aggregate and repository operations

**Files**: `web/src/drafts/types.ts`, `web/src/drafts/codec.ts`,
`web/src/drafts/repository.ts`, `web/src/drafts/indexeddb-repository.ts`, fixtures and
codec/repository tests
**Story**: `epic-route-creation-climb-lifecycle-persistence`

```typescript
export type LocalClimbStatus = 'draft' | 'finished';
export interface LocalClimbDraft {
  readonly status: LocalClimbStatus;
  readonly trashedAt?: string;
}
export interface DraftContent {
  readonly status: LocalClimbStatus;
}
export interface DraftListOptions {
  readonly installationId?: BoardInstallationId;
  readonly collection?: 'active' | 'drafts' | 'finished' | 'trash';
}
export interface LocalDraftRepository {
  trash(id: LocalDraftId, expectedRevision: DraftRevision): Promise<LocalClimbDraft>;
  restore(id: LocalDraftId, expectedRevision: DraftRevision): Promise<LocalClimbDraft>;
  deletePermanently(id: LocalDraftId, expectedRevision: DraftRevision): Promise<void>;
  purgeExpiredTrash(): Promise<number>;
}
```

Advance the stored aggregate to schema v3. Purely decode valid v1/v2 rows as Draft and
not trashed; write v3 only on the next ordinary mutation. Validate lifecycle values and
canonical trash timestamps. `update` preserves repository-owned `trashedAt` and rejects
content updates to trashed rows. Trash and restore increment revisions atomically.
`purgeExpiredTrash` deletes only successfully decoded rows whose expiry is at or before
the injected clock; corrupt or unknown-version rows remain recoverable.

**Acceptance Criteria**:
- [ ] Valid v1/v2 records reopen as active Drafts without eager writes; v3 lifecycle
  and trash metadata round-trip exactly.
- [ ] Draft/Finished list filters exclude Trash, and Trash retains the prior status and
  stable ID through restore.
- [ ] Trash, restore, content update, and permanent delete enforce optimistic revisions.
- [ ] The 30-day boundary purges expired rows while retaining newer, active, corrupt,
  and unknown-version rows.

### Unit 2: Lifecycle-aware library and editor controls

**Files**: `web/src/app/CruxControlWorkspace.tsx`,
`web/src/climb-browser/LocalClimbViewer.tsx`, route-editor reducer/workspace, CSS and
component/integration/e2e tests
**Story**: `epic-route-creation-climb-lifecycle-workspace`

```typescript
export type LocalClimbCollection = 'finished' | 'drafts' | 'trash';

export interface LocalClimbViewerProps {
  readonly heading: string;
  readonly emptyTitle: string;
  readonly emptyDescription: string;
  readonly primaryAction?: Readonly<{
    label: string;
    onActivate: (key: ClimbViewKey) => void;
  }>;
  readonly destructiveAction?: Readonly<{
    label: string;
    onActivate: (key: ClimbViewKey) => void;
  }>;
}
```

Add the three collection choices with visible counts and truthful empty copy. New
climbs start in Drafts and open immediately. The editor autosaves status and provides
Mark finished / Move to drafts without introducing provider validity rules. Library
actions use explicit confirmation for trash and permanent deletion; restore returns a
climb to its retained Draft/Finished collection. Refresh first runs expiry cleanup and
reports failures without hiding existing data.

**Acceptance Criteria**:
- [ ] My Climbs shows only Finished; Drafts shows active Drafts; Trash shows neither in
  the other collections, and all views survive reload.
- [ ] One unrestricted edit marks Finished through autosave and can return to Draft
  without changing holds, effects, metadata, or identity.
- [ ] Trash, restore, and confirmed Delete forever expose retryable errors and preserve
  recoverable content.
- [ ] Keyboard/touch navigation, selection dismissal, focus behavior, compact layout,
  and existing create/edit/light flows remain operable.

## Implementation Order

1. Versioned lifecycle aggregate and repository operations — establish migration,
   identity, concurrency, and retention semantics first.
2. Lifecycle-aware library and editor controls — compose only through the proven
   repository contract.

## Testing

- Extend codec and repository contract suites with v1/v2 migration, v3 round-trip,
  status filters, revision conflicts, trash/restore, permanent delete, and exact
  30-day expiry cases using injected time.
- Extend workspace/viewer/reducer/autosave tests for collection partitioning,
  unrestricted status changes, confirmations, recovery errors, and incompatible rows.
- Extend the Chromium Playwright route flow through create Draft → finish → My Climbs
  → trash → restore → reload while retaining the same local identity and content.

## Risks

- **Delayed autosave versus lifecycle action**: storing status in `DraftContent` and
  keeping trash actions outside the editor prevents resurrection; optimistic conflicts
  remain visible and recoverable.
- **Clock movement**: expiry uses canonical stored UTC timestamps and the repository's
  injected/current wall clock. A backward clock delays cleanup rather than deleting
  early.
- **Corrupt-row cleanup**: automatic cleanup skips undecodable records so recovery
  evidence is never destroyed silently.
- **Future playlists**: playlist design must reference stable namespaced local IDs as
  well as provider IDs. This feature preserves the local identity needed for that work
  but does not invent playlist storage prematurely.

## Implementation notes

- Execution capability: GPT-5.6 Sol at xhigh reasoning, selected by the autopilot caller because this feature combines a persisted schema migration, optimistic lifecycle commands, and cross-cutting workspace/editor behavior.
- Review weight: standard (caller override); implementation stops at `stage: review` for the independent feature review lane.
- Stories completed: `epic-route-creation-climb-lifecycle-persistence` (`7713660`) and `epic-route-creation-climb-lifecycle-workspace` (`dae679d`) advanced directly to `done` after their scoped verification.
- Delivered: schema-v3 Draft/Finished and repository-owned Trash metadata; pure v1/v2 migration; active/Drafts/Finished/Trash filters; revision-checked trash, restore, and permanent deletion; inclusive 30-day cleanup; My Climbs/Drafts/Trash counts and contextual actions; incompatible-record recovery; autosaved editor status; and production Chromium lifecycle persistence through reload.
- Files changed: lifecycle aggregate/repository/codec and tests under `web/src/drafts/`; workspace, viewer, editor/autosave, CSS, component tests, and `web/e2e/local-route-editor.spec.ts`; current-state lifecycle assertions in `docs/SPEC.md` and `docs/ARCHITECTURE.md`.
- Tests added/removed: added stable-interface and regression coverage for migration, filtering, revision conflicts, retention boundaries, lifecycle UI/actions/errors, incompatible rows, autosave safety, and the full browser flow. Stale assertions/fixtures were updated without deleting, skipping, or weakening behavioral coverage.
- Simplification: retained one authoritative IndexedDB aggregate/repository and one derived workspace collection rather than adding parallel stores, indexes, or editor persistence paths; atomic mutation and physical deletion primitives are shared.
- Discrepancies from design: none.
- Adjacent issues parked: none.

## Integrated verification

- `npm test` — 41 Vitest files, 273 tests passed.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run build` — production TypeScript/Vite/PWA build passed.
- `npm run test:e2e -- e2e/local-route-editor.spec.ts` — 2 Chromium tests passed, covering Draft → Finished → Trash → restore → reload and compact-phone editor controls.
- Test integrity inspection: lifecycle tests exercise production repository/component seams with no skips, tautological assertions, weakened expectations, or mocked-away acceptance behavior; the Playwright flow checks the persisted schema-v3 ID, status, content, and restored Trash metadata directly in IndexedDB.

## Review (2026-08-02)

**Verdict**: Approve with comments

**Blockers**: none
**Important**: `idea-corrupt-climb-list-recovery` parked for the pre-existing case
where one undecodable row rejects the whole list; automatic Trash purge already skips
and preserves such rows safely.
**Nits**: singular collection-count wording and persistent recovery-region semantics
fixed in `a062004`. Optional future consolidation could deduplicate lifecycle
partition/content projection helpers.
**Rejected**: autosave resurrection, cutoff inclusivity, eager migration, revision
gaps, unstable identity, missing incompatibility actions, and foundation drift were
all checked and disproven by code and tests.

**Notes**: Standard review weight; exactly one cross-model Claude Opus fresh-context
pass over `7713660`, `dae679d`, and `f21f998`, followed by host adjudication and fix
verification without re-review. Reviewer ran 63 lifecycle-focused tests and typecheck;
implementation evidence additionally records 273 full tests, lint, build, and two
Chromium Playwright journeys. Host reran the corrected workspace tests, lint, and
typecheck after review fixes.

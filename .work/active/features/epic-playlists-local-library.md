---
id: epic-playlists-local-library
kind: feature
stage: review
tags: [ui, data]
parent: epic-playlists
depends_on: [epic-route-creation-climb-lifecycle]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Local Playlist Library and Management

## Brief

Deliver the core flexible-list capability: a user can create, rename, annotate, and
delete lists; add either Draft or Finished climbs to multiple lists; remove entries;
and manually reorder each list. Persist one versioned browser-local playlist aggregate
whose ordered membership uses a namespaced union of local and future provider climb
references.

The surface reuses the existing climb workspace and design system. It must preserve
memberships while a local climb is in Trash, visibly distinguish unavailable entries,
and avoid tying list usefulness to the deferred community catalog.

## Epic context

- Parent epic: `epic-playlists`
- Position in epic: foundation capability; play-through and sharing consume its typed
  repository and management surface.

## Inherited design decisions

- One climb may belong to multiple manually ordered, semantically flexible lists.
- Drafts and Finished climbs are both eligible; Trash preserves but disables entries.
- Storage is local-first with stable namespaced local/provider references.
- Mockups pending under active autopilot; reuse the selected hybrid browser composition
  and locked design system.

## Research briefs

None required; this extends the existing native IndexedDB and climb-view contracts.

## Foundation references

- `docs/SPEC.md` — Capability 8 and Playlist domain model.
- `docs/ARCHITECTURE.md` — Playlist module and local-data authority.

## Mockups

- Inherits design system: `.mockups/design-system/`
- Parent UI alignment: `.work/active/epics/epic-playlists.md`

## Design decisions

- **Persistence boundary**: playlists use their own native IndexedDB database and
  repository. They reference climbs but do not share draft-store transactions or force
  a draft-database version upgrade.
- **Membership identity**: each list contains an ordered set (no duplicates within one
  list) of `{kind: 'local', id}` or `{kind: 'provider', id}` references. A climb may
  appear in any number of different lists.
- **Trash behavior**: playlist rows never mutate in response to climb lifecycle. The
  UI resolves current availability; a trashed local climb remains in place and becomes
  usable again after restore.
- **Management interaction**: reorder uses explicit Move up / Move down actions as the
  accessible baseline. Pointer dragging is not required to make manual ordering work.
- **Multi-list updates**: each checkbox change is one explicit optimistic mutation of
  one list, with its own saved/error state. The UI does not imply an unavailable
  cross-list transaction or hide partial success.
- **Scope**: playlists are global browser-local collections whose references carry
  board/source identity. The active board resolves compatible entries; others remain
  visible and unavailable rather than being dropped.
- **Missing climbs**: permanent deletion or expiry leaves a truthful unresolved entry
  until the user removes it from the list.
- **Deletion**: deleting a list is a confirmed permanent local action; it never deletes
  member climbs.
- **Provider readiness**: provider references are validated and persisted now, but the
  current UI only offers installed/resolvable climb sources. No catalog dependency is
  introduced.

## UI alignment

Reuse the implemented climb workspace rather than creating a separate application
shell. Add Lists as a peer workspace destination alongside My Climbs, Drafts, and
Trash. The Lists surface has a touch-safe list selector/editor, and climb detail offers
an Add to lists dialog with checkboxes plus Create list. This extends existing cards,
dialogs, buttons, status/error banners, and compact/wide responsive rules; parent-tier
mockups are deferred under autopilot.

## Architectural choice

Three storage shapes were evaluated. Embedding list IDs into climb records would make
ordering and list metadata unnatural and would rewrite every climb for membership
changes. Adding a playlists store to the draft database would couple independent
lifecycle upgrades and connection ownership. LocalStorage would lose atomic optimistic
updates and typed corruption handling. The chosen shape is one small, separate
IndexedDB playlist aggregate repository with the same proven codec/port/adapter pattern
as local climbs.

Membership remains references-only. A resolver in the application composition joins
local references to the current climb collection and preserves unavailable entries as
explicit placeholders. This is the simplest way to retain list order through Trash and
prepare for provider catalogs without making persistence depend on either source.

## Implementation Units

### Unit 1: Versioned playlist contracts and repository

**Files**: new `web/src/playlists/{types,codec,errors,repository,indexeddb-repository,open-playlist-database,index}.ts`
and focused tests
**Story**: `epic-playlists-local-library-persistence`

```typescript
export type PlaylistId = Brand<string, 'PlaylistId'>;
export type PlaylistRevision = Brand<number, 'PlaylistRevision'>;
export type PlaylistClimbReference =
  | Readonly<{ kind: 'local'; id: LocalDraftId }>
  | Readonly<{ kind: 'provider'; id: ProviderClimbId }>;
export interface PlaylistContent {
  readonly name: string;
  readonly notes: string;
  readonly entries: readonly PlaylistClimbReference[];
}
export interface LocalPlaylist extends PlaylistContent {
  readonly schemaVersion: 1;
  readonly id: PlaylistId;
  readonly revision: PlaylistRevision;
  readonly createdAt: string;
  readonly updatedAt: string;
}
export interface LocalPlaylistRepository {
  create(content: PlaylistContent): Promise<LocalPlaylist>;
  get(id: PlaylistId): Promise<LocalPlaylist | null>;
  list(): Promise<readonly LocalPlaylist[]>;
  update(id: PlaylistId, expected: PlaylistRevision, content: PlaylistContent): Promise<LocalPlaylist>;
  delete(id: PlaylistId, expected: PlaylistRevision): Promise<void>;
}
export function playlistReferenceKey(reference: PlaylistClimbReference): string;
```

Validate canonical UUIDs/timestamps, non-empty trimmed names, string notes, provider
identity brands, unique entry keys, revisions, and deterministic updated ordering at
the codec boundary. Repository operations are atomic and optimistic. The repository
never queries or mutates the climb store.

**Acceptance Criteria**:
- [ ] Local and provider references round-trip exactly in manual order; duplicate
  entries and corrupt records fail with typed path-specific errors.
- [ ] Create/list/get/update/delete obey stable identity, optimistic revisions, and
  newest-updated-first ordering across timestamp ties.
- [ ] Reopening the database preserves lists; missing/quota/blocked/schema failures
  remain explicit and retryable.

### Unit 2: Runtime resolver and complete list-management workspace

**Files**: `web/src/app/{create-runtime,CruxControlWorkspace}.tsx`, new playlist UI
components/CSS, climb detail/viewer extensions, and component/e2e tests
**Story**: `epic-playlists-local-library-management`

```typescript
export interface ResolvedPlaylistEntry {
  readonly reference: PlaylistClimbReference;
  readonly key: string;
  readonly climb: ClimbViewRecord | null;
  readonly availability: 'available' | 'trashed' | 'missing';
}
export function resolvePlaylistEntries(
  playlist: LocalPlaylist,
  localClimbs: readonly LocalClimbDraft[],
  providerClimbs?: readonly ClimbViewRecord[],
): readonly ResolvedPlaylistEntry[];
```

Compose the playlist database/repository into `CruxControlRuntime` and close both
databases safely on partial startup failure. Add Lists navigation with counts and CRUD
editing. Add/remove membership from climb detail; use one checkbox per list and permit
creating a list inline. Reorder with accessible move buttons and preserve selection.
Unavailable entries keep their label/reference/order, disable view/light actions, and
never disappear silently. Every async mutation reports retryable errors and refreshes
from repository truth.

**Acceptance Criteria**:
- [ ] A list can be created, renamed, annotated, and permanently deleted after
  confirmation without modifying any climb.
- [ ] Draft and Finished climbs can be added to multiple lists, removed independently,
  and reordered; no list accepts the same climb twice.
- [ ] Trash makes an entry unavailable without changing membership/order, and restore
  resolves the same entry again.
- [ ] Compact-phone and wide layouts expose named keyboard/touch controls, truthful
  empty/error states, and retain the existing create/edit/light flows.

## Implementation Order

1. Versioned playlist contracts and repository — establish the stable reference and
   concurrency contract.
2. Runtime resolver and list-management workspace — compose UI only through the
   verified repository.

## Testing

- Codec/repository contract tests cover both reference variants, duplicate detection,
  corrupt paths, optimistic conflicts, timestamp ties, persistence, deletion, and
  storage failures with `fake-indexeddb` and deterministic IDs/time.
- Resolver tests cover active Draft/Finished, Trash, missing local/provider, and exact
  order preservation.
- Component tests cover list CRUD, one climb in multiple lists, checkbox membership,
  reordering boundaries, confirmation, retryable errors, and restored availability.
- Playwright extends the local route journey: create/finish climb → create two lists →
  add to both → reorder → Trash/restore → reload and verify identity/membership/order.

## Risks

- **Cross-database consistency**: joins are read-time only and playlist writes never
  require a climb transaction. Unavailable references remain explicit rather than
  pretending atomicity across stores.
- **Runtime startup**: if playlist storage fails after draft storage opens, close the
  draft database before surfacing the startup error.
- **Provider identity drift**: preserve the complete namespaced provider ID and render
  unresolved placeholders until the matching catalog is installed.
- **UI density**: keep list CRUD and membership selection in focused surfaces; do not
  overload the hold editor or board canvas.

## Implementation notes

- Execution capability: GPT-5.6 Sol at xhigh reasoning, selected by the caller because
  the feature spans durable storage, partial runtime startup/cleanup, reference
  resolution, and a dense responsive UI. One implementer owned both sequential story
  checkpoints to preserve cross-boundary context.
- Review weight: standard (caller and project convention); implementation stops at
  feature `stage: review` as requested.
- Story commits: `8ee85b5` (`epic-playlists-local-library-persistence`) and `3d88e83`
  (`epic-playlists-local-library-management`).
- Files changed: new `web/src/playlists/` contracts, codec, repository, resolver,
  management UI/CSS/tests; runtime/workspace/climb-detail integration; production
  Chromium journey; current-state `SPEC` and `ARCHITECTURE` assertions.
- Tests added/removed: added 31 focused playlist/runtime/component tests within the
  now-green 304-test Vitest suite plus one end-to-end Chromium journey; updated three
  existing runtime fixtures for the required playlist port; removed none.
- Test integrity inspection: tests exercise repository and component interfaces with
  observable state and stored records, retain exact identity/order assertions, and use
  no skipped, tautological, or implementation-disabled paths. The one Playwright
  timing repair waits for the observable restore count before reload rather than
  weakening the persistence assertion.
- Simplification: membership remains references-only in one playlist aggregate;
  Trash/restore performs no playlist write; resolution is a read-time join; no
  cross-database transaction, drag framework, catalog dependency, or duplicated app
  shell was introduced.
- Discrepancies from design: none. The explicitly deferred parent-tier mockup remains
  deferred; the UI reuses the locked token system and existing responsive workspace,
  dialog, action, and error patterns.
- Adjacent issues parked: none.

## Integrated verification

- `npm test` — 48 files and 304 tests passed.
- `npm run lint` — passed.
- `npm run build` — TypeScript and Vite production/PWA build passed.
- `npx playwright test` — all 3 Chromium journeys passed, including compact editor
  behavior and playlist membership/order/Trash/restore persistence across reload.
- Acceptance walk-through: list CRUD/notes/confirmation, Draft and Finished
  multi-membership, duplicate prevention, accessible boundary-aware reordering,
  repository-truth retries, inline creation, Trash-safe restoration, unresolved
  references, mobile/wide controls, and existing edit/light flows are covered and
  green.

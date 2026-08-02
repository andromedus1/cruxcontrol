---
id: epic-route-creation-local-draft-library
kind: feature
stage: review
tags: [ui, data]
parent: epic-route-creation
depends_on:
  - epic-universal-board-platform-domain-definition
  - epic-climb-browser-local-climb-viewer
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Local Draft Library

## Brief

Deliver the locally authoritative draft model and durable browser persistence needed
for the first Fullride create-save-light loop. A user can create, save, reopen, update,
and delete Fullride drafts without an account, network connection, community catalog,
or Kilter validity gate. Every draft preserves its stable local identity, installation
and definition revision, angle, semantic or custom hold assignments, and optional
metadata, including completely empty and unconventional states.

The library projects saved drafts into the normalized local climb-viewer contract so
they appear in “My climbs” immediately and survive app reloads. It owns browser-local
schema/version handling and honest persistence failures, but not the route-editor UI,
board rendering, Bluetooth control, Kilter frames encoding, provider publication,
catalog storage, or a share/export interface. The stored record should remain portable
enough for a later explicit export capability without making export part of this
milestone.

## Epic context

- Parent epic: `epic-route-creation`
- Position in epic: foundation capability; the visual editor workspace depends on its
  draft identity, persistence, and viewer projection.

## Inherited design decisions

- Local drafts are authoritative and may be saved in any state, including empty or
  unconventional role combinations.
- Name and angle are the primary metadata; grade, description, and setter notes are
  optional. Local persistence does not enforce provider publication requirements.
- Hold assignments preserve the same semantic roles and exact quantized custom colors
  consumed by the renderer and controller.
- The first milestone is one configured Fullride 7x10 installation. Kilter auth,
  publication, provider encoding, and community catalog work are excluded.
- Durable data stays browser-local and does not require an account or backend.

## Research briefs

- `docs/briefs/data-model.md` — Kilter placement/role concepts and the distinction
  between source-native climb encoding and the normalized application model.
- `docs/briefs/foundation-pwa-sqlite.md` — browser-local persistence constraints and
  worker/OPFS context; the draft store remains independent of the provider catalog.
- `docs/briefs/board-rendering-and-filtering.md` — normalized local viewer boundary.

## Foundation references

- `docs/ARCHITECTURE.md` — Route Editor, Data Layer, and Board Domain boundaries.
- `docs/SPEC.md` — Route Creation, offline-first, per-user isolation, and Fullride
  acceptance scope.
- `docs/PRINCIPLES.md` — local ownership, explicit boundaries, and truthful failures.

## Mockups

- Inherits design system: `.mockups/design-system/`
- Existing list/detail composition: `.mockups/screens/epic-climb-browser/option-hybrid.html`
- Route-editor mockups pending — see parent epic's `## UI alignment deferred` note.

## Design decisions

- **Persistence boundary**: drafts use a dedicated native IndexedDB database and do
  not share the catalog's SQLite/OPFS VFS. Drafts are small user-authored aggregates;
  IndexedDB gives atomic per-record transactions, durable offline persistence, and
  Chromium support without a worker, Wasm, catalog bootstrap, or unresolved VFS
  import dependency.
- **Authority and validity**: the stored draft is the source of truth. Persistence
  validates wire structure, branded primitives, finite angle, and packed color range,
  but never imposes provider publication rules, required metadata, role counts, or a
  non-empty assignment list.
- **Identity and concurrency**: each draft receives an opaque UUID-based local ID once.
  Updates replace the aggregate only when the caller's expected revision matches;
  deletes use the same optimistic check. This prevents two open editor instances from
  silently overwriting one another.
- **Semantic/custom distinction**: each placement assignment stores the existing
  discriminated `role` or `custom` appearance unchanged. Custom colors are persisted
  as exact API-level-3 packed integers (`0..255`), never expanded to RGB or inferred
  from semantic role colors.
- **Schema evolution**: the database and every wire record are versioned separately.
  IndexedDB upgrade functions own store/index changes; a pure record decoder/migrator
  owns payload changes. Unknown future versions and corrupt records are surfaced as
  typed failures and are never deleted or coerced automatically.
- **Read projection**: local identities become opaque viewer keys through one
  namespaced helper; the draft's definition revision, assignments, and optional
  metadata remain authoritative. Projection performs no Kilter frame encoding or
  publication validation.

## Architectural choice

Use a small `drafts` domain module with a repository port and a native IndexedDB
adapter. The public repository works with immutable versioned aggregates and exposes
create/get/list/update/delete operations. The adapter stores one structured-clone-safe
wire record per aggregate and one deterministic `updatedAt` index. A pure codec sits
between wire data and branded domain values, while a pure projection supplies the
existing climb-viewer read model.

Two alternatives were considered. `localStorage` is simpler to call, but synchronous
whole-document rewrites, weak atomicity across tabs, quota behavior, and lack of
indexed ordering make it a poor source of truth. Reusing wa-sqlite would provide SQL
and a shared storage stack, but couples the create/save/light milestone to the
catalog's worker and unresolved OPFS import path, and is disproportionate for hundreds
of small aggregates. A single IndexedDB object store is the narrower reversible
choice; the repository port keeps future export or storage adapters additive.

The trickiest unit is atomic optimistic replacement. A read followed by a later write
in separate transactions can lose edits, and IndexedDB transactions become inactive
if code awaits unrelated work. The adapter therefore performs revision lookup,
comparison, replacement, and result resolution inside one `readwrite` transaction,
using only transaction-bound IDB requests. ID and timestamp generation happen before
the transaction. A unique `[updatedAt, id]` ordering key makes list order stable even
when timestamps collide.

## Implementation Units

### Unit 1: Versioned draft aggregate and codec

**Files**:

- `web/src/drafts/types.ts`
- `web/src/drafts/codec.ts`

```typescript
import type { BoardHoldAssignment } from '../board-renderer/types';
import type { BoardDefinitionId, Brand, LayoutRevisionId } from '../domain/boards/types';
import type { BoardInstallationId } from '../installations/contracts';

export type LocalDraftId = Brand<string, 'LocalDraftId'>;
export type DraftRevision = Brand<number, 'DraftRevision'>;
export const LOCAL_DRAFT_SCHEMA_VERSION = 1 as const;

export interface DraftMetadata {
  readonly grade?: string;
  readonly description?: string;
  readonly setterNotes?: string;
}

export interface LocalClimbDraft {
  readonly schemaVersion: typeof LOCAL_DRAFT_SCHEMA_VERSION;
  readonly id: LocalDraftId;
  readonly revision: DraftRevision;
  readonly installationId: BoardInstallationId;
  readonly definitionId: BoardDefinitionId;
  readonly layoutRevision: LayoutRevisionId;
  readonly name: string;
  readonly angle: number;
  readonly assignments: readonly BoardHoldAssignment[];
  readonly metadata: Readonly<DraftMetadata>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DraftContent {
  readonly installationId: BoardInstallationId;
  readonly definitionId: BoardDefinitionId;
  readonly layoutRevision: LayoutRevisionId;
  readonly name: string;
  readonly angle: number;
  readonly assignments: readonly BoardHoldAssignment[];
  readonly metadata?: Readonly<DraftMetadata>;
}

export interface StoredDraftV1 {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly revision: number;
  readonly installationId: string;
  readonly definitionId: string;
  readonly layoutRevision: string;
  readonly name: string;
  readonly angle: number;
  readonly assignments: readonly ({
    readonly placementId: string;
    readonly appearance:
      | { readonly kind: 'role'; readonly role: 'start' | 'middle' | 'finish' | 'foot-only' }
      | { readonly kind: 'custom'; readonly color: number };
  })[];
  readonly metadata: { readonly grade?: string; readonly description?: string; readonly setterNotes?: string };
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly updatedOrder: readonly [string, string];
}

export function localDraftId(value: string): LocalDraftId;
export function draftRevision(value: number): DraftRevision;
export function encodeStoredDraft(draft: LocalClimbDraft): StoredDraftV1;
export function decodeStoredDraft(value: unknown): LocalClimbDraft;
```

**Implementation Notes**:

- `localDraftId` accepts only canonical UUID strings; the injected ID source uses
  `crypto.randomUUID()`. Revision is a positive safe integer.
- Decode reconstructs all branded IDs through their existing constructors, validates
  ISO timestamps, finite angle, unique placement IDs, known roles, packed colors via
  `apiLevel3Color`, and optional fields as strings. Empty name, assignments, and
  metadata strings remain valid draft states.
- Freeze the aggregate, metadata, assignment array, assignments, and appearances at
  the domain boundary. The wire object contains no brands and is portable through
  structured clone and later JSON export.
- `decodeStoredDraft` dispatches by `schemaVersion`. An unsupported version throws
  `DraftSchemaError` with the ID/version when discoverable; malformed data throws
  `DraftCorruptRecordError` with a field path and preserves the underlying record.

**Acceptance Criteria**:

- [x] Empty and unconventional drafts round-trip without semantic changes.
- [x] All four roles and every packed color `0..255` round-trip exactly and remain
  distinguishable.
- [x] Malformed brands, duplicate placements, invalid timestamps/revisions/colors,
  and unknown schema versions fail with a typed path-bearing error rather than being
  dropped or normalized.
- [x] Encoding the same draft twice produces deeply equal wire records.

### Unit 2: Repository contract and errors

**Files**:

- `web/src/drafts/repository.ts`
- `web/src/drafts/errors.ts`

```typescript
export interface DraftListOptions {
  readonly installationId?: BoardInstallationId;
}

export interface LocalDraftRepository {
  create(content: DraftContent): Promise<LocalClimbDraft>;
  get(id: LocalDraftId): Promise<LocalClimbDraft | null>;
  list(options?: DraftListOptions): Promise<readonly LocalClimbDraft[]>;
  update(
    id: LocalDraftId,
    expectedRevision: DraftRevision,
    content: DraftContent,
  ): Promise<LocalClimbDraft>;
  delete(id: LocalDraftId, expectedRevision: DraftRevision): Promise<void>;
}

export interface DraftRepositoryOptions {
  readonly now?: () => Date;
  readonly createId?: () => string;
}

export type DraftErrorCode =
  | 'unavailable'
  | 'quota-exceeded'
  | 'not-found'
  | 'conflict'
  | 'schema-unsupported'
  | 'corrupt-record';

export class DraftRepositoryError extends Error {
  readonly code: DraftErrorCode;
  readonly cause?: unknown;
  constructor(code: DraftErrorCode, message: string, options?: { readonly cause?: unknown });
}
export class DraftNotFoundError extends DraftRepositoryError {
  readonly id: LocalDraftId;
  constructor(id: LocalDraftId);
}
export class DraftConflictError extends DraftRepositoryError {
  readonly id: LocalDraftId;
  readonly expectedRevision: DraftRevision;
  readonly actualRevision: DraftRevision;
  constructor(id: LocalDraftId, expectedRevision: DraftRevision, actualRevision: DraftRevision);
}
export class DraftSchemaError extends DraftRepositoryError {
  readonly id?: string;
  readonly schemaVersion: unknown;
  constructor(schemaVersion: unknown, id?: string);
}
export class DraftCorruptRecordError extends DraftRepositoryError {
  readonly id?: string;
  readonly path: string;
  constructor(path: string, message: string, options?: { readonly id?: string; readonly cause?: unknown });
}
```

**Implementation Notes**:

- Create starts at revision `1`; update increments exactly once and preserves ID and
  `createdAt`. `updatedAt` is injected UTC ISO time. Update rejects any attempt to
  change identity indirectly, while installation/definition/revision changes remain
  explicit content changes for a local draft.
- List is deterministically sorted newest first by `updatedAt`, then lexicographic ID;
  optional installation filtering is exact. Returned values are immutable snapshots.
- Delete of a missing ID is `DraftNotFoundError`, not a silent success; revision
  mismatch is `DraftConflictError`. This keeps UI recovery truthful.
- DOM storage errors are translated: `QuotaExceededError` to `quota-exceeded`, open/
  blocked/security failures to `unavailable`; programming and codec errors retain
  their more specific types.

**Acceptance Criteria**:

- [x] Create/update/delete behavior is deterministic under injected IDs and clocks.
- [x] Stale updates and deletes cannot overwrite or remove newer revisions.
- [x] Missing records and persistence failures are distinguishable by stable codes.
- [x] List ordering is stable when multiple records share a timestamp.

### Unit 3: Native IndexedDB adapter

**Files**:

- `web/src/drafts/indexeddb-repository.ts`
- `web/src/drafts/open-draft-database.ts`

```typescript
export const DRAFT_DATABASE_NAME = 'cruxcontrol-local-drafts';
export const DRAFT_DATABASE_VERSION = 1;
export const DRAFT_STORE_NAME = 'drafts';

export interface DraftDatabaseFactory {
  open(name: string, version?: number): IDBOpenDBRequest;
}

export function openDraftDatabase(
  factory?: DraftDatabaseFactory,
): Promise<IDBDatabase>;

export class IndexedDbLocalDraftRepository implements LocalDraftRepository {
  constructor(
    database: IDBDatabase,
    options?: DraftRepositoryOptions,
  );
  create(content: DraftContent): Promise<LocalClimbDraft>;
  get(id: LocalDraftId): Promise<LocalClimbDraft | null>;
  list(options?: DraftListOptions): Promise<readonly LocalClimbDraft[]>;
  update(id: LocalDraftId, expectedRevision: DraftRevision, content: DraftContent): Promise<LocalClimbDraft>;
  delete(id: LocalDraftId, expectedRevision: DraftRevision): Promise<void>;
  close(): void;
}
```

**Implementation Notes**:

- Database v1 creates key-path `id` object store plus a unique `updatedOrder` index
  and non-unique `installationId` index. `onblocked` rejects with an actionable `unavailable`
  error; `onversionchange` closes the connection so a new deployment can upgrade.
- Each mutation is one `readwrite` transaction. Update/delete issue `get`, compare
  revisions, then `put`/`delete` without awaiting non-IDB work. Resolve only after
  `transaction.oncomplete`; reject once on request/abort/error.
- Create uses `add`, so an injected ID collision is never an overwrite. Retry one time
  only when the default random ID source collides; deterministic injected sources
  surface conflict immediately.
- List walks the `updatedOrder` index in `prev` direction, decodes every row, and
  applies installation filtering without mutating records. One corrupt row rejects
  the query with its typed error; no cleanup occurs implicitly.

**Acceptance Criteria**:

- [x] Data survives repository close/reopen and works with no network or catalog DB.
- [x] Concurrent repositories cannot both update or delete from the same expected
  revision successfully.
- [x] Create never overwrites an existing record; every mutation commits all-or-none.
- [x] Upgrade blocking, quota, transaction abort, corrupt row, and unavailable-IDB
  paths produce stable repository errors and preserve existing records.

### Unit 4: Viewer projection and public module

**Files**:

- `web/src/drafts/to-climb-view-record.ts`
- `web/src/drafts/index.ts`

```typescript
import type { ClimbViewKey, ClimbViewRecord } from '../climb-browser/types';

export function localDraftClimbViewKey(id: LocalDraftId): ClimbViewKey;
export function toClimbViewRecord(draft: LocalClimbDraft): ClimbViewRecord;
```

**Implementation Notes**:

- Build the key with an unambiguous length-prefixed `local-draft` namespace and draft
  ID, then pass it through `climbViewKey`; consumers never parse it.
- Project name, angle, assignments, grade, and description without cloning or
  translating roles/colors. `origin` is always `local-draft`; `setter` is omitted
  because setter notes are private metadata, not attribution.
- The public index exports contracts/factories but does not open IndexedDB at module
  import time. App composition owns initialization and failure UI.

**Acceptance Criteria**:

- [x] A draft's viewer key is stable across updates/reloads and cannot collide with a
  provider key namespace.
- [x] Viewer projection preserves assignment identity and exact packed colors and
  exposes only fields in the existing viewer contract.
- [x] Importing the module causes no storage access or side effect.

## Implementation Order

1. Versioned aggregate + codec — first because storage integrity and migration
   behavior constrain every later unit.
2. Repository contract + errors — establishes consumer behavior independently of
   IndexedDB.
3. IndexedDB adapter — implements atomic mutation and persistence against the port.
4. Viewer projection + public module — integrates saved drafts only after the source
   of truth is stable.

No child stories are spawned: the codec, repository semantics, adapter transactions,
and projection form one data-integrity stride and share the same types and tests.

## Testing

### Unit tests: `web/src/drafts/codec.test.ts`

- Round-trip empty, all-role, arbitrary-custom-color, optional-metadata, Unicode, and
  same-placement rejection fixtures.
- Table-test all 256 packed colors and each malformed field/error path.
- Prove unknown versions do not enter the current decoder and source objects are not
  mutated or silently repaired.

### Contract tests: `web/src/drafts/repository.contract.test.ts`

Export a reusable repository contract suite accepting an async repository factory.
Exercise CRUD, immutable snapshots, stable ordering/tie-breaks, installation filter,
ID collision, missing IDs, stale update/delete, exact revision increments, preserved
creation time, and unrestricted empty/unconventional content. Run it against the
IndexedDB adapter using a small IndexedDB test double or `fake-indexeddb` added as a
dev dependency; prefer `fake-indexeddb` if it accurately exercises transactions and
indexes rather than maintaining a bespoke behavioral clone.

### Adapter tests: `web/src/drafts/indexeddb-repository.test.ts`

- Reopen durability and two-connection optimistic concurrency.
- Atomic abort leaves the prior aggregate unchanged.
- Blocked/version-change handling, quota/error translation, and corrupt-record
  retention using narrow factory/request doubles only where the IndexedDB test
  implementation cannot induce the browser failure.

### Projection tests: `web/src/drafts/to-climb-view-record.test.ts`

- Stable namespaced key, exact assignments/custom colors, optional field mapping, and
  absence of storage side effects.

### Integration seam

Instantiate the adapter against a real browser IndexedDB in the existing Chromium/PWA
smoke path when browser automation arrives. The Vitest contract suite remains the CI
source for deterministic data semantics; no test depends on OPFS, SQLite, network,
Kilter frames, or hardware.

## Risks

- **IndexedDB transaction lifetime**: awaiting unrelated promises can auto-commit a
  transaction before replacement. **Fallback**: keep each mutation as an explicit
  IDB request chain and verify two-connection contention in contract tests.
- **Schema upgrade blocked by an old tab**: a prior app instance can hold the database
  open. **Fallback**: close on `versionchange`, surface the blocked state, and let the
  user close/reload other tabs; never delete the database automatically.
- **Corrupt/unsupported record blocks list**: rejecting the whole list is safer than
  hiding user work but can make “My climbs” unavailable. **Fallback**: retain typed
  record identity in the error so a later explicit recovery/export surface can isolate
  it; do not add silent partial reads in this milestone.
- **Browser eviction/private mode**: browser-local durability is not a backup and may
  be unavailable or cleared by the user/browser. **Fallback**: truthful unavailable/
  quota errors now and the already-planned explicit export capability later; do not
  claim sync-grade durability.

## Implementation notes

- Execution capability: xhigh — persistence schema, corruption recovery, and atomic
  optimistic concurrency are high-integrity user-data boundaries.
- Review weight: standard (caller and project convention); implementation was left at
  `stage: review` for the orchestrator-owned independent pass.
- Files changed: `web/src/drafts/{types,codec,errors,repository,open-draft-database,indexeddb-repository,to-climb-view-record,index}.ts`, focused tests and fixtures in the same module, `web/package.json`, and `package-lock.json`.
- Tests added/removed: codec round trips and malformed-path coverage; reusable
  repository contract; IndexedDB durability, ordering, filtering, collision,
  concurrency, atomic-abort, and corruption-retention cases; storage error mapping;
  viewer projection. No tests removed.
- Simplification: one structured-clone wire codec is shared by validation, mutation,
  reads, and projection inputs; no catalog/OPFS coupling or parallel in-memory
  persistence implementation was introduced.
- Discrepancies from design: `fake-indexeddb` was selected from the design's permitted
  strategies because it exercises native request/transaction/index behavior more
  faithfully than a bespoke clone. Browser-only blocked/version-change callbacks are
  implemented directly; unavailable factory and error translation use narrow tests.
- Adjacent issues parked: none.

## Verification evidence

- `npm test` — 32 files, 191 tests passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed, including generated PWA service worker.

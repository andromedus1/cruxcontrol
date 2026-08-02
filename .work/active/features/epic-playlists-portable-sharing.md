---
id: epic-playlists-portable-sharing
kind: feature
stage: review
tags: [ui, data]
parent: epic-playlists
depends_on: [epic-playlists-local-library]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Portable Playlist Sharing and Import

## Brief

Make a playlist portable without a backend. Export a versioned share payload through a
URL when size permits and through a downloadable/shareable file for every valid list;
import previews the result and creates new local records only after confirmation.
Provider entries remain namespaced references. Browser-local entries carry immutable
climb snapshots because their UUIDs cannot resolve on another device.

Import never overwrites existing climbs or lists silently, rejects corrupt or
incompatible payloads at the boundary, and reports unresolved provider entries without
discarding their order or provenance.

## Epic context

- Parent epic: `epic-playlists`
- Position in epic: independent portability consumer of the verified playlist library.

## Inherited design decisions

- Backendless, explicit sharing only; each browser remains authoritative for its own
  data.
- Local snapshots import as copies; provider identities remain namespaced references.
- URL sharing has a file fallback rather than truncation.
- Mockups pending under active autopilot; reuse existing dialog and recovery patterns.

## Research briefs

None required; use browser URL, file, and Web Share capabilities behind small adapters.

## Foundation references

- `docs/SPEC.md` — Playlist sharing and per-user isolation.
- `docs/ARCHITECTURE.md` — Static/backendless local-data model.

## Mockups

- Inherits design system: `.mockups/design-system/`
- Parent UI alignment: `.work/active/epics/epic-playlists.md`

## Design decisions

- **Payload, not storage record**: sharing has its own strict versioned envelope and
  never serializes playlist/database revisions, timestamps, local UUID authority, or
  `StoredPlaylistV1` directly.
- **Local snapshot semantics**: each resolvable local membership embeds immutable climb
  content (status, board/layout identity, name, angle, assignments, effects, metadata),
  but not its UUID, revision, installation ID, or Trash state. Import creates a fresh
  active Draft/Finished copy for the recipient's compatible installation.
- **Provider semantics**: provider memberships remain complete namespaced references
  and can remain unresolved after import without losing order or provenance.
- **Unavailable local entries**: a missing local record cannot produce the promised
  portable snapshot, so export is blocked with an entry-specific error rather than
  silently discarding it or emitting an unusable sender-local UUID. A trashed record is
  still resolvable and exports its content as an active copy.
- **URL boundary**: canonical JSON is UTF-8/base64url encoded into the URL fragment
  `#playlist=<payload>` so it is not sent to the static host. URLs are offered only when
  the full URL is at most 1,800 characters; every valid payload can instead download as
  a `.cruxplaylist.json` file. No truncation or lossy compression is allowed.
- **Explicit import**: URL and file input both decode into the same pure preview plan.
  No repository write occurs until the user confirms the named list, climb-copy count,
  provider count, compatibility, and warnings.
- **Collision and failure behavior**: imported local climbs always receive new UUIDs and
  the imported playlist always receives a new UUID. The executor creates climb copies,
  then the playlist with remapped references; if any step fails it compensates by
  permanently deleting copies created in that attempt and reports any incomplete
  cleanup truthfully. Existing records are never updated.
- **Share capability**: use Web Share only behind a small injectable adapter when the
  browser can share the requested URL/file. Otherwise expose Copy link and Download
  file; clipboard failure leaves the link selectable rather than pretending success.
- **UI fallback**: the parent already pins a share/import dialog using existing cards,
  buttons, status banners, and recovery patterns. No new top-level screen or component
  vocabulary is introduced, so no feature-tier mock is required.

## Architectural choice

Three approaches were considered. Exporting raw IndexedDB rows would leak local identity
and storage revisions while remaining unusable on another device. A compact query-string
of only membership IDs would lose browser-local climbs. A backend share service would
violate the settled static/local-first architecture. The chosen approach is a dedicated
portable envelope with provider references and embedded local snapshots, transported by
fragment URL when small and JSON file always.

The trickiest unit is safe multi-repository import. A pure decoder first produces a
fully validated `PlaylistImportPlan` with no branded local IDs. The executor then creates
fresh drafts in payload order, builds a reference map, creates the playlist last, and
performs best-effort reverse-order compensation on failure. This does not claim atomicity
across IndexedDB databases, but it minimizes orphan risk and exposes cleanup failures.

## Implementation Units

### Unit 1: Portable payload codec, export planning, and transports

**Files**: new
`web/src/playlists/{portable-types,portable-codec,portable-export,portable-transports}.ts`
and focused tests
**Story**: `epic-playlists-portable-sharing-codec`

```typescript
export const PORTABLE_PLAYLIST_SCHEMA_VERSION = 1 as const;
export const PORTABLE_PLAYLIST_FORMAT = 'cruxcontrol-playlist' as const;

export type PortablePlaylistEntryV1 =
  | Readonly<{ kind: 'local-snapshot'; snapshot: PortableClimbSnapshotV1 }>
  | Readonly<{ kind: 'provider'; id: ProviderClimbId }>;

export interface PortableClimbSnapshotV1 {
  readonly status: LocalClimbStatus;
  readonly definitionId: BoardDefinitionId;
  readonly layoutRevision: LayoutRevisionId;
  readonly name: string;
  readonly angle: number;
  readonly assignments: readonly BoardHoldAssignment[];
  readonly effectGroups: readonly LightEffectGroup[];
  readonly metadata: Readonly<DraftMetadata>;
}

export interface PortablePlaylistV1 {
  readonly format: typeof PORTABLE_PLAYLIST_FORMAT;
  readonly schemaVersion: typeof PORTABLE_PLAYLIST_SCHEMA_VERSION;
  readonly exportedAt: string;
  readonly playlist: Readonly<{
    name: string;
    notes: string;
    entries: readonly PortablePlaylistEntryV1[];
  }>;
}

export function createPortablePlaylist(
  playlist: LocalPlaylist,
  localClimbs: readonly LocalClimbDraft[],
  now?: () => Date,
): PortablePlaylistV1;
export function encodePortablePlaylist(value: PortablePlaylistV1): string;
export function decodePortablePlaylist(value: unknown): PortablePlaylistV1;
export function encodePlaylistFragment(value: PortablePlaylistV1): string;
export function decodePlaylistFragment(fragment: string): PortablePlaylistV1 | null;
export function playlistShareUrl(base: URL, value: PortablePlaylistV1): URL | null;
export function playlistFile(value: PortablePlaylistV1): File;
```

The portable decoder reuses domain factories and the same assignment/effect invariants
as draft decoding without accepting storage-only fields. Canonical encoding preserves
entry and assignment order exactly. Base64url conversion must operate on UTF-8 bytes,
not `btoa` over JavaScript Unicode strings. The transport adapter owns clipboard, Web
Share, object-URL download, and object-URL revocation; codecs remain environment-pure.

**Acceptance Criteria**:

- [ ] Unicode names/notes and all role/custom/effect content round-trip exactly in order;
  malformed, duplicate-placement, unknown-version, invalid-color/effect, and oversized
  fragment inputs fail with typed path-specific errors before repository access.
- [ ] Local UUID/revision/installation/Trash state never appear in the portable envelope;
  provider identity remains complete and namespaced.
- [ ] URL fragments round-trip without server-visible query data when within the 1,800
  character boundary; over-limit payloads return no URL and always produce a complete
  correctly named JSON file.
- [ ] Missing local memberships block export with the exact list position; no entry is
  truncated, reordered, or discarded.

### Unit 2: Previewed import transaction and sharing UI

**Files**: new
`web/src/playlists/{portable-import,PlaylistShareDialog,PlaylistImportDialog}.tsx`,
focused tests, `web/src/playlists/PlaylistLibrary.tsx`, `web/src/playlists/playlists.css`,
`web/src/app/CruxControlWorkspace.tsx`, and `web/e2e/local-route-editor.spec.ts`
**Story**: `epic-playlists-portable-sharing-import`

```typescript
export interface PlaylistImportPlan {
  readonly source: PortablePlaylistV1;
  readonly localCopyCount: number;
  readonly providerReferenceCount: number;
  readonly unresolvedProviderCount: number;
  readonly warnings: readonly string[];
}

export interface PlaylistImportResult {
  readonly playlist: LocalPlaylist;
  readonly createdClimbs: readonly LocalClimbDraft[];
}

export function planPlaylistImport(
  source: PortablePlaylistV1,
  installation: ConfiguredBoardInstallation,
): PlaylistImportPlan;
export async function executePlaylistImport(
  plan: PlaylistImportPlan,
  drafts: LocalDraftRepository,
  playlists: LocalPlaylistRepository,
): Promise<PlaylistImportResult>;
```

Import planning rejects snapshots for a different definition/layout or unsupported
angle before confirmation. Execution creates each fresh climb against the active
installation while preserving Draft/Finished status and content, remaps local snapshot
positions to returned IDs, and creates the list last. On failure, delete each created
copy with its current revision in reverse order; throw an error containing both the root
failure and any cleanup failures.

Add Share to the selected list and Import list to the Lists collection. Share preview
truthfully chooses link/file capabilities. File input is size-limited before reading,
then parsed/decoded into the same preview as a startup hash. Confirmation shows list
name, counts, warnings, and that copies will be created. Success selects the new list,
refreshes climbs/playlists from repository truth, and clears an imported hash with
`history.replaceState`; cancel also clears only that hash. Errors retain the preview and
offer retry without duplicating a successful prior attempt.

**Acceptance Criteria**:

- [ ] URL and file imports share one strict preview path and perform zero writes before
  confirmation; malformed/incompatible/oversized input is recoverable and explicit.
- [ ] Confirm creates fresh local climb/list IDs, preserves exact mixed entry order and
  content, never updates existing records, and keeps provider entries even unresolved.
- [ ] Mid-import failure compensates all created copies when possible and reports root
  plus cleanup failures; retry starts from repository truth and cannot silently duplicate
  a successful import.
- [ ] Share offers Copy link only under the URL limit, Download for every valid export,
  and Web Share only when supported; all async outcomes have truthful accessible status.
- [ ] Compact Android and wide layouts retain list management/play-through actions and
  use labelled 44px controls, focus restoration, and no horizontal overflow.

## Implementation Order

1. Portable codec/export/transports — lock the security and interoperability boundary.
2. Import planner/executor and dialogs — consume the verified envelope and repository
   ports, then integrate with the Lists workspace.

## Testing

- Pure codec tests use Unicode, local/provider mixtures, effects, boundary lengths, and
  every structural validation path; generated JSON is inspected for forbidden local
  authority fields.
- Import tests use in-memory/mock repositories to prove no pre-confirm writes, ordered ID
  remapping, compatibility rejection, partial-create compensation, cleanup-error
  reporting, and no updates.
- Component tests inject clipboard/share/download/history adapters and cover link/file
  fallback, file-size/read/parse failures, preview/cancel/confirm/retry, focus, and status.
- Playwright exports a locally authored two-climb list, imports the downloaded payload as
  a new list, reloads, and verifies new IDs with preserved climb content and list order.

## Risks

- **Payload amplification**: reject files/fragments above a conservative byte limit and
  bound entry/assignment/effect/string counts before allocating deeply. File remains the
  lossless fallback for valid payloads beyond URL size.
- **Cross-database partial failure**: compensation is explicit and tested; cleanup failure
  is surfaced with the IDs left behind rather than masked as success.
- **Schema drift**: the portable schema is independent from storage schemas and versioned
  at its own boundary. Unknown versions fail closed; future versions add a migration.
- **Sensitive URL leakage**: payload lives in the fragment, not query/path, and the import
  dialog clears it after success or cancel. The UI explains that a shared payload contains
  the listed local climb snapshots.
- **Browser capability variation**: adapters probe `navigator.share`, `canShare`,
  clipboard, and object URLs at use time; Download remains the baseline path.
- **Imported effects or placements unsupported locally**: validation uses the active
  definition/layout before writes. The escape hatch is a blocked preview, never a
  degraded or partially stripped climb.

## Implementation notes

- Execution capability: GPT-5.6 Sol at xhigh reasoning. The feature owns an
  independently versioned untrusted-input boundary, browser capability adapters,
  multi-repository compensation, and responsive interaction, so the parent retained
  one feature-owning worker across both child units.
- Review weight: standard (caller and project convention). Implementation stops at
  `stage: review` for the autopilot orchestrator's independent review pass.
- Implementation commits: `c4ec44d` (`epic-playlists-portable-sharing-codec`) and
  `3be978c` (`epic-playlists-portable-sharing-import`). Both child stories are `done`.
- Files changed: strict portable types/codec/export/transport/history/import modules;
  Share and Import dialogs; Lists/workspace/CSS integration; focused codec, domain,
  component, workspace, and Playwright coverage; and current-state architecture and
  specification updates.
- Delivered contract: Unicode-safe exact-order envelope round trips, forbidden local
  authority stripping, path-specific fail-closed validation, bounded fragment/file
  inputs, lossless file fallback, complete namespaced provider references, preview
  before writes, fresh local/list identities, list-last execution, reverse compensation
  with truthful root/cleanup evidence, startup-hash routing and matching-hash clearing,
  injected browser adapters, truthful async status, success deduplication, focus return,
  and compact/wide controls without horizontal overflow.
- Tests added: Unit 1 contributed 26 codec/export/transport tests. Unit 2 contributed 19
  planner/executor/dialog/integration tests plus a production-build Chromium round trip
  that exports and imports a two-climb file, proves fresh IDs and preserved content/order,
  and reloads both persistent lists.
- Simplification: storage rows are never used as wire records; URL and file imports
  converge on one pure decoder/planner; execution is isolated from browser effects; and
  existing playlist, repository, renderer/controller, dialog, button, and status
  boundaries are reused without another persistence or routing system.
- Discrepancies from design: `PlaylistImportPlan` includes the active
  `installationId`, which the designed executor signature otherwise cannot supply to
  `LocalDraftRepository.create`. No provider catalog resolver exists in the current
  installation/runtime contract, so provider entries remain in exact order and are
  truthfully counted unresolved rather than having availability fabricated. Both are
  routine contract reconciliations and require no stored or portable schema migration.
- Documentation: `docs/ARCHITECTURE.md` now describes the portable envelope, adapters,
  preview/compatibility gate, fresh-record execution, and compensation data flow;
  `docs/SPEC.md` records the shipped URL/file, copy/reference, preview, and fresh-ID
  behavior plus browser coverage.
- Adjacent issues parked: none.

## Implementation verification

- Focused Unit 1 verification — 3 files, 26 tests passed.
- Focused Unit 2 verification — 5 files, 32 tests passed (including existing Lists and
  workspace integration coverage).
- Post-child integrated `npm test` — 58 files, 362 tests passed.
- Post-child `npm run typecheck` — passed.
- Post-child `npm run lint` — passed.
- Post-child `npm run build` — TypeScript and Vite production/PWA build passed.
- Post-child `npm -w web run test:e2e` — all 4 Chromium scenarios passed, including
  lifecycle, compact Android-sized interaction, list/play-through persistence, and the
  portable two-climb export/import/reload round trip.

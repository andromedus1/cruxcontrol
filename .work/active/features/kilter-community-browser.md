---
id: kilter-community-browser
kind: feature
stage: review
tags: [ui, data]
parent: null
depends_on: [epic-universal-board-platform-catalog-domain, epic-foundation-catalog-bootstrap]
release_binding: null
gate_origin: null
created: 2026-10-09
updated: 2026-10-09
---

# Browse and light the legacy Kilter community catalog

## Brief

Make the older Kilter community library available for Andrew's Fullride 7x10 in
the working Android/web app. Add a Kilter library destination with explicit
download consent, source/freshness information, offline availability, name/grade/
angle filtering, paginated results and the existing board detail/control surface.
Keep local authoring, playlists and backups independent of catalog availability.

## Strategic decisions

- Andrew prioritized Kilter community access ahead of invited sharing and accepted
  an explicitly labeled older catalog first, followed by current-app coverage,
  on 2026-10-09. This does not establish current first-party catalog coverage.
- Only complete routes compatible with the installed Fullride placements may be
  displayed or lit. Never drop unsupported holds to make a climb fit.
- Reuse the approved responsive browser direction and current design system.
  Mock the new installation, availability and filtering states before production UI.
- Initial acquisition uses the existing privately restored snapshot and same-origin
  manifest. Do not commit community database binaries or publicly deploy them
  without the existing distribution gate. An unavailable download must leave local
  climbs and playlists fully usable.
- No new board manufacturer, Kilter account writeback, shared service, live sync or
  device migration belongs to this slice. Catalog-source absence must remain clear.

## Simplification opportunity

Compose the typed query adapter, existing board renderer and light controller.
Avoid another route editor or copying catalog rows into authored climb storage.

## Mockups

- Existing direction: `.mockups/screens/epic-climb-browser/option-hybrid.html`.
- Installation/filter refinement: `.mockups/screens/kilter-community-browser/index.html`
  (comparison committed in `94bd91b`).
- Option 1 — **Source in view**: `.mockups/screens/kilter-community-browser/option-1.html`.
  A persistent source strip keeps installation, progress, cancellation and recovery
  visible beside the older-snapshot label.
- Option 2 — **Catalog on demand**: `.mockups/screens/kilter-community-browser/option-2.html`.
  A compact source/status row opens catalog management in a dialog, leaving more
  room for browsing after installation.
- **Selected: Option 2**, explicitly approved by Andrew on 2026-10-09. Implement
  the compact source/status row and Manage dialog with the existing responsive
  list/detail layout.
- Both refine the approved list-first phone / split desktop direction with the
  existing design-system tokens, components and motion. A mock toolbar exposes
  not-installed, downloading, installed/offline, failed and unavailable states;
  no mock performs catalog downloads, storage or Bluetooth operations. Synthetic rows
  exercise name/grade/angle filters, pagination and accessible climb details.
- Source wording is **Legacy Kilter / older offline snapshot / no live updates**.
  No freshness date or production route count is asserted. The explicit download
  invitation uses the manifest's rounded 5.1 MB download and 12.4 MB catalog data.

## Acceptance boundary

Browse/filter/select and light installed compatible legacy climbs offline, with
truthful source labels and graceful unavailable/failed download states. Preserve
local authored records and playlist order through installation and browser reload.
Implementation follows the contracts below and waits for both declared dependencies
to reach an implementation-eligible stage. Design completion does not claim that
the catalog can already be installed or browsed.

## Grounding and ownership

Read the project rules, knowledge navigator, foundation catalog/local-ownership
contracts, the approved mock, and the completed local browser direction. Concrete
integration points are `create-runtime.ts`, `CruxControlWorkspace.tsx`,
`LocalClimbViewer.tsx`, `ClimbDetail.tsx`, `use-editor-lighting.ts`, and
`pwa/update-service.ts`. Read the query feature's typed interface and bootstrap's
manifest, receipt, RPC, and lifecycle contracts. No project patterns directory
exists; direct reading is sufficient for this cohesive integration feature.

The bootstrap feature owns acquisition validation, worker serialization, OPFS
candidate activation, receipt persistence and pool ownership. This feature owns
the lazy application service, provenance bridge, consent/status UI, update-admission
integration and browser surface. Do not duplicate bootstrap's storage state machine
or query adapter's physical-compatibility rules. No runtime-source refresh research
is needed to compose these existing local contracts.

Design follows engineering and UX principles: keep a user's next action visible,
use familiar dialog/list behavior and touch targets, and keep source status quieter
than climb selection. Reuse current tokens and controls. There are no new design
system primitives or independent mockup requirements. The standard feature review
will inspect the integrated behavior; no second design advisory is commissioned.

## Design decisions

1. **Optional and lazy.** Create a side-effect-free catalog service with the app
   runtime. First entry to Kilter opens one SQLite adapter and checks installed
   status. Local startup does not wait for catalog I/O, fetch a manifest, or create
   a catalog worker. A catalog failure never becomes `App`'s startup failure.
2. **Keep one owner for the session.** The runtime retains the service and worker
   after navigation away, so a consented download can complete while local work
   continues. Runtime teardown aborts download, waits for any started installation,
   and closes the port. Retry after busy/failed worker startup closes the old port
   before creating another. No repeated worker creation on React renders.
3. **Consent in Manage.** Entering Kilter does not download a database. For an empty
   catalog, opening Manage loads bounded manifest metadata to present the source,
   download size, catalog data size and offline-use explanation. Only the explicit
   Download action fetches that exact displayed manifest's binary and installs it.
   Ready startup and opening an installed catalog's source details use the receipt,
   with no network request or automatic replacement.
4. **Keep progress truthful.** Download shows received bytes/declared bytes; verify
   and install show an indeterminate finishing state. Cancellation is available
   during download only. Closing Manage does not cancel an accepted operation;
   users may return to local work. Download failure retains its offer for explicit
   retry. A fresh metadata check must display its new offer before confirmation.
   No catalog delete/reset action or current-source updater is introduced here.
5. **Truthful source labels.** Compact row: `Legacy Kilter`, availability, and
   `Older offline snapshot · no live updates`. Manage shows the known manifest
   generation date as a generation date, separately from unknown source freshness.
   Never derive a freshness claim from `installedAt`, `generatedOn`, or today's
   date. Show no layout-wide count as the number of compatible Fullride climbs.
6. **Bound browsing.** Request 25 results per page, one bounded query per action;
   use explicit Next/Previous with a cursor history, not infinite scrolling or an
   automatic full-catalog refill loop. Show page number and this page's count,
   never a fabricated total or “page X of Y.” Empty pages with `nextCursor` explain
   that the search can continue and keep Next enabled.
7. **Filters match the selected mock.** Name search, one grade select (`All grades`
   plus adapter-provided labels), and supported angle select. A chosen grade sets
   equal min/max native values; this first UI does not add a separate range editor.
   Default angle is `runtime.installation.config.angle` (currently 40°). Name is
   debounced 200 ms and constrained to 200 characters. Grade/angle act immediately.
   Reset clears name/grade and restores the configured angle.
8. **Selection is deliberate.** Query/filter/page/snapshot changes clear selection
   immediately, before a debounce or pending request completes. Never select the
   first returned row automatically. An angle change alters catalog viewing only;
   it does not move the physical board or mutate the installation/local climbs.
   The user selects a returned row to see/light that climb at that angle.
9. **Reuse automatic lighting.** `ClimbDetail` already mounts `useEditorLighting`:
   a selected route lights after the existing delay when connected/foreground, and
   connection while selected also lights it. Preserve that behavior and controller
   queue/capacity policy; add no competing send effect or mandatory extra light
   button. Dismissal/unmount cancels scheduled work under the existing hook; an
   already-sent scene stays on the board until another selection or Clear. Do not
   promise cancellation of an already in-flight Bluetooth write.
10. **No authored-data conversion.** Catalog details are read-only, with no edit,
    finish/trash/delete, save-copy, or list-membership action in this slice. Existing
    authored playlists and backups stay usable and unchanged. Provider playlist
    membership/resolution can follow as separate scope once browsing is proven.

## Architectural choice

**Chosen: a runtime-owned lazy service, a small React browser, and two composition
slots in the existing viewer.** The service translates installed receipts into the
query adapter and coordinates consented fetch/install. The workspace observes its
operation state for update admission even when Kilter is not visible. React owns
filters, page cursors, current rows, selection and dialog visibility; it does not own
worker lifetime or installation state.

Alternatives: opening the catalog in `createCruxControlRuntime`'s awaited startup
would couple healthy local work to optional storage support; putting acquisition
and worker lifetime inside the browser component would lose progress and cleanup
ownership when navigating to local work. Duplicating the list/detail UI would also
fork its responsive dialog, focus and lighting behavior. The selected composition
keeps those existing behaviors under their present owners.

## Implementation units

### Unit 1: Lazy catalog application service — trickiest unit

**File:** `web/src/catalog/service.ts`.

```typescript
import type { BoardDefinition } from '../domain/boards/definition.ts';
import type { CatalogPort } from '../data/port.ts';
import type {
  CatalogBootstrapPort, CatalogFailureCode, CatalogStorageStatus,
} from '../data/catalog/bootstrap-port.ts';
import type { CatalogManifest } from '../data/catalog/manifest.ts';
import type { CatalogDownloadProgress } from '../data/catalog/bootstrap.ts';
import type { CatalogQueryPort } from './types.ts';

export type CatalogOperation =
  | 'idle' | 'opening' | 'checking-offer' | 'downloading' | 'installing';

export interface CatalogServiceSnapshot {
  readonly storage: CatalogStorageStatus | null;
  readonly operation: CatalogOperation;
  readonly offer: CatalogManifest | null;
  readonly progress: CatalogDownloadProgress | null;
  readonly error: Readonly<{ code: CatalogFailureCode; message: string }> | null;
  readonly queries: CatalogQueryPort | null;
}

export interface CatalogService {
  getSnapshot(): CatalogServiceSnapshot;
  subscribe(listener: () => void): () => void;
  start(): Promise<void>;
  loadOffer(): Promise<void>;
  installOffer(): Promise<void>;
  cancelDownload(): void;
  retryOpen(): Promise<void>;
  close(): Promise<void>;
}

export interface CatalogServiceDependencies {
  readonly createPort: () => CatalogPort & CatalogBootstrapPort;
  readonly fetcher: typeof fetch;
}

export function createCatalogService(
  definition: BoardDefinition,
  dependencies: CatalogServiceDependencies,
): CatalogService;
```

**Implementation notes:**
- Initial state is unopened (`storage:null`, operation idle, no offer/query/error).
  Construction performs no external operation. Snapshot objects are stable until
  a real state change so `useSyncExternalStore` can consume them safely.
- `start` coalesces simultaneous calls, lazily creates the port, reads
  `catalogStatus`, and publishes empty, ready, or unavailable distinctly. Expected
  failures publish state rather than escape as unhandled event-handler promises.
  The existing `CatalogPort` is reused for `createKilterCatalog`; never open a
  second worker to query the same catalog.
- For a ready receipt, bridge its manifest to query provenance exactly:
  `source: 'Legacy Kilter (Aurora)'`, `snapshotId: manifest.sha256`,
  `retrievedAt: null`, and coverage indicating an older offline snapshot with
  current first-party coverage unknown and no live updates. Display generation
  and installation dates from the receipt separately in Manage. Preserve a stable
  query object while the receipt/digest remains unchanged.
- `loadOffer` uses bootstrap's bounded `fetchCatalogManifest`; it is metadata only.
  Invoke for empty setup or explicit Check again, never automatically for a valid
  installed receipt. `installOffer` requires an existing offer and performs
  `fetchCatalogSnapshot` then `installCatalog` with that exact manifest. Guard
  duplicate requests; set downloading synchronously before starting I/O and move
  directly to installing without an intervening idle state.
- An AbortController cancels download and late completion is generation-guarded.
  Check cancellation again before calling `installCatalog`. Once installing,
  cancellation cannot terminate the worker or interrupt receipt activation. Keep
  the offer after a download failure so Retry downloads the same approved version.
  Preserve worker failure codes; fetch helpers' typed codes take precedence, with
  contextual manifest/network fallback if an unexpected error lacks a code.
- Installation suspends `queries` before activation so UI cannot issue reads using
  old provenance after a snapshot swap. On success, compose a query adapter from
  the committed receipt. On an anticipated failed result with `retained`, restore
  that receipt's query adapter. On unexpected RPC failure, discard the worker and
  expose retry; reopening recovers the receipt rather than guessing whether commit
  occurred. No status callback from an obsolete generation may overwrite new state.
- `retryOpen` closes/terminates an unavailable worker through its normal adapter
  close method, then opens a new one. Ignore repeated calls while a service operation
  is active. A ready catalog is not silently closed to retry a metadata download.
- `close` is idempotent: mark disposed, abort fetch, wait for any begun install,
  close the port, clear listeners/references and settle cleanup. No future call
  recreates a disposed service. Dispose-only cleanup catches close failure after
  the adapter has run its guaranteed termination; ordinary active failures remain
  visible. Do not forcibly kill a worker midway through successful activation.

**Acceptance:**
- [x] Construction and local startup perform no catalog I/O; first Kilter entry
      creates at most one worker and ready reopen makes no network request.
- [x] A binary is requested only after explicit confirmation of the displayed offer.
- [x] Cancellation, duplicate clicks, late responses and retry cannot start an
      unapproved install or overwrite the service's current generation.
- [x] Progress remains owned and update-blocking across destination changes;
      teardown closes one worker without interrupting an accepted install.
- [x] Provenance represents the installed digest and preserves unknown freshness.

### Unit 2: Runtime and update-admission integration

**Files:** `web/src/app/create-runtime.ts`, `web/src/app/CruxControlWorkspace.tsx`.

```typescript
// Add to the existing contracts; all current members remain.
interface CruxControlRuntime {
  readonly catalog: CatalogService;
}
interface CruxControlRuntimeDependencies {
  readonly createCatalog?: (definition: BoardDefinition) => CatalogService;
}
// WorkspaceDestination gains 'kilter'.
```

**Implementation notes:**
- Composition imports `SqliteCatalogPort` and creates the service with a lazy
  `createPort: () => SqliteCatalogPort.create()` and injected/global fetch. This
  places the actual worker/WASM in the Vite production graph without constructing
  it during local startup. Do not add a native/iPhone prerequisite or platform-name
  gate; unsupported catalog storage is a local service state.
- Keep the runtime's current synchronous `close():void` contract. It initiates the
  service's internally settled async close and closes the independent authored
  databases as before. Service tests await its own `close()` for cleanup evidence.
  Update runtime test fixtures to supply the new member; do not add compatibility
  branches merely to keep stale test doubles unchanged. The iOS prototype's spread
  runtime inherits the service lazily, keeping native startup unchanged.
- Add Kilter after Lists with no fabricated global count. Keep current My Climbs
  initial destination. Explicitly narrow local-only collection branches so
  `collectionCopy`, draft filtering, lifecycle actions and screenshot-import
  controls never receive the catalog destination.
- Subscribe to the service in the workspace, outside destination/editor branches.
  Merge downloading/installing into its single existing `workspaceBlockReason`
  computation; only the workspace calls `updateService.setBlocked`. The Manage
  dialog reports its open state to the workspace and also blocks updates while
  open. Preserve all existing editor/pending-write/list/board blockers. No second
  service subscription may independently clear a still-valid blocker.
- Existing `updateBlocksWorkspace` inert behavior covers all catalog controls.
  Closing Manage or switching to local work leaves the download/install blocker
  until the service settles. Passive query/open reads need no new update blocker.

**Acceptance:**
- [x] Unsupported/busy/failed catalog state leaves My Climbs, Drafts, Trash, Lists,
      backup/restore and board controls usable.
- [x] Pending catalog work still blocks update after switching destinations or
      entering the local editor; finishing it does not clear another active blocker.
- [x] App/runtime teardown does not create an unhandled rejection or leave a worker
      lease permanently held.
- [x] Production build includes the actual catalog worker/WASM via normal app imports.

### Unit 3: Approved browser and Manage dialog

**Files:** `web/src/catalog/CatalogBrowser.tsx`,
`web/src/catalog/CatalogManageDialog.tsx`, `web/src/catalog/catalog.css`, and
`web/src/climb-browser/LocalClimbViewer.tsx`.

```typescript
export interface CatalogBrowserProps {
  readonly service: CatalogService;
  readonly definition: BoardDefinition;
  readonly defaultAngle: number;
  readonly controller: BoardLightController | null;
  readonly onManageOpenChange: (open: boolean) => void;
}
export function CatalogBrowser(props: CatalogBrowserProps): React.JSX.Element;

export interface CatalogManageDialogProps {
  readonly service: CatalogService;
  readonly onClose: () => void;
}
export function CatalogManageDialog(props: CatalogManageDialogProps): React.JSX.Element;

// Add two optional composition slots to LocalClimbViewerProps:
// readonly listHeader?: React.ReactNode;
// readonly listFooter?: React.ReactNode;
// Render inside the existing list pane, after its heading / after list-or-empty.
```

**Implementation notes:**
- `CatalogBrowser` calls `service.start()` on mount and subscribes to its snapshot.
  It never closes the service on destination unmount. Cleanup invalidates query
  generations, clears timers, dismisses detail/Manage, and reports Manage closed.
- Compact source row and Manage dialog follow selected Option 2. Manage uses a
  native modal dialog with labelled heading, meaningful actions, Escape/Done close,
  focus containment and focus return to Manage/setup trigger. Close the selected
  detail before opening Manage to avoid competing native modal dialogs; do not
  restore a selection automatically on close.
- Empty state offers Set up offline catalog. Busy state offers Retry catalog and
  explains another CruxControl tab owns this catalog; unsupported state explains
  catalog storage is unavailable while local work remains usable. Failed metadata
  offers Check again; failed binary/installation offers contextual Retry when the
  storage contract permits it. Do not suggest clearing site data. Ready state shows
  Available offline based on installed status, not `navigator.onLine`.
- Use real sizes from the offered/installed manifest and bounded download progress.
  Keep unknown freshness explicit. Installed Manage shows receipt details; do not
  introduce automatic refresh, deletion or publication controls beyond the mock.
  Closing the dialog during background download/install is allowed; cancellation
  remains the separate download-only action.
- Supply filters/status through `listHeader`, pagination/retry through `listFooter`,
  and catalog rows to the existing controlled viewer. Dynamic empty copy distinguishes
  loading, unavailable, no matches, read failure, and an empty continuable page.
  Show `excludedCount` only as a scoped informational message if needed; never
  describe it as a whole-catalog total.
- Load grade choices once per query-adapter identity; take labels/values from
  `grades()` and angles from the definition. Query the same snapshot at the default
  angle. Do not parse “V” strings into invented numeric difficulty values.
- Keep only one page of rows and a history of starting cursors. Previous reissues
  that page's cursor; Next uses current `nextCursor`. Grade/filter/snapshot changes
  reset history. Each action performs one bounded adapter query. Selection clears
  synchronously on user filter input/page action even before name debounce fires.
- Use a monotonically increasing request generation and current adapter identity.
  A result or error may update rows, cursors, status, or selection only for its
  current generation. Snapshot suspension/replacement and unmount invalidate all
  pending reads. Loading/read failure cannot leave an old climb selected under
  newly displayed filters. Failed reads retain filter values and offer an explicit
  retry; they do not mutate storage or loop automatically.
- Pass `controller` through the existing viewer/detail path, without new lighting
  effects or provider SQL in React. Preserve the modeless wide detail and modal
  phone detail, roving row focus and return focus. No catalog authoring callbacks.
- Reuse tokens, 44px minimum controls, focus styles and reduced-motion defaults;
  disable only actions whose own prerequisite is unavailable. Announce progress
  and query results through a bounded polite status region, not every raw byte.

**Acceptance:**
- [x] Option 2 works at phone and desktop sizes, with keyboard-accessible Manage,
      filters, pages and detail focus restoration.
- [x] Source labels, sizes, availability and generation/freshness wording derive
      from the correct offer or installed receipt without current-library claims.
- [x] Rapid search/angle/page changes and snapshot replacement cannot reveal/light
      a stale selection; connecting a board lights only the currently selected route.
- [x] Empty continuable pages retain Next, exhausted pages disable it, and all
      pagination remains bounded without invented counts or infinite refill.
- [x] Browsing, selecting and lighting create no authored climb or playlist record.

## Implementation order and checkpoints

1. Confirm bootstrap/query implementations provide the contracts above; implement
   service and lifecycle tests first, including cancellation and activation timing.
2. Wire the lazy runtime and the workspace's existing admission calculation.
3. Implement selected mock composition, bounded page/filter state and stale-response
   tests using the existing viewer and real controller seam.
4. Run production application smoke with a synthetic snapshot and offline reopen,
   then required verification and one standard independent feature review.

No child stories: service, workspace and browser form one cohesive implementation
stride with one owner and shared acceptance evidence. Child items would not create
useful independent delivery boundaries. Do not dispatch implementation until both
declared feature dependencies are eligible. Storage advisory findings may refine a
dependency contract; reconcile any material change here before consuming it.

## Testing

- **`web/src/catalog/service.test.ts`**: lazy construction/coalesced open; ready
  receipt without network; metadata without binary; exact offered manifest on
  explicit install; duplicate-click guard; abort including late resolved download;
  uninterrupted downloading-to-installing blocker; retained receipt on failed
  install; unexpected RPC failure requiring reopen; busy close/retry; dispose waits
  for activation and never reopens or publishes obsolete state. Mock the typed
  storage boundary, not the SQLite/VFS internals this feature does not own.
- **`web/src/catalog/CatalogBrowser.test.tsx`** and **Manage dialog tests**:
  synthetic query port, deferred competing query promises, fake timers for debounce,
  grade choices and default angle, bounded empty-page continuation/Previous/Next,
  source dates and consent actions, progress/abort/error states, and modal focus.
  Use the real Fullride controller with `MockBoardByteTransport` for a selected
  synthetic climb to assert complete role-preserving scene dispatch and that stale
  responses/filter changes do not mount/light another climb. Do not mock away the
  existing `ClimbDetail` lighting seam in that behavioral test.
- **Existing runtime/workspace tests**: prove catalog startup is absent from normal
  startup, local workflows survive unavailable/busy/catalog failures, and update
  admission remains blocked across destination/editor navigation until the exact
  operation settles. Test overlapping blockers so catalog completion cannot unlock
  a pending local save or connected-board session.
- **`web/e2e/catalog-browser.spec.ts`**: run the real production application, worker,
  WASM and OPFS in an isolated Chromium context. Reuse the bootstrap feature's
  synthetic schema/SQLite generator helper rather than another fake catalog format.
  Intercept `/catalog/` before navigation so tests never consume the ignored real
  database. Verify no binary request before Download, consented install and matching
  source label, name/grade/angle results, complete rendered route, and responsive
  Manage/detail behavior. Seed synthetic drafts, finished climbs, Trash, effects and
  an ordered playlist; compare raw authored records and membership order exactly
  before/after catalog installation and reload.
- In that production test, wait for the real service worker/app-shell cache to be
  ready, remove synthetic network fulfillment, set the context offline and reload.
  Enter Kilter: the receipt reopens the actual catalog with correct results and no
  manifest/binary request. This proves app wiring/offline assets in addition to
  bootstrap's nonvisual persisted reopen. Verify the compressed DB is absent from
  the service-worker precache. Keep raw community data, personal libraries and
  device IDs out of traces/artifacts.
- **Division of evidence**: bootstrap owns fault injection around digest/gzip,
  slot/receipt commit, pool lease and worker cleanup in its focused real-worker
  harness. This feature owns consent-to-browse production integration and authored
  library preservation. The existing worker-build feature owns durable artifact
  emission assertions; it should consume this normal build graph, not invent a
  second app entry. Do not repeat the entire storage-failure matrix in UI tests.

Run targeted feature tests, web typecheck/lint/unit suite/build and relevant browser
workflows; ensure required CI succeeds. Check the existing iOS prototype browser
smoke because its runtime inherits the new lazy service, without claiming native
catalog storage or physical iPhone acceptance. No phone-maintenance operation or
public deployment is part of this feature's tests.

## Risks

- **Cancellation versus activation is the trickiest seam.** A download can be
  aborted; a worker installation must settle normally. Continuous operation state,
  generation checks and teardown tests prevent premature reload/termination.
- **Late query results can light the wrong selection.** Clear selection immediately
  and gate every async completion by query generation and adapter identity. Keep
  automatic lighting solely inside the existing detail lifecycle.
- **Native storage remains unproven.** Lazy capability failure isolates the catalog
  from the shared app's local/native startup. No fallback engine or native migration
  is implied by this Android/desktop delivery.
- **Ready receipt and query provenance can diverge during activation.** Suspend
  queries before install and rebuild from the committed/retained receipt afterward;
  never pair new bytes with old source metadata or old cursors.
- **Legacy availability is not current coverage.** Older-first authorization allows
  useful browsing now. Source acquisition, licensing/public redistribution and
  current first-party coverage remain separately owned; no current-data promise or
  raw binary enters this PR.

## Implementation notes

- Execution capability: Codex inline, one feature owner. The service lifetime,
  update admission and browser selection form one cohesive contract and share a
  production integration test.
- Review weight: `standard`, from `.work/CONVENTIONS.md`.
- Files changed: `web/src/catalog/{service.ts,service.test.ts,test-service.ts,CatalogBrowser.tsx,CatalogBrowser.test.tsx,CatalogManageDialog.tsx,CatalogManageDialog.test.tsx,catalog.css}`;
  `web/src/app/{create-runtime.ts,create-runtime.test.ts,CruxControlWorkspace.tsx,CruxControlWorkspace.test.tsx,CruxControlWorkspace.css}`;
  `web/src/climb-browser/{LocalClimbViewer.tsx,LocalClimbViewer.test.tsx,ClimbDetail.tsx,types.ts}`;
  runtime-fixture updates in `web/src/{App.test.tsx,route-editor/create-save-light.test.tsx,route-editor/sparse-effects-save.test.tsx}`;
  and `web/e2e/catalog-browser.spec.ts`.
- Tests added: typed service lifecycle and race tests; browser query/debounce,
  pagination, selection and real controller scene tests; Manage consent/progress/
  freshness tests; runtime composition and overlapping update-blocker tests; and a
  production Playwright test that installs the shared synthetic SQLite fixture and
  compares authored IndexedDB rows and ordered playlist membership through reload.
- Simplification: reuse the installed typed query adapter, runtime-owned SQLite
  port, existing Fullride viewer/detail and lighting controller. No route copy,
  parallel lighting effect, catalog worker lifetime in React, or second list UI.
- Implementation refinements: production e2e caught and fixed a split-pane filter
  overflow; grade controls now fit the default label, setup copy appears once, and
  small artifact sizes use B/KB units. Manage distinguishes compressed download,
  raw data per snapshot and the two-slot retention allowance.
- Discrepancies from design: none. The test fixture is deliberately much smaller
  than the ignored bundled catalog, so consent and size assertions derive from its
  exact validated manifest.
- Adjacent issues parked: none.
- Verification: `npm test -- --reporter=dot` (95 files, 781 tests); `npm run lint`;
  `npm run build -w web` (catalog worker and wa-sqlite WASM emitted); normal app
  Playwright (14/14); iOS prototype Playwright (1/1). The catalog e2e used the real
  production app, worker, WASM, OPFS and service worker, confirmed no binary request
  before consent, offline receipt reopen without catalog requests, and absence of a
  `.db`/`.gz` artifact from CacheStorage. Bootstrap's separate Chromium harness was
  reported green by its owner (5/5).
- Review artifacts: isolated synthetic screenshots are under
  `/tmp/cruxcontrol-kilter-community-browser/` and are not part of the repository.
- Limitations: physical iPhone catalog storage and live/current Kilter coverage
  remain unproven. Vite reports the main app bundle at about 509 kB minified (about
  154 kB gzip), over its 500 kB advisory threshold; no code-splitting change was
  included in this feature.

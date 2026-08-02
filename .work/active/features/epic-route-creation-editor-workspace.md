---
id: epic-route-creation-editor-workspace
kind: feature
stage: review
tags: [ui, ble]
parent: epic-route-creation
depends_on:
  - epic-route-creation-local-draft-library
  - epic-climb-browser-fullride-renderer
  - epic-board-control-light-scenes
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Visual Route Editor and Connected Lighting

## Brief

Deliver the responsive Fullride route-setting workspace that completes the local
create-save-light loop. The editor composes the existing definition-driven renderer,
local draft library, installation/controller contract, and compact browser patterns.
The user can tap or keyboard-activate any physical hold, cycle or directly assign the
four semantic roles, remove assignments, edit primary and optional metadata, save at
any time, reopen a draft, and send its current scene to the board with a persistent
“Light draft” action.

Advanced Light mode assigns any of the controller's 256 quantized colors to individual
holds while preserving semantic climb roles as the ordinary authoring mode. Optional
Live Preview is visibly off by default and uses the completed controller's bounded
latest-frame-wins preview operation when enabled. The workspace exposes explicit
connect/reconnect and truthful busy/error states, but it does not encode protocol
bytes, access Web Bluetooth directly, validate for Kilter publication, query a
catalog, publish/authenticate, schedule animations, or implement party mode.

## Epic context

- Parent epic: `epic-route-creation`
- Position in epic: user-visible integration capability consuming the local draft
  library plus completed renderer and board-control features.

## Inherited design decisions

- Drafts can be saved and lit in any state; no required starts, finishes, role counts,
  grade, or description gate either action.
- Name and angle lead the editing surface; grade, description, and setter notes are
  optional.
- A hold tap cycles `unused → start → middle → finish → foot-only → unused`; an
  explicit role toolbar supports direct assignment.
- Ordinary authoring uses green start, blue middle, red/pink finish, and gold/yellow
  foot-only presets. Advanced Light exposes all 256 API-level-3 colors without
  redefining those semantic roles.
- “Light draft” stays persistent. Live Preview is optional, defaults off, and must
  never create an unbounded queue of stale Bluetooth writes.
- Android and desktop Chromium are the direct-control clients. Unsupported transports
  remain usable for offline editing and saving with an explicit browse/edit-only
  state.
- Kilter publication/authentication, catalog work, other boards, iOS control, and
  party/audio visualizers are excluded from this feature.

## Research briefs

- `docs/briefs/data-model.md` — four role semantics and placement-addressed climb data.
- `docs/briefs/hardware-and-protocol.md` — API-level-3 256-color output and physical
  placement-to-LED mapping.
- `docs/briefs/board-control-web-bluetooth.md` — explicit user gesture, serialized
  operations, recoverable failures, and Chromium constraints.
- `docs/briefs/board-rendering-and-filtering.md` — responsive board-forward UI and
  renderer interaction constraints.

## Foundation references

- `docs/ARCHITECTURE.md` — Route Editor composition over Board Renderer and Controller
  Profiles/Transports.
- `docs/SPEC.md` — Route Creation, Board Control, mobile capability, and offline-first
  constraints.
- `docs/PRINCIPLES.md` — wall-session loop, accessibility, local ownership, and
  complementary automated/physical verification.

## Mockups

- Inherits design system: `.mockups/design-system/`
- Responsive composition and board prominence inherit
  `.mockups/screens/epic-climb-browser/option-hybrid.html`.
- Dedicated route-editor mockups pending — see parent epic's
  `## UI alignment deferred` note. Under autopilot, resolve layout from the locked
  compact, touch-safe browser composition rather than inventing a new visual system.

## Design decisions

- **Workspace ownership**: one controlled `RouteEditorWorkspace` owns an editable
  `DraftContent` snapshot and composes the existing repository, renderer, and light
  controller contracts. It never opens IndexedDB, constructs Bluetooth transports,
  converts placement IDs to LEDs, or applies provider validity rules. The application
  shell owns create/open/list navigation and dependency construction.
- **Unrestricted lifecycle**: Create immediately persists an empty draft at the active
  installation's angle, then opens it. Empty names, zero holds, unconventional role
  counts, and any custom colors remain valid for save and light. Name and angle are
  visually primary, not validity gates.
- **Edit tools**: default tool `cycle` advances
  `unused → start → middle → finish → foot-only → unused`. The labelled single-select
  toolbar also offers the four direct roles, Erase, and Advanced Light. A direct tool
  applies only on the next pointer/keyboard hold activation; selecting a tool alone
  never mutates a focused hold.
- **Exact custom colors**: Advanced Light exposes quantized red (`0..7`), green
  (`0..7`), and blue (`0..3`) channels, plus the resulting hardware swatch, expanded
  hex, and packed byte. All 256 values are deliberately selectable; a native 24-bit
  picker may be a convenience but cannot be the sole control.
- **Save and autosave**: edits update memory immediately. After 800 ms idle, autosave
  issues one optimistic update. At most one save runs; edits during it coalesce into
  one latest-state follow-up. Explicit Save cancels the timer and flushes. Success
  adopts the returned revision; failure preserves dirty content. Status is
  `saved | dirty | saving | error | conflict` and never gates lighting.
- **Conflict recovery**: `DraftConflictError` stops autosave and offers Reload stored
  draft or Save a copy; it never overwrites another tab. Other failures offer Retry.
  Navigation prompts only while dirty/saving/error/conflict, not after normal autosave.
- **Lighting**: sticky Light Draft is always rendered. When disconnected it becomes
  “Connect & light” and uses that gesture to connect then send the current in-memory
  scene; when connected it sends directly. It is disabled only when unsupported or an
  explicit operation is active. An empty scene uses the controller's defined clear
  behavior. Save state and route shape never gate it.
- **Live Preview**: opt-in and off on every editor mount. It can be enabled only while
  connected, previews immediately, then debounces assignment changes by 180 ms into
  the controller's latest-frame-wins `preview`. Metadata changes do not preview.
  Disabling/unmounting cancels only the pending UI timer; it does not clear the board.
- **Responsive/accessibility behavior**: below 900 px, metadata/tools are compact, the
  renderer uses scale `2.5` in its pan viewport, and save/light actions use a safe-area
  sticky footer. At 900 px, a 20–24 rem left rail sits beside a scale-1 board. Labels,
  renderer marker shapes, polite status/live regions, 44 px targets, reduced-motion,
  and locked Sumi & Plywood / Wave Console tokens are required.
- **Scope boundary**: no catalog, publication/auth, share/export, logbook/playlists,
  party/audio scheduling, other-board UI, or iOS bridge.

## Architectural choice

Use a reducer-driven React module with a coalescing autosave hook, a debounced lighting
hook, and a thin application composition shell. The reducer is the single source of
truth for editable content, tool, revision, generation, and save status. Pure helpers
own hold cycling/tool assignment; effects only call existing repository/controller
ports. This keeps timing deterministic and reuses completed contracts without new
infrastructure abstractions.

Alternatives considered were independent form/component state (simple fields, but
fragile assignment/revision coordination), save-on-every-event (excess IndexedDB and
BLE work), and a general state-machine dependency (disproportionate for one surface).
The reducer plus two hooks is the smallest testable shape. The trickiest unit is save
coordination: every request captures content generation and expected revision; success
marks saved only if generation is unchanged, otherwise exactly one newest-snapshot
follow-up runs. Conflict halts scheduling until explicit recovery.

## Implementation Units

### Unit 1: Pure editor model and hold tools

**Files**: `web/src/route-editor/types.ts`, `web/src/route-editor/editor-state.ts`,
`web/src/route-editor/assignments.ts`, `web/src/route-editor/index.ts`

```typescript
export type EditorTool =
  | { readonly kind: 'cycle' }
  | { readonly kind: 'role'; readonly role: ClimbRole }
  | { readonly kind: 'erase' }
  | { readonly kind: 'custom'; readonly color: ApiLevel3Color };
export type EditorSaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';
export interface RouteEditorState {
  readonly draft: LocalClimbDraft;
  readonly content: DraftContent;
  readonly generation: number;
  readonly persistedGeneration: number;
  readonly saveStatus: EditorSaveStatus;
  readonly tool: EditorTool;
  readonly persistenceError: Error | null;
}
export type RouteEditorAction =
  | { readonly type: 'set-name'; readonly value: string }
  | { readonly type: 'set-angle'; readonly value: number }
  | { readonly type: 'set-metadata'; readonly field: keyof DraftMetadata; readonly value: string }
  | { readonly type: 'set-tool'; readonly tool: EditorTool }
  | { readonly type: 'activate-placement'; readonly placementId: BoardPlacementId }
  | { readonly type: 'save-started'; readonly generation: number }
  | { readonly type: 'save-succeeded'; readonly draft: LocalClimbDraft; readonly generation: number }
  | { readonly type: 'save-failed'; readonly error: Error; readonly conflict: boolean }
  | { readonly type: 'reload'; readonly draft: LocalClimbDraft };
export function createRouteEditorState(draft: LocalClimbDraft): RouteEditorState;
export function routeEditorReducer(state: RouteEditorState, action: RouteEditorAction): RouteEditorState;
export function cycleAppearance(current?: BoardHoldAppearance): BoardHoldAppearance | null;
export function applyEditorTool(assignments: readonly BoardHoldAssignment[], placementId: BoardPlacementId, tool: EditorTool): readonly BoardHoldAssignment[];
```

**Implementation Notes**:

- Content changes increment generation exactly once; identical values are no-ops.
  Freeze nested values and normalize assignments into definition placement order.
- Empty optional strings are omitted. Angle comes only from supported angles. A custom
  appearance cycles to unused; direct tools overwrite; erase removes. No route-shape
  validation exists.

**Acceptance Criteria**:

- [x] Semantic/custom cycles, overwrite, erase, and empty states are immutable and deterministic.
- [x] Existing `DraftContent` remains the sole persistence model; all unrestricted states work.
- [x] No-op edits do not dirty or trigger persistence.

### Unit 2: Coalescing autosave and conflict recovery

**Files**: `web/src/route-editor/use-draft-autosave.ts`,
`web/src/route-editor/use-draft-autosave.test.tsx`

```typescript
export interface DraftAutosaveControls {
  saveNow(): Promise<void>;
  retry(): Promise<void>;
  reloadStored(): Promise<void>;
  saveCopy(): Promise<LocalClimbDraft>;
}
export function useDraftAutosave(options: {
  readonly repository: LocalDraftRepository;
  readonly state: RouteEditorState;
  readonly dispatch: Dispatch<RouteEditorAction>;
  readonly delayMs?: number;
}): DraftAutosaveControls;
```

**Implementation Notes**:

- Default 800 ms; one timer and active promise. Capture ID/revision/content/generation.
  A changed generation after success schedules one follow-up using the returned revision.
- Detect conflict by type. Reload fetches current identity; Save a copy creates current
  content and replaces editor identity. Missing reload remains recoverable. Register
  `beforeunload` only for at-risk statuses; inject internal navigation confirmation.

**Acceptance Criteria**:

- [x] Burst edits save latest once; edits during save create at most one revision-safe follow-up.
- [x] Explicit flush, retry, reload, and save-copy preserve content correctly.
- [x] Unmount prevents timer completion from updating state; unload warning is truthful.

### Unit 3: Connected-lighting hook

**Files**: `web/src/route-editor/use-editor-lighting.ts`,
`web/src/route-editor/use-editor-lighting.test.tsx`

```typescript
export interface EditorLightingControls {
  readonly controllerState: BoardLightState;
  readonly livePreview: boolean;
  readonly status: 'idle' | 'connecting' | 'lighting' | 'previewing' | 'error';
  readonly message: string | null;
  setLivePreview(enabled: boolean): void;
  lightDraft(): Promise<void>;
}
export function useEditorLighting(options: {
  readonly definition: BoardDefinition;
  readonly assignments: readonly BoardHoldAssignment[];
  readonly controller?: BoardLightController | null;
  readonly previewDelayMs?: number;
}): EditorLightingControls;
```

**Implementation Notes**:

- Use existing `lightSceneFromAssignments`. Default preview is 180 ms. Connect then
  call `light` directly rather than waiting for React state publication. Treat
  `superseded` as normal. Empty scenes pass unchanged; metadata cannot trigger preview.

**Acceptance Criteria**:

- [x] Disconnected light connects then sends once; connected sends once; busy cannot duplicate.
- [x] Preview starts off, sends immediately on opt-in, then only latest debounced assignments.
- [x] Unsupported/errors are truthful; disabling preview never clears the board.

### Unit 4: Responsive editor and exact color control

**Files**: `web/src/route-editor/RouteEditorWorkspace.tsx`,
`web/src/route-editor/RouteEditorToolbar.tsx`,
`web/src/route-editor/ApiLevel3ColorControl.tsx`,
`web/src/route-editor/RouteEditorWorkspace.css`,
`web/src/route-editor/RouteEditorWorkspace.test.tsx`

```typescript
export interface RouteEditorWorkspaceProps {
  readonly definition: BoardDefinition;
  readonly draft: LocalClimbDraft;
  readonly repository: LocalDraftRepository;
  readonly controller?: BoardLightController | null;
  readonly onBack: () => void;
  readonly onDraftIdentityChange?: (draft: LocalClimbDraft) => void;
}
export function RouteEditorWorkspace(props: RouteEditorWorkspaceProps): JSX.Element;
export function RouteEditorToolbar(props: { readonly tool: EditorTool; readonly definition: BoardDefinition; readonly onToolChange: (tool: EditorTool) => void }): JSX.Element;
export function ApiLevel3ColorControl(props: { readonly value: ApiLevel3Color; readonly onChange: (value: ApiLevel3Color) => void }): JSX.Element;
```

**Implementation Notes**:

- One semantic DOM tree across breakpoints. `BoardRenderer` select mode uses scale 2.5
  mobile/1 desktop. Angle select comes from definition. Optional fields use Details on
  phone. Blank stored name is shown as “Untitled climb” only in surrounding copy.
- Color channels compute `apiLevel3Color((red << 5) | (green << 2) | blue)` and display
  `apiLevel3ColorHex` plus packed decimal/hex. Toolbar combines text, role color, and
  marker shape. Sticky footer owns save/live/light; 44 px minimum targets.

**Acceptance Criteria**:

- [x] Pointer and keyboard users can cycle/direct/erase and select all 256 colors.
- [x] Mobile/desktop retain full recognizable board, locked tokens, and persistent actions.
- [x] Statuses and recovery are accessible and never rely on color alone or 305 tab stops.

### Unit 5: Application composition and local-list integration

**Files**: `web/src/app/CruxControlWorkspace.tsx`, `web/src/app/create-runtime.ts`,
`web/src/App.tsx`, `web/src/main.tsx`, `web/src/App.test.tsx`

```typescript
export interface CruxControlRuntime {
  readonly installation: ConfiguredBoardInstallation;
  readonly drafts: LocalDraftRepository;
  readonly controller: BoardLightController | null;
  close(): void;
}
export async function createCruxControlRuntime(): Promise<CruxControlRuntime>;
export function CruxControlWorkspace(props: { readonly runtime: CruxControlRuntime }): JSX.Element;
export function App(props: { readonly createRuntime?: () => Promise<CruxControlRuntime> }): JSX.Element;
```

**Implementation Notes**:

- Runtime opens the draft database/repository, resolves active installation, creates
  one controller, and closes resources best-effort. Initialization failure is retryable.
- Workspace mode is list or edit-ID. List projects repository drafts through
  `toClimbViewRecord`. Create persists empty content with configured angle before open.
  Add an optional Edit callback to local-draft detail only. Back honors leave guard.

**Acceptance Criteria**:

- [x] First launch lists drafts; Create persists/opens empty; reload/reopen restores exact state.
- [x] Saved drafts appear once with stable identity/Edit; init failure is honest/retryable.
- [x] Existing injected viewer/controller consumers remain compatible.

### Unit 6: Integration and real-browser smoke

**Files**: `web/src/route-editor/create-save-light.test.tsx`,
`web/e2e/local-route-editor.spec.ts`, `web/playwright.config.ts`, `web/package.json`

**Implementation Notes**:

- Vitest uses fake IndexedDB plus a deterministic controller fake to create, assign all
  roles/custom byte, autosave, light without validity gate, reopen, and compare.
- Add `@playwright/test` and `test:e2e`. Chromium uses real IndexedDB: create, assign,
  choose exact packed color, wait Saved, reload, reopen, verify. BLE remains a typed-fake
  integration plus the parent's manual hardware checkpoint; do not add prod test flags.
- Assert accessible roles/names and placement IDs, not CSS coordinates or snapshots.

**Acceptance Criteria**:

- [x] Vitest covers create-save-light, empty/unconventional scenes, failures/conflicts, preview races.
- [x] Chromium proves real IndexedDB persistence/reload and accessible editor interaction.
- [x] test, typecheck, lint, build, and e2e pass without claiming automated BLE proof.

## Implementation Order

1. Pure model/tools.
2. Autosave/conflict hook — correctness-critical unit first.
3. Lighting hook.
4. Responsive editor/color control.
5. Runtime/list composition.
6. Integration and Chromium smoke.

## Testing

- `editor-state.test.ts`: cycles, tools, ordering, no-ops, unrestricted states.
- `use-draft-autosave.test.tsx`: fake-timer burst, in-flight edits, flush, failure,
  conflict reload/copy, unmount.
- `use-editor-lighting.test.tsx`: connect/light, empty, unsupported/busy/error, latest preview.
- `RouteEditorWorkspace.test.tsx`: fields/tools, color extremes, keyboard, statuses,
  breakpoints/recoveries.
- `create-save-light.test.tsx`: repository → editor → renderer → controller contracts.
- `local-route-editor.spec.ts`: production-build Chromium persistence/reload smoke.
- Reuse Fullride definition/config, fake-indexeddb, draft fixtures, and typed controller
  fakes; add only deferred-promise timing helpers, never a fabricated catalog.

## Risks

- **Out-of-phase optimistic saves** could mark newer edits saved. **Fallback**:
  generation-tag requests and serialize one active plus one latest pending flush.
- **Dense mobile board** may remain hard at 2.5×. **Fallback**: existing pan/zoom and
  spatial keyboard navigation; tune within renderer's `1..3` contract after hardware use.
- **Connect/state publication race** could suppress lighting. **Fallback**: await connect
  and invoke light directly, not through a subsequent render check.
- **24-bit picker hides quantization**. **Fallback**: 3/3/2-bit channels and packed byte
  are authoritative; native picker is secondary.
- **Browser smoke cannot prove BLE**. **Fallback**: controller contract tests plus the
  already tracked Android Chrome physical Fullride checkpoint.

## Child-story decision

No child stories. The units share one reducer and integration surface; splitting
autosave, lighting, and composition across owners would create unstable intermediate
contracts and duplicate integration work. One implementation owner should take the
feature through standard review.

## Implementation notes

- Execution capability: xhigh; this feature coordinates optimistic persistence,
  responsive UI state, and asynchronous BLE operations across several completed ports.
- Review weight: standard (caller and project convention).
- Files changed: `web/src/route-editor/`, `web/src/app/CruxControlWorkspace.tsx`,
  `web/src/app/create-runtime.ts`, application/browser composition, Playwright setup,
  package metadata, and test-artifact ignores.
- Tests added: pure editor role/custom assignment coverage, responsive workspace and
  exact channel controls, controller-backed empty lighting and immediate preview, plus
  a real-Chromium IndexedDB create/color/save/reload/reopen smoke.
- Simplification: reused `DraftContent`, `BoardRenderer`, `lightSceneFromAssignments`,
  `BoardLightController`, and the local viewer; no parallel editor persistence,
  rendering, protocol, or transport model was introduced.
- Discrepancies from design: the smoke test uses a production preview server rather
  than adding application test flags; physical BLE remains the parent epic's manual
  Android/Fullride checkpoint.
- Adjacent issues parked: none.

## Verification evidence

- `npm test` — 202 tests passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — production PWA build passed.
- `npm -w web run test:e2e` — Chromium create/color/save/reload/reopen passed.

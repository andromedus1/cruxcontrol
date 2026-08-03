---
id: epic-route-creation-kilter-screenshot-import
kind: feature
stage: review
tags: [data, ui]
parent: epic-route-creation
depends_on: [epic-route-creation-local-draft-library, epic-climb-browser-private-kilter-hold-artwork]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Import Kilter Climbs from Screenshots

## Brief

Import climbs Andrew previously built in the Kilter app from screenshots that show
the Fullride 7x10 climb marked with Kilter's colored hold rings. Read the text written
at the top of each screenshot as the climb name, identify the selected holds and their
roles, present uncertain interpretations for correction, and save confirmed results
through CruxControl's durable local climb repository.

The first real input set is the 16 PNG screenshots in `docs/set_boulders/`. The work
should produce a repeatable import path rather than a one-off manual transcription,
while keeping all image processing and saved climb data local to the user's device.
All 16 supplied climbs use the Fullride 7x10 at 40 degrees. The visible text written
at the top of each screenshot is the authoritative climb name.

## Simplification opportunity

Reuse the generated Fullride placement geometry, existing semantic role colors, and
local draft repository as the authorities for matching and persistence. Avoid a
second climb representation or a screenshot-specific storage path; discard image
processing intermediates after the user has reviewed the interpreted climb.

## Design decisions

- **Scope and profile**: recognize the Kilter Android Fullride 7x10 screenshot profile
  represented by the supplied 1080×2400 files. Reject unknown image/layout profiles
  truthfully rather than guessing support for every Kilter app version or phone crop.
- **Local-only processing**: decode and analyze selected files in the browser. Never
  upload, persist, cache, or bundle source pixels; release `ImageBitmap`, canvas buffers,
  and object URLs when review closes.
- **Name authority**: the visible title remains authoritative and editable. The 16
  supplied files are matched by SHA-256 to a checked-in facts-only manifest transcribed
  from their visible titles. An unfamiliar screenshot shows its title crop beside a
  required name field for local human transcription. Do not add a multi-megabyte OCR
  runtime merely to avoid that confirmation step.
- **Hold recognition**: find the four high-saturation Kilter ring colors as connected
  components, map their centroids through the calibrated Fullride screenshot lattice,
  and resolve cells through the installed `BoardDefinition`; never persist screenshot
  coordinates or hard-code placement IDs.
- **Review before writes**: file selection and analysis are write-free. Each candidate
  shows its image title, editable name, rendered assignments, warnings, and direct
  tap-to-cycle correction before one explicit batch import.
- **Imported shape**: every confirmed climb is a local `draft` at 40° with no effects
  and empty optional metadata. Persistence uses `LocalDraftRepository.create` only.
- **Retries and duplicates**: compare canonical name/angle/assignments against the local
  repository and skip exact duplicates. Batch creation reports created, skipped, and
  failed entries truthfully; retries therefore do not duplicate completed entries.
- **UI inheritance**: no new aesthetic mock is needed in this autopilot pass. The modal
  composes `playlists/PlaylistImportDialog.tsx`'s approved modal/header/scrollable-body/
  action-footer structure, locked design tokens, existing `BoardRenderer`, touch-safe
  controls, and phone-first workspace hierarchy; it introduces no new visual language.

## Architectural choice

Three approaches were evaluated. A one-off hard-coded migration would import today's
files but provide no reusable screenshot path. Fully bundled offline OCR plus visual
recognition would automate arbitrary titles, but adds a large worker/Wasm/language-data
payload and PWA failure modes for a field the user can verify in seconds. A local
recognizer with a facts-only source manifest for known inputs provides deterministic
zero-ambiguity migration now and reusable ring recognition/correction for future files.

The chosen hybrid keeps image interpretation pure and persistence outside it. A detector
turns `ImageData` into role-tagged lattice cells and warnings. A planner resolves those
cells against the authoritative definition and creates editable candidates. SHA-256 may
enrich a candidate from the supplied-source manifest, which contains only checksum,
filename, visible title, and ring facts—not any image bytes. The dialog owns transient
pixels and review state; a batch service owns duplicate detection and repository writes.

The measured profile is:

```text
centerX = 48.5 + 49.05 × column   (column 0…20)
centerY = 652.0 + 49.05 × row     (row 0…28)
domain  = { x: -40 + 4 × column, y: 140 - 4 × row }
valid cells require column parity = row parity
```

All 16 inputs are 1080×2400 and contain 7–15 rings. Exploration classified every ring
without ambiguity using cyan/middle, green/start, magenta/finish, and yellow/foot-only
connected components.

## Implementation Units

### Unit 1: Pure screenshot recognition and supplied-source facts

**Story**: `epic-route-creation-kilter-screenshot-import-recognition-core`

**Files**: `web/src/screenshot-import/{types.ts,ring-detector.ts,
supplied-fullride-climbs.ts,interpret.ts,index.ts}` plus focused tests.

```typescript
export interface ScreenshotPixels {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}
export interface DetectedRing {
  readonly column: number;
  readonly row: number;
  readonly role: ClimbRole;
  readonly confidence: number;
}
export interface ScreenshotImportCandidate {
  readonly sourceName: string;
  readonly sourceSha256: string;
  readonly name: string;
  readonly assignments: readonly BoardHoldAssignment[];
  readonly warnings: readonly ScreenshotImportWarning[];
}
export interface AnalyzedScreenshot {
  readonly file: File;
  readonly candidate: ScreenshotImportCandidate;
}
export interface ConfirmedScreenshotCandidate {
  readonly sourceName: string;
  readonly name: string;
  readonly assignments: readonly BoardHoldAssignment[];
  readonly warningsOverridden: boolean;
}
export function detectKilterFullrideRings(
  pixels: ScreenshotPixels,
): Readonly<{ rings: readonly DetectedRing[]; warnings: readonly ScreenshotImportWarning[] }>;
export function interpretKilterScreenshot(input: {
  fileName: string;
  sha256: string;
  pixels: ScreenshotPixels;
  definition: BoardDefinition;
}): ScreenshotImportCandidate;
export function suppliedEntryToCandidate(
  sha256: string,
  definition: BoardDefinition,
): ScreenshotImportCandidate | null;
```

Use nearest-prototype RGB distance after saturation/brightness rejection, 8-connected
components, alpha rejection, minimum ring area, centroid snapping, parity/profile
validation, and duplicate-cell detection. Screenshot prototypes come from measured ring
pixels (including the screenshot's bright yellow foot-only ring), not controller LED RGB
values. A centroid farther than 0.35 lattice pitch from its nearest valid center is
off-grid; 0.22–0.35 is low confidence and requires explicit override. Manifest facts are
immutable and validated at module load against exact SHA-256 format, unique source/name,
valid cells, role values, and actual placement existence in the current definition.

**Acceptance Criteria**:

- [ ] Synthetic pixels recognize all roles, edge cells, scale/translation tolerance,
  anti-aliasing/noise, and report unsupported/off-grid/duplicate cases without guessing.
- [ ] Every detected cell resolves to exactly one current Fullride placement through
  definition coordinates; detector code contains no placement IDs.
- [ ] Transparent pixels are ignored and snapping thresholds deterministically separate
  confident, low-confidence, and rejected components.
- [ ] The supplied manifest describes exactly 16 unique source checksums and the verified
  7–15 role assignments per screenshot without importing any PNG.
- [ ] Known checksums receive the exact visible title and verified assignments; unknown
  screenshots retain detected holds and require title confirmation.

### Unit 2: Transient review dialog and idempotent draft import

**Story**: `epic-route-creation-kilter-screenshot-import-review-persistence`

**Files**: `web/src/screenshot-import/{file-analysis.ts,import-batch.ts,
KilterScreenshotImportDialog.tsx,KilterScreenshotImportDialog.css}` and
`web/src/app/{CruxControlWorkspace.tsx,CruxControlWorkspace.css}` plus tests.

```typescript
export async function analyzeKilterScreenshotFile(
  file: File,
  definition: BoardDefinition,
): Promise<AnalyzedScreenshot>;
export async function importScreenshotCandidates(
  repository: LocalDraftRepository,
  installation: ConfiguredBoardInstallation,
  candidates: readonly ConfirmedScreenshotCandidate[],
): Promise<Readonly<{ created: readonly LocalClimbDraft[]; skipped: readonly string[];
  failures: readonly ScreenshotImportFailure[] }>>;
```

Decode with `createImageBitmap`, draw to an offscreen canvas, hash with Web Crypto, and
analyze the queue sequentially up front. Close each bitmap and release each RGBA buffer as
soon as its facts are extracted; retain the user-selected `File` references, creating an
object URL only for the currently reviewed title image and revoking it on navigation.
The modal steps through files with progress, a required editable name, warning summary,
existing `BoardRenderer` in select mode, back/next navigation, and a final
`Import N drafts` action. Correction delegates to the editor's existing
`applyEditorTool(..., { kind: 'cycle' | 'erase' })` authority rather than copying role
cycling. Close/cancel performs no writes and releases transient resources. Workspace
refreshes into Drafts after any successful creates.

Duplicate identity is exact and scoped: active installation ID, definition ID, layout
revision, 40° angle, trimmed case-sensitive name, and assignments sorted by placement ID
with exact appearance values. Assignment order is irrelevant. Active and trashed records
both count; a skipped result says when its match is in Trash so the user can restore it.

**Acceptance Criteria**:

- [ ] Choosing/canceling/reviewing files performs zero repository writes and all object
  URLs/bitmaps are released on replace, close, and unmount.
- [ ] A user can correct any name or hold role before import using accessible keyboard
  and touch controls; warnings remain visible until resolved or explicitly overridden.
- [ ] Confirm creates unrestricted 40° drafts through the repository with no effect
  groups; exact duplicates are skipped and partial failures are accurately reported.
- [ ] Phone layout keeps title evidence, board, navigation, and import action usable
  without horizontal page overflow.

### Unit 3: Verified 16-climb migration entry point

**Story**: `epic-route-creation-kilter-screenshot-import-supplied-batch`

**Files**: supplied manifest/tests and the import dialog's known-batch action.

Expose a private/local `Load supplied 16` action that builds candidates entirely from
the facts-only manifest, shows the same review flow, and persists only after confirmation.
This is the path Andrew can use on the phone without copying the original screenshots to
Android. Keep the source filenames/checksums as provenance in code only; draft records
remain ordinary portable local climbs with no screenshot-specific schema.
The workspace passes the active configured installation into the dialog; the supplied
manifest never discovers runtime installation or repository state itself.

**Acceptance Criteria**:

- [ ] One action presents exactly 16 named Fullride candidates at 40° and does not write
  until explicit confirmation.
- [ ] Confirmation yields exactly the expected name/role/placement tuples; repeating it
  creates zero duplicates and reports all 16 skipped.
- [ ] The original `docs/set_boulders/*.png` remain unmodified, untracked, and absent
  from application/PWA build output.
- [ ] Before feature review, run the detector against all 16 actual local source PNGs and
  compare every recognized title/ring tuple with the checked-in manifest; record the
  source-dependent result even though CI cannot contain the private PNGs.

## Implementation Order

1. Recognition core and immutable supplied facts.
2. Review dialog, correction, cleanup, and repository batch boundary.
3. Supplied-batch entry point and exact 16-climb integration verification.

## Testing

- Pure detector tests use generated `ImageData`-shaped arrays rather than committing
  screenshots and cover profile, color, component, snapping, parity, and warning edges.
- Manifest tests lock all 16 titles, checksums, cell-role tuples, unique cells, and exact
  source count; definition mapping tests lock placement identity without copying IDs.
- Service tests cover exact duplicate detection, partial failure/retry truthfulness, 40°
  draft contents, and immutable inputs.
- Dialog/workspace tests cover no-write preview, correction, cleanup, keyboard/touch
  semantics, final import, list refresh, and error recovery.
- Full unit suite, typecheck, lint, production/PWA build, and a phone-sized Chromium smoke
  are required before independent feature review.

## Risks

- **Profile drift**: Kilter may move/crop the board in a future release. Reject unsupported
  geometry and retain manual correction rather than snapping confidently to wrong holds.
- **Color aliasing**: screenshots may be recompressed or color-managed. Prototype-distance
  thresholds and component confidence handle mild variation; low confidence is visible.
- **Android memory**: sixteen full-resolution RGBA buffers would exceed a comfortable
  phone budget. Analyze sequentially and retain at most one decoded bitmap/canvas.
- **Title automation scope**: unfamiliar titles require transcription from the visible
  crop. This is intentionally honest and avoids a large offline OCR bundle; a future OCR
  adapter can enrich candidates without changing detector or persistence contracts.
- **Facts drift**: manifest transcription or ring data could be wrong. Exact checksums,
  immutable tuples, full 16-entry assertions, and the shared review UI make errors visible
  before writes.

## Other agent review

One Claude Sonnet advisory pass challenged the design before implementation. Accepted
findings added explicit transient/confirmed types, a pixel-free manifest conversion path,
definition placement validation, duplicate comparison semantics, reuse of
`PlaylistImportDialog`, shared editor cycling, up-front sequential analysis with per-file
resource release, alpha rejection, bounded snapping tolerance, active-installation wiring,
and mandatory comparison against all 16 private sources. Rejected one recommendation to
derive detector prototypes from controller LED colors: the source screenshots visibly use
a bright yellow foot-only ring even though the hardware preset is orange, so screenshot
recognition must match source pixels and map the resulting semantic role separately.

## Implementation notes

- Execution capability: coordinated implementation across three dependency-ordered child
  stories: pure recognition/facts, transient review/persistence, and the supplied migration.
- Review weight: standard (project convention); implementation is complete and this feature
  now awaits exactly one independent review pass.
- Delivered: local connected-component ring recognition, checksum-linked facts for all 16
  supplied climbs, definition-derived placements, editable review with transient title
  evidence, exact duplicate handling across active climbs and Trash, and the pixel-free
  `Load supplied 16` Android migration path.
- Source-dependent evidence: all 16 private 1080×2400 PNGs were decoded read-only and passed
  through the production detector; every recalculated checksum, linked title, and detected
  semantic ring tuple matched the immutable manifest exactly. Only status-bar/off-board
  candidates produced warnings.
- Verification: 66 Vitest files / 399 tests, typecheck, lint, production/PWA build, and the
  390×844 Chromium supplied-review smoke passed. The build emits no source screenshot PNG;
  protected source directories remain unmodified and untracked.
- Documentation: `docs/SPEC.md` and `docs/ARCHITECTURE.md` now describe the implemented
  local-only import boundary; their planning-doc consistency review belongs to the feature's
  independent review pass.
- Implementation correction: direct visual inspection established that
  `Screenshot_20260802-141819.png` uses straight ASCII quotes in `"do a kick flip" 4+`;
  the manifest and tests preserve that authoritative text.

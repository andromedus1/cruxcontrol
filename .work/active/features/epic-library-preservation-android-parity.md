---
id: epic-library-preservation-android-parity
kind: feature
stage: implementing
tags: [data, ble, ui, infra]
research_refs: [independent-library-preservation]
parent: epic-library-preservation
depends_on: [epic-library-preservation-native-library, epic-library-preservation-portable-files, epic-library-preservation-android-catalog]
release_binding: null
gate_origin: null
created: 2026-10-10
updated: 2026-10-10
---

# Use the complete Android wall-session app

## Brief

Complete the remaining native interaction adapters so Andrew can use the app with parity to the shipped web version. Online recovery belongs to automatic-backup; this feature can be implemented without waiting for hosted account setup. Its completion alone does not authorize everyday irreplaceable authoring before the epic’s independent-protection gate passes.

Own Android permissions, chooser/light/clear/effects, pause/reconnect, keep-awake, Android Back/keyboard/safe areas, multiple-image screenshot import, playlist file/clipboard/share delivery and recipient-usable links. Native localhost share URLs are not acceptable. Verify catalog climbs resolve/light/play through from ordered playlists. Provide a stable private signing/install/update path and signing-key retention outside Git, without requiring a public Play Store release.

Acceptance is an actual phone-and-Fullride session using synthetic data after portable recovery, upgrade preservation and full-library semantic comparison pass. The epic owns daily-use admission after online protection and clean-client recovery also pass. Never reset Andrew's profile as a fixture. Catalog downloads are reacquirable and excluded from authored-library backup. This feature does not close physical-iPhone acceptance or add partner sharing, logbook, manufacturers or recommendations.

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

Reuse the shared product screens and existing explicit save/error/reconnect behavior.
Android first does not authorize claiming iPhone hardware acceptance. File import and
export preserve the existing portable formats; a public web host is not a prerequisite
for private Android dogfood. Until a real recipient-accessible host exists, native
playlist sharing offers the complete file and explicitly omits localhost links.
This is the honest file alternative already allowed by the feature brief.

Implementation can begin after the three Android dependencies have integrated green
verification. Actual phone/board acceptance follows portable recovery. The separate
automatic-backup feature owns online account recovery, and the parent epic keeps the
aggregate independent-protection admission gate.

## Architectural choice

1. **Keep browser device APIs everywhere:** cheapest initial wrapper, but browser
   download anchors, clipboard, wake locks and origin-based links are not demonstrated
   Android capabilities. This is insufficient evidence for parity.
2. **Inject narrow native capabilities into the existing UI (chosen):** retain the
   shared editor, browser, playlists, screenshot review and controller. Probe the
   packaged app first and supply native adapters only for real platform gaps.
3. **Rebuild native screens:** duplicates working product behavior and increases
   regression surface without improving preservation. Outside this milestone.

The trickiest unit is completing a real connected wall session across permissions,
background/foreground interruption and reconnect without replaying stale lighting.
The existing native byte transport/controller contracts remain authoritative; the
emulator cannot stand in for the actual board. Test this early once the recovered
synthetic library can safely be installed on the phone.

## Implementation units

### 1. Native file sharing and usable playlist exports

Files: `web/src/app/create-runtime.ts`, `CruxControlWorkspace.tsx`,
`web/src/playlists/{PlaylistLibrary,PlaylistShareDialog}.tsx`,
`web/src/playlists/portable-transports.ts`,
`prototypes/ios/src/native-playlist-delivery.ts`, `runtime.ts`.

```typescript
// Undefined preserves the browser's existing origin behavior; null explicitly
// disables link generation for a native installation without a public host.
interface NativePlaylistSharing {
  readonly baseUrl: URL | null;
  readonly deliverFile: LibraryBackupDelivery;
}
// Add an optional runtime capability; use the existing delivery result statuses.
// The complete playlist JSON becomes { filename, text } at the boundary.
// PlaylistShareDialogProps.baseUrl expands from URL to URL | null.
```

Thread the capability through the existing workspace and list props. Native file
delivery uses the verified Android SAF destination write/close from portable-files;
retain cancellation, busy and failure semantics. Do not reuse a backup-only
validation function if it rejects the distinct playlist envelope. Factor only the
actual common file handoff if needed, keeping both format validators at their owners.
Browser link/copy/download behavior remains covered by existing tests.

- [x] Native list sharing generates no localhost or fictitious-host links.
- [x] The actual exported playlist file imports through the existing picker with
      fresh local identities, exact content/order and provider references retained.
- [x] Cancellation/failure do not display completed delivery or discard edits.
- [x] Copy/share remains available where a real configured reachable host exists;
      without one the file alternative is explained without blaming payload size.

### 2. Android screen, keyboard and Back behavior

Files: `web/src/pwa/ScreenAwakeControl.tsx`, shared workspace/editor/list components
only where a platform seam is needed, `prototypes/ios/src/` platform adapters and
Android `MainActivity`/a registered plugin only if the packaged probe establishes need.

Probe WebView wake-lock availability and actual prevention of timeout, selected-image
picker/decode, keyboard resizing, safe-area insets, dialogs and hardware Back first.
Record observed behavior before adding dependencies. A native screen-awake adapter
may implement the minimal existing lease contract:

```typescript
interface ScreenAwakeLease {
  readonly released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void,
                   options?: { once?: boolean }): void;
}
interface ScreenAwakePort { request(): Promise<ScreenAwakeLease> }
```

If needed, add an optional `screenAwake` runtime capability and preserve the UI's
existing generation guards, visibility release, retry and truthful status. Native
lease release must not release a newer request. Keep screen-awake ephemeral rather
than persisting an assumed active OS resource.

Hardware Back must invoke the same logical close/back action as the visible control,
including the editor's unsaved-change confirmation and list dirty/pending guards.
Use explicit registered handlers for mounted surfaces if native Back bypasses these;
do not synthesize DOM clicks. A dialog gets first refusal, then editor/play-through,
then root minimize after pending writes settle. Do not clear data or reload as a
navigation shortcut. Preserve cancellation while a restore/import mutation is pending.

- [x] Multi-image screenshot import reviews and saves ordinary native drafts.
- [x] Back/keyboard/dialog interactions preserve pending edits and usable controls.
- [x] Screen awake is either proven effective or fails visibly with retry; no false
      active claim. Backgrounding releases it and requires visible reacquisition.

### 3. Stable private installation and upgrades

Files: `prototypes/ios/android/app/build.gradle`, Android manifest/resources where
required, a private-build script under `prototypes/ios/scripts/`, package scripts and
`prototypes/ios/README.md`.

Keep the app ID stable and use a retained private signing key outside Git. Build
configuration accepts key paths/passwords through local environment or excluded
properties, never checked-in values or command-line log output. Preserve versionCode
monotonicity. Do not reinstall under a different ID and describe that as an upgrade.
Before the first owner-phone rollout, retain and verify the signing material outside
this laptop as well; make the concrete key-retention step visible to Andrew. Public
Play distribution is not required.

- [x] A release-shaped signed package upgrades in place without library changes.
- [x] No private keys, personal library content, tokens or device identifiers enter Git.
- [ ] Actual existing phone app origin/profile and fresh complete backup are verified
      before maintenance; browser/PWA storage is never reset or used as a fixture.

### 4. Fullride acceptance and complete-library comparison

Files: a repeatable acceptance script/checklist in this item and the native README;
targeted regression tests in the owning modules for any real integration defect.

Use a clearly synthetic library with a Draft, Finished climb, Trash, grade, effects,
multiple lists, shared membership, explicit order and catalog references. Verify
create/edit/autosave/reopen, grade/angle, Trash/restore, list editing/play-through,
PNG import, portable files and the older Kilter browse/filter/detail flow. Connect
the real board, light/clear, edit holds, run effects, play through local and catalog
entries, background/foreground, interrupt/disconnect and explicitly reconnect. Compare
a coherent canonical export before/after upgrade; account for deliberately authored
test changes by exact expected records rather than counts alone.

Acceptance records name platform/build and checks without retaining private identifiers.
Record physical actions Andrew performs honestly. Unavailable hardware keeps this
feature active; it does not invalidate the completed emulator/adapter work or justify
claiming board acceptance. Daily irreplaceable authoring additionally requires the
epic's off-phone protection and verified recovery gate.

## Testing and risks

Keep the root shared product suite and native adapter suite green, plus Android
compile/package checks. Add behavioral seam tests for disabled native links, actual
delivery outcomes and any new wake/back adapters. Reuse existing effect/BLE codec
tests; real permissions/radio/wall behavior remains physical acceptance. A canceled
picker or denied permission must leave saved library state intact. A debug-only
installation is useful proof but is not the durable update/signing arrangement.

One feature owner can integrate these coupled runtime/UI changes. Keep the units as
checkpoints in this item rather than creating story files that duplicate the contract.

## Pending-close defect absorbed

`idea-pending-import-close` was parked in `fc37889` after real tests reproduced
screenshot and playlist dialog header/cancel actions dismissing pending imports.
Absorb here under the authorized Back/pending-write parity scope. Share the guarded
logical close with native Back and visible controls. Screenshot import uses a
synchronous mutation ref through import and refresh; playlist import uses its
existing importRunning ref; membership tracks all writes/refreshes. Busy handlers
consume Back without dismissing a lower surface. Cancel remains available before
mutation. Preserve the same UI layout and strict serialization/identity contracts.

## Implementation notes

- Execution: one feature owner, isolated worktree `codex/android-dogfood-parity`.
  Standard review is parent-owned after physical acceptance; no nested delegation.
- Android runtime gains optional playlistSharing and backNavigation capabilities;
  web defaults stay unchanged. Registered mounted actions prioritize dialogs,
  details, editor/play-through and root; no synthetic DOM clicks or history reload.
- Actual system-file-chooser whole-library import is required in this parity proof.
  Earlier portable recovery used a real SAF export but injected File bytes for
  import; that is not evidence of the Android chooser import path.
- Physical phone/Fullride and verified independent signing-key retention keep this
  feature implementing. Automatic online backups and clean-install online recovery
  remain the separate aggregate gate before real authoring.

## Interaction checkpoint (local verification)

- Android playlist export now uses the same SAF destination/write/close plugin as
  whole-library export. The complete existing playlist envelope is preserved;
  Android explicitly disables origin-based links until a real reachable host is
  configured. Browser copy/download/share behavior remains unchanged.
- A small mounted-action Back dispatcher routes dialogs, details, editor and
  play-through through their existing logical callbacks. Root minimizes only
  after pending writes settle and list edits are saved. Pending import and
  membership close guards share the same callbacks with visible controls.
- Format-neutral Android file delivery retains the committed native stable
  FILE_SAVE_CANCELED/FILE_SAVE_FAILED contract, punctuation and partial-file
  caveat. Backup and playlist encoders remain at their format owners.
- Focused shared verification: 23 files / 191 tests; root typecheck and lint pass.
  Native verification: 8 files / 94 tests plus 5 packaging checks; native
  typecheck/lint pass. Existing browser/native-runtime and editor confirmation
  tests cover defaults, pending writes, cancellation, latest mounted handler,
  teardown and exact UTF-8 handoff.
- Source APK9 packaged probe established that hardware Back left the backup
  dialog open before this adapter. Timeout probe is inconclusive: disabled and
  enabled both stayed awake at 18 seconds; background WebView visibility also
  stayed visible. This is not accepted keep-awake evidence. Further bounded
  native/picker/keyboard/signing checks remain, followed by physical acceptance.
- Execution capability: one feature-owning Codex implementer; standard review
  remains parent-owned. Stage stays implementing because physical Fullride,
  owner-phone and independent signing-key retention acceptance are outstanding.

## Signing and platform checkpoint

- Private builds reject absent, malformed or out-of-range version codes before
  package mutation. Compile-only CI remains explicit and unsigned/debug. Gradle
  independently rejects missing signed-build credentials/version. Release disables
  debugging; the separate signedProof variant enables synthetic instrumentation.
- Local retained private signing material lives in excluded `.private-signing/`
  with directory0700/key+credentials0600. No values or keys enter Git. A private
  retention instruction packet makes the required off-laptop retrieval/signing
  verification concrete; that owner action remains unperformed.
- API36 isolated signing proof: signedProof11 → non-debuggable release13, same app
  ID/certificate, increasing version, `install -r`. The actual system chooser
  selected the known synthetic backup on empty installation; complete restore
  and force-stop comparison passed. This first chooser step used a supplemental
  host helper; the committed signed runner resumed the exact restored library.
- Signed runner `/tmp/cruxcontrol-android-parity-proof/signed-upgrade-retry/`
  contains actual provider-written SAF exports before update, after release update
  and after release relaunch. All authored fields, Trash, recipes and ordered
  local/provider references compare canonically equal. Release UI uses native
  taps/Back, with no CDP/debugging enabled. Earlier failed UI-probe attempts remain
  private and unchanged; none reset or removed the installation.
- Source APK9→10 preserved the complete original 4-climb/2-list synthetic snapshot.
  Native Back closed backup, exited play-through, dismissed the actual keyboard
  while retaining the editor, then exited a saved editor. Keyboard resized the
  viewport; no keyboard/inset adapter is warranted by that successful probe.
- A clean timeout control detached CDP: with stay-on disabled and a5s setting
  (Android minimum10s), off slept by25s; on retained an app-attributed bright-screen
  wake lock past25s; Home background released the lock and slept by25s. Settings
  were restored afterward. Existing browser wake implementation retained. This
  supersedes the inconclusive debugger-attached18s observation, without altering
  its original private evidence.
- Packaging tests8pass, native95tests/8filespass after primary portable integration;
  final release catalog/worker/WASM digest check and Gradle compile pass.
  Private artifacts/evidence: `/tmp/cruxcontrol-android-parity-proof/`.

## Final picker and build-provenance checkpoint

- Instrumented signed14 on isolated emulator5584 used the real SAF save/cancel
  path and Android document picker for playlist import. The saved portable bytes
  exactly match the production encoder, including two local snapshots, effects,
  provider reference and order. Import added exactly two fresh climb identities
  and one fresh ordered list; the complete original four climbs/two lists remained
  equal. The committed runner's intermediate `pickers-retry2/playlist-imported.json`
  records this six-climb/three-list checkpoint before its PNG stage. Earlier
  attempts retain their real failure boundaries without reset or repeated import.
- The bounded PNG-only continuation passed in `png-only-final/`: API36's real
  Photo Picker GET_CONTENT activity → More/Browse → DocumentsUI Downloads selected
  two task-owned fictional PNGs. They contain only public board geometry and
  generated role discs, not private screenshot originals or catalog contents.
  Production decode/review saved two exact draft records with fresh identities,
  expected role assignments and empty metadata/effects. All six prior climbs and
  three lists remained canonically equal; all eight climbs/three lists remained
  equal after force-stop/relaunch. `verified-picker-library.json` is the exact
  baseline for the final signed update. The PNG-only result does not independently
  establish the earlier playlist stage; that stage is grounded in its explicit
  checkpoint, file and system-picker XML.
- Two additional meaningful regressions verify root Back consumes unsaved list
  input/pending creation and membership Back remains guarded until both write and
  refresh finish. Focused shared checks pass36tests/2files. These reveal no new
  production defect or change; parent full-suite integration will include827tests.
- `.private-signing/` is now ignored by portable repository rules. No credential
  values or signing material enter this worktree or Git. The private retention
  instruction packet remains an owner action before rollout.
- Signed14 APK content SHA-256:
  `9071e67d92a480ef6fa7df10f14905f72aebc537ff3b3f789ec47faefefc8cb0`.
  Its adjacent sidecar records clean end-boundary commit6111f1c; it predates the
  two-boundary enhancement and does not claim start-boundary provenance. A clean
  rebuild produced exactly the already-installed14 bytes, so no repeat install
  or chooser cycle was needed. The final15 recipe will capture start/finish
  commit, tracked index/working-tree dirty state and timestamps, plus exact APK
  SHA, without recording signing environment values. The aggregate clean flag
  requires both clean boundaries and identical HEAD.
- Production behavior is unchanged since4019add. This checkpoint changes tests,
  native UI proof helpers, fictional fixtures, build provenance and instructions.
  Full feature remains implementing: physical phone/Fullride acceptance and
  independent off-laptop key retrieval are unperformed; automatic online backups
  and clean-install online recovery remain the separate admission gate.

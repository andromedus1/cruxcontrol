---
id: epic-library-preservation-android-parity
kind: feature
stage: done
tags: [data, ble, ui, infra]
research_refs: [independent-library-preservation]
parent: epic-library-preservation
depends_on: [epic-library-preservation-native-library, epic-library-preservation-portable-files, epic-library-preservation-android-catalog]
release_binding: null
gate_origin: null
created: 2026-10-10
updated: 2026-10-18
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
- [x] Actual existing phone app origin/profile and fresh complete backup are verified
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
- Physical phone/Fullride acceptance keeps this feature implementing. Independent
  signing-key recovery is verified below. Automatic online backups and clean-install online recovery
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
  remains parent-owned. Stage stays implementing because physical Fullride and
  owner-phone acceptance are outstanding.

## Signing and platform checkpoint

- Private builds reject absent, malformed or out-of-range version codes before
  package mutation. Compile-only CI remains explicit and unsigned/debug. Gradle
  independently rejects missing signed-build credentials/version. Release disables
  debugging; the separate signedProof variant enables synthetic instrumentation.
- Local retained private signing material lives in excluded `.private-signing/`
  with directory0700/key+credentials0600. No values or keys enter Git. A private
  retention instruction packet makes the required off-laptop retrieval/signing
  verification concrete; the completed Drive retrieval/signing proof is recorded below.
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
  Full feature remains implementing: physical phone/Fullride acceptance is
  unperformed; automatic online backups
  and clean-install online recovery remain the separate admission gate.

## Final local verification

- Clean committed source0c824ba produced true release15. Start18:57:35.130Z and
  finish18:57:43.146Z on2026-10-10 both recorded commit
  `0c824ba968d0decabadc47f820a013b9d344f01d`, tracked index/worktree clean.
  Private APK `/tmp/cruxcontrol-android-parity-proof/release15.apk` and adjacent
  `.build.json` preserve that provenance. APK content SHA-256 is
  `24e387a3f3c7395bd64fc56ed5ed6d2fb05fb24b622643b629162a26d066053f`.
  Certificate SHA-256 is separately
  `45a130298d76cb97ed00204f382ac40acf8328def2203660915bd56cf1ac2ff8`.
- `smoke-android-signed.mjs` passed the exact signed14→release15 same-key,
  same-ID increasing-version `install -r` transition on isolated emulator5584.
  Before-update, after-update and release-relaunch files in `signed-final14-15/`
  were written by the actual SAF provider and operated through native UI.
  Every record field, Trash, effects, ordered local/provider membership and the
  intentional playlist/PNG additions compare canonically equal to the complete
  eight-climb/three-list `png-only-final/verified-picker-library.json` baseline.
  This fixture contains no grade metadata; it does not claim the separately owned
  portable graded-update proof or physical Fullride/phone acceptance.
- Final APK inspection confirmed debugging disabled, `allowBackup=false`, all
  nine legacy exclusion domains and nine each for cloud/device transfer, plus
  `loggingBehavior:none`; `release15-policy.json` records the bounded check.
  Final compressed catalog digest, worker/WASM package checks and Gradle release
  compile passed. No private key, credential, binary catalog or fixture is committed.
- Final scoped checks: shared Back/workspace/membership36tests/2files; native
  runtime/storage/delivery95tests/8files plus8 packaging/options tests; root and
  native lint/typecheck; packaged-browser smoke1test; native web build and Android
  release compile all pass. Parent integration owns full827-test shared suite,
  final PR CI and later standard review after remaining feature acceptance.
- Source emulator5580 remains its exact debug10 original four-climb/two-list
  snapshot; signing5584 retains release15 and all eight climbs/three lists.
  Both installations and prior proof directories are preserved. UI/build lane
  released; no physical device was enumerated, installed, reset or maintained.
- Remaining external acceptance: actual owner-phone origin/profile and fresh
  whole-library backup before maintenance; synthetic phone/Fullride permissions,
  chooser/light/clear/effects, interruption/background and explicit reconnect. Stage stays
  implementing. Automatic online backup and clean-install online recovery remain
  required before real authoring; local file and emulator results do not admit it.

## Signing-key retention verification

- Andrew selected Google Drive for the off-laptop signing copy. Prepare it in a
  private, unshared My Drive folder with Restricted general access. This is
  separate from selecting the automatic climb-backup service.
- Execution: inline in the driving agent for this bounded acceptance checkpoint;
  standard feature review remains pending the existing physical acceptance.
- Prepared `.private-signing/cruxcontrol-signing-backup-2026-10-10.zip` containing
  the unchanged keystore and credentials plus recovery instructions. Verified all
  archive entries exactly against their source bytes, archive integrity, private
  local permissions and repository exclusion. No credential values enter Git.
- Andrew confirmed the Drive upload and fresh download on 2026-10-10. The downloaded
  archive in `.private-signing/retrieved/` matches the retained SHA-256 manifest;
  archive integrity, exact entry set and every entry's bytes pass verification.
- Extracted the downloaded key and credentials into a separate private directory.
  Parsed credentials without executing or printing them, discarded inherited signing
  variables, and explicitly pointed signing at the recovered key. The original key
  was not used. Re-signing a copy of the existing release15 APK succeeded;
  `apksigner verify` confirms one signer with the same certificate SHA-256 recorded
  above. Every application entry outside signing metadata is byte-for-byte unchanged.
- Evidence is retained outside Git in `.private-signing/recovery-verification.json`.
  The Drive upload/download is owner-reported; archive validation and recovered-key
  signing are tool-verified. No new APK was installed and no phone was touched.
  This completes the independent signing-key recovery requirement.
- No production behavior or tests changed. Feature remains implementing until
  actual phone/Fullride acceptance and the required feature review pass.

## Next session: USB installation and dogfooding

**Explicit stopping point (2026-10-12):** Andrew asked to wrap and resume next time
with app installation over USB and dogfooding, then continue this work arc. Stop
device work for this session. The last USB inventory contained only synthetic
emulators; the physical phone has not been installed, updated or used for this
acceptance. Earlier USB questions are deferred to the next session, not outstanding
product decisions or permission to proceed while Andrew is away.

### Verified delivery state

Five sibling features are done: native storage, portable files, older Android
Kilter catalog, private account vault and automatic backup. Their reviews and
verification are recorded in their owning items. This feature and its parent epic
remain implementing because physical parity and this feature's standard review
remain. Automatic backup's completed review does not need another independent pass.

- Branch `codex/library-preservation`; [draft PR #32](https://github.com/andromedus1/cruxcontrol/pull/32).
  Verified application source is `acb7a6027b9c96e9762b2b649c9e141b800418b7`.
  [All required CI passed](https://github.com/andromedus1/cruxcontrol/actions/runs/38257748591)
  at that exact source. A later handoff-only commit does not rebuild the package.
  No PR #32 merge has been authorized; the older PR #31 authorization is separate.
- Full web checks: 892 tests plus lint/typecheck; native: 110 tests plus 11 package
  checks and lint/typecheck; gateway: 17 tests. Browser/native packaging checks pass.
- [Automatic-backup acceptance](epic-library-preservation-automatic-backup.md#review-closure-and-full-size-automatic-protection-2026-10-12)
  includes independent empty-install in-app recovery, offline edits, interrupted
  uploads, conflicts/cancellation and full-size automatic protection with exact
  remote readback of 10,000 synthetic climbs, 1,000 lists and 100,000 memberships.
  These are synthetic records, not recovery of Andrew's missing authored climbs.
- Firebase account setup, service deployment and linked billing are complete. The
  $5 alerts are not a spending cap. No fresh provider choice or billing setup is
  needed. Backups run while foreground execution is available; retain copies and
  pause at the 512-version limit. Portable exports remain manual.

### Exact installation candidate

Use the retained **release30**, not an instrumented proof APK:

- APK: `.private-signing/android-dogfood/cruxcontrol-30.apk`.
- Provenance: `.private-signing/android-dogfood/cruxcontrol-30.apk.build.json`.
- APK SHA-256: `c5c8f2715c7de4c727a35ed514c8daf128de0905712afd74fc3055ba5e8e107f`.
- Version code 30, stable app ID `io.github.andromedus1.cruxcontrol.prototype`,
  debugging disabled, production scope `library-v1`, proof surfaces excluded.
  Older Kilter catalog, worker/WASM and vault packaging checks pass.
- Built from the clean source above; file digest was revalidated at handoff. Its
  certificate matches the independently recovered Drive signing key:
  `45a130298d76cb97ed00204f382ac40acf8328def2203660915bd56cf1ac2ff8`.
  Signing recovery evidence: `.private-signing/recovery-verification.json`.

The APK, catalog binary, credentials and detailed device/cloud evidence remain
outside Git. Code and handoff are pushed through the existing PR branch; signing
material was separately uploaded to and retrieved from Andrew's Google Drive.
If a rebuild is needed, follow `prototypes/ios/README.md`, use the retained key and
an appropriate increasing version code, and recheck production scope/signing.
Do not print credentials or substitute an unconfigured compile-only package.

### Resume sequence

1. Re-read the project's preservation rules and query the work state. Keep the Mac
   open and powered for acceptance; host sleep interrupted earlier synthetic runs.
   The temporary awake assertion was stopped before wrapping this session.
2. Have Andrew connect/unlock the phone and allow USB debugging. Select its explicit
   device target; never use an untargeted `adb` command with emulators present.
   Inspect the actual installed app/package, existing PWA origin and browser profile.
   The established PWA origin is `http://localhost:4173/`; verify actual state rather
   than assuming it. Do not restart a preview server or force a PWA refresh first.
3. Before maintenance, capture and validate a fresh complete library backup outside
   Git, including drafts, finished climbs, Trash, grades, recipes, playlists and
   exact membership order. An earlier empty-library finding does not prove today's
   state. If the existing app cannot export, investigate without clearing, replacing
   or resetting it; never interpret an inaccessible store as an empty backup.
4. Inspect any existing native installation's ID, signing identity and version;
   install release30 only when those checks permit it. Preserve existing data with
   the normal update path; never uninstall to fix a signature/version mismatch.
   A new native installation must leave the separate PWA/browser data intact.
   Compare all saved content/order against the fresh baseline after installation.
5. Execute the existing Fullride acceptance checklist in this item using clearly
   synthetic test data: editor/grade/save/reopen, Trash, ordered playlists, actual
   picker import/export, older catalog/offline provider playback, Bluetooth chooser
   and permissions, light/clear/effects, background/interruption and explicit
   reconnect. Andrew must confirm expected physical wall lighting. Do not label
   emulator evidence as observed phone/board behavior or copy acceptance-pool data
   into the production vault as a shortcut.
6. Verify the phone's account/backup status and a real retained copy before admitting
   irreplaceable authoring. Independent recovery is already proven on separate
   synthetic installations; do not reset the phone to repeat that experiment.
   Complete this feature's one standard independent review, fix/verify accepted
   findings and required CI, then close the epic's remaining admission gate. Keep
   the PR draft until its remaining acceptance/review is complete.

After safe dogfooding, follow the [saved roadmap](../../backlog/roadmap-next-milestones.md):
current official Kilter coverage ahead of partner sharing. Physical iPhone testing
still awaits hardware; logbook, extra board manufacturers, grade prediction and
recommendations remain deferred. Existing capture-cost/recovery-polish backlog
items remain parked; do not silently expand this install session into them.

Private evidence is retained under `.private-firebase/automatic-app-acceptance/`;
the automatic-backup item maps its exact files and observation limits. Preserve
both synthetic emulators and retained cloud copies. The unrelated untracked
`docs/kilter_docs/` and `docs/set_boulders/` directories were left untouched and
must not be swept into a handoff commit.

## Physical Android acceptance in progress (2026-10-18)

Andrew connected the phone and authorized installation and testing. Execution is
host-owned inline using the implementation workflow; review weight remains standard.
The Fullride is not yet available for testing; Andrew requested continued phone-only
checks. Physical lighting, clear, effects, interruption and reconnect remain open.

- Confirmed the existing WebAPK uses Chrome's ordinary `Default` profile and
  `http://localhost:4173/`. It initially showed connection refused. A script-free,
  uncached inspection document at the same origin exposed no existing IndexedDB
  databases, localStorage keys, caches or service workers. Two current enumerations
  agreed. Saved and decoded a fresh empty portable backup outside Git; this records
  current accessible state and makes no claim to recover historical missing climbs.
- No native package was installed. Revalidated release30's APK digest and retained
  signing certificate, then installed the existing non-debuggable production-scope
  package successfully on a Pixel 8 running Android 17. The PWA storage inventory
  still exactly matches the pre-install baseline. No app/browser reset or uninstall
  was performed.
- Native startup succeeds. The older Kilter catalog is present and shows available
  offline; catalog installation was observed after owner interaction, not driven
  by the acceptance script.
- Saved the native empty library through the actual Downloads provider and decoded
  its completed file on the host before introducing test records. Imported a clearly
  named synthetic fixture through the real Android file picker: four climbs, two
  lists, grades, Trash, an effect recipe, shared and ordered memberships. Recovery
  reported completion. The actual provider-written export exactly matches the
  entire imported fixture, including all six ordered memberships.
- Edited the synthetic draft's grade from V3 to V4 through the native keyboard.
  Android Back first dismissed the keyboard, then returned to details with V4.
  The next completed export proves only the intended grade and its revision/save
  metadata changed; all other fields and list ordering stayed identical. After
  closing the dialog with no pending save and no board connection, force-stopped
  and cold-launched the native app. A fresh provider export exactly matches the
  full saved pre-restart library.
- Reordered the synthetic two-climb playlist and verified play-through visits its
  new first/last entries, disables Next at the end and returns through Android Back.
  Canceling the native playlist save picker reports cancellation. A completed file
  export exactly matches the intended portable payload, including order, grades
  and the effect recipe. The other list and its shared/missing memberships remain
  unchanged.
- Selected two fictional PNGs together through Android Photo Picker → Browse →
  Downloads. Normal review/naming saved two distinct drafts with fresh identities,
  exactly the expected two/three hold assignments and empty metadata/effects.
  A fresh complete export verifies all four existing climbs unchanged, only the
  intended playlist reorder, and both exact new drafts: six climbs/two lists total.
- Andrew selected the already configured owner account for private dogfood.
  The initially selected other Google account signed in successfully but received
  the truthful account-not-enabled response. Switched through normal sign-out and
  account selection; no cloud configuration or access policy was changed. Wider
  distribution requires separately admitted users with isolated private backups;
  accepting Google sign-in alone does not provide that capability. This session
  does not expand the service beyond its current single-owner admission.
- Admitted the synthetic phone library through Manage and retained its first
  production-library copy. A normal native download/review reports all six climbs
  and both lists unchanged, including Trash and the intentional unavailable list
  reference; no restore was performed on the owner phone. Then changed the draft
  grade V4 → V5 through the editor. The normal foreground schedule, without Retry
  or another library-admission action, progressed from pending to all changes
  backed up. History retains both copies. Reviewing the second copy again reports
  exact unchanged contents. A completed portable export confirms only the grade
  and its revision/save metadata changed; every other field and ordered membership
  remains identical.
- Physical-phone window evidence shows KEEP_SCREEN_ON while enabled/visible,
  removal on Home/background and reacquisition on return. The temporary toggle
  was disabled at handoff. This proves lifecycle handling, not a full five-minute
  physical timeout trial; the isolated emulator timeout control remains separate.
  The installed older catalog opens its read-only climb detail with grade, setter
  and hold count. No physical-phone network-off trial or board lighting is claimed.

The phone is left on the test drafts with verified online-backup status and six
clearly named test climbs/two lists retained for continued acceptance. Complete
portable copies are also retained on the host. Fullride permissions, lighting,
clear, effects, connected play-through and interruption/reconnect still require
the board and Andrew's observation. Keep this feature implementing and PR32 draft;
its standard independent review and the epic's daily-use admission remain pending.

Detailed evidence and backups are excluded from Git under
`.private-signing/phone-acceptance-2026-10-18/`. Emulator-only acceptance helpers
were not retargeted to the owner phone; release behavior is exercised through the
normal UI and Android accessibility/pickers.

### Original inventory handoff (2026-10-18)

Andrew requested loading the available original climbs into My Climbs before his
board test. Saved and decoded a fresh whole-library export first; it exactly
matches the prior six-climb/two-list baseline. The existing supplied-batch and
private-source verification tests pass (three tests): all sixteen original PNG
checksums and production-detector hold/role tuples match the established manifest.
Prepared a strict portable file with fresh identities, the existing names and
assignments, 40° and finished status to place these climbs in My Climbs. Did not
infer grade metadata from title suffixes or claim recovery of lost later creations.

Normal Android file selection, review and missing-only recovery added all sixteen
with no conflicts. A fresh complete provider-written export exactly matches the
expected twenty-two climbs and two lists; every previous field and ordered
membership remains unchanged. Automatic backup retained the expanded library, and
native download/review reports all twenty-two climbs and both lists unchanged.
Independent files and detailed evidence remain outside Git in the private phone
acceptance directory. The phone is left on My Climbs with verified backup status:
sixteen original climbs plus the two clearly labeled test climbs. Andrew owns the
next physical board trial; no board lighting result is inferred from this import.

### Owner board feedback (2026-10-18)

After taking the app to the board, Andrew reports it is working very well and
believes the sixteen imported climbs are the climbs he was missing, possibly the
entire missing inventory. Record that positive owner observation without treating
his tentative inventory identification as proof of every historical record or its
metadata. These sixteen climbs are included in the verified twenty-two-climb/two-list
cloud copy and the exact portable export retained on the host.

The first owner board trial is therefore positive. Clear, effects, connected
playlist playback and background/interruption/reconnect still need explicit
scenario results before claiming the whole physical checklist complete. Standard
review remains pending; the general success report does not close those gates.

### Physical checklist confirmed (2026-10-18)

Andrew explicitly confirms completing every remaining board check: clear lights,
effects, connected playlist play-through, background/reopen, disconnect/reconnect
and offline use. Together with the earlier positive board report and the verified
phone preservation/import/backup evidence, this completes physical acceptance.
These are owner-observed results, not agent-instrumented radio measurements.
Advance to review for the single standard independent Android-parity pass.
The prior intermittent workspace playlist edit/return test failure remains a review
input: unchanged focused/full-file tests and the bounded CI retry passed, as did
the subsequent complete CI run. Do not describe a retry as a root-cause fix.

### Standard review adjudication (2026-10-18)

One independent Claude Opus pass completed successfully, with no data-preservation
blockers. Review scope was Android parity and its integration seams; the five
already-reviewed sibling features were not re-reviewed line by line.

- **F1, medium — accepted and fixed:** Back could be ignored between the saved DOM
  render and the passive identity callback. Tracked via park → focused
  `story-fix-editor-back-save-race`; both native/button boundary regressions fail
  against the old callback and pass after preserving an already-closed editor.
  Full web suite (893 passing, one existing skip), lint and TypeScript/build pass.
  Required PR CI is the remaining closure check. Installed release30 does not
  contain this source fix; include it in the next preservation-safe phone update.
- **F2, low — accepted:** foundation docs and the native README now distinguish
  owner-observed Android checks, synthetic/emulator proof and pending physical iPhone
  acceptance. They retain the no-public-host Android link limitation.
- **F3, low — qualified evidence:** Andrew's six confirmed board scenarios complete
  the requested remaining owner checklist. They do not establish scenario-specific
  physical proof of catalog entries lighting from playlists, Trash/restore actions,
  or angle changes. Catalog playlist resolution has software/emulator proof; generic
  playlist/board behavior is owner-observed. Retain these limits without turning
  the report into invented instrumented evidence or claiming all device combinations.

Standard policy requires no second independent pass after adjudicated fixes and
verification. No secrets, personal library data or device identifiers were committed.

### Closure

Required CI [run 39169868839](https://github.com/andromedus1/cruxcontrol/actions/runs/39169868839)
passes for the fixed source: web lint/typecheck/unit/browser/catalog checks, iOS
prototype contracts/browser smoke, Android native compile/boundaries and the
existing Firebase/ML lanes. Subsequent commits only update records and docs.
The accepted F1 correction, F2 documentation update and F3 evidence qualification
are complete. Advance to done after the single standard review and verification.

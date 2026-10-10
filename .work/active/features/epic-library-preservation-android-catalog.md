---
id: epic-library-preservation-android-catalog
kind: feature
stage: review
tags: [data, infra]
research_refs: [independent-library-preservation]
parent: epic-library-preservation
depends_on: [epic-library-preservation-native-library]
release_binding: null
gate_origin: null
created: 2026-10-10
updated: 2026-10-10
---

# Use the older Kilter catalog in the Android app

## Brief

Make the already-approved older Fullride community catalog available in the Android package with the existing browser, filters, detail, board-lighting and playlist integration. Retain the older-library label and unknown-current-coverage limits. Bundle the known snapshot for the private dogfood build so availability does not depend on the laptop or a new catalog service.

Own reproducible verified artifact inclusion: the local gzip is ignored by Git and a clean build currently omits it. Add a build-time preflight/manifest check and explicit private artifact source instead of committing the catalog binary. Prove module Worker/WASM, OPFS/Web Locks, compressed byte/hash handling, installation, interrupted installation and offline relaunch in Android WebView. Reuse the current catalog port first; implement native catalog storage only if the packaged proof fails. Current official catalog acquisition and public redistribution remain separate catalog-epic work.

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

Use the existing older library approved by Andrew, included with the private APK.
The current manifest pins a 5,122,102-byte gzip and a 12,410,880-byte database.
Source freshness remains unknown. No network catalog acquisition, new public host,
new official-account access, or public redistribution is required for this build.
Do not commit the binary. An explicit operator-supplied immutable artifact is an
acceptable reproducible build input; a silent dependency on one developer's working
tree is not. Cloud artifact hosting is optional, not prerequisite.

## Architectural choice

- **Existing worker/OPFS catalog over bundled assets (chosen first):** preserves
  the implemented query, validation, install and recovery logic. Android WebView
  capability and exact compressed-byte serving must be demonstrated.
- **Native catalog SQLite adapter:** fallback only if the packaged worker proof
  fails. Existing `CatalogPort & CatalogBootstrapPort` boundaries permit it, but
  this adds database install/recovery/query integration rather than a toggle.
- **Hosted download only:** adds hosting and connectivity requirements without
  improving the first offline dogfood session. Retain as a later distribution option.

## Implementation units

### 1. Explicit catalog input and validation

Files: `prototypes/ios/scripts/prepare-android-catalog.mjs` (new), corresponding
Node tests and package script integration after the native-library feature lands.

```typescript
// ESM script API (Node 22 native-package toolchain):
export async function prepareAndroidCatalog(options: {
  sourceFile: string;
  manifestFile: string;
  destinationDirectory: string;
}): Promise<{ sha256: string; bytesGzipped: number; bytesRaw: number }>;
```

Reuse production `parseCatalogManifest` through Node 22's supported TypeScript
loading or a bundled script entry; do not invent another source schema. Require
an explicit input path for private dogfood packaging. Validate identity, bounded
size, SHA-256, decompressed size and SQLite header before copying. Write via a
staged temporary file and rename; never overwrite the authored-library database.
Missing/mismatched input fails the build with an actionable message. Preserve the
committed manifest as the expected artifact, not a rewritten stamp that would
accept arbitrary bytes. The existing local copy can serve as the initial input.

### 2. Final packaged-asset check

Files: `prototypes/ios/scripts/check-android-catalog.mjs`, script tests, package scripts.

```typescript
export async function checkAndroidCatalog(assetDirectory: string): Promise<void>;
```

Validate the manifest and its declared file in the synced Android assets, plus
Worker/WASM references already established by the normal build check. The private
APK build must run this check; source-directory existence alone is insufficient.
Generic CI may use synthetic test artifacts, but must not label such an APK the
owner's dogfood build or silently omit the catalog. Keep private binary uploads
out of public workflow artifacts.

### 3. Packaged WebView proof and any narrow compatibility fix

Files: `prototypes/ios/scripts/smoke-android-catalog.mjs` (or extend an existing
emulator script); only if evidence demands it, `web/src/data/catalog/bootstrap.ts`
and/or native composition.

Exercise the actual installed app in an isolated Android emulator: open Kilter,
read manifest, install with the app's consent flow, validate returned compressed
bytes through the normal importer, search/filter, open details, add a catalog climb
to a list, terminate/relaunch offline and resolve that list entry. Confirm the
synthetic authored library has identical canonical export before/after. Use the
real pinned catalog locally, and synthetic catalog data for shareable CI fixtures.
Record WebView/Android versions and evidence without personal/device identifiers.
The proof must exercise module Worker, WASM, Web Locks and OPFS synchronous handles.

If the current worker path fails, document the exact failure and revise this design
for the native catalog adapter before building it; do not quietly disable Kilter.
Real-board lighting is owned by final Android session acceptance, with the same
catalog record/playlist included there.

### 4. Private build recipe and scope of evidence

Files: `prototypes/ios/README.md`, `.github/workflows/ci.yml` only as required.
Document the explicit artifact input, pinned digest, package preflight and verified
offline installation path. Distinguish compile/synthetic CI from private catalog APK
acceptance. No automatic freshness claim or public-source fetch is introduced.

## Testing

- Missing input, tampered/truncated/oversized gzip and manifest mismatch reject before
  packaging; valid immutable bytes survive copy and sync unchanged.
- The packaged check fails if catalog bytes are missing even though JS/WASM exist.
- Actual Android WebView installation, offline relaunch, filters/details/list resolution
  and authored-library preservation pass. Existing browser catalog tests remain green.
- Required native/root static checks plus the focused Android smoke; no test that merely
  asserts copied implementation constants is a substitute for packaged behavior.

## Risks and acceptance boundary

The biggest uncertainty is packaged WebView storage/worker support, followed by the
native asset handler's gzip behavior. Test this before investing in a replacement
catalog adapter. A clean build requires supplied private data; publishing that data
is not implied by a successful private dogfood proof. Current official coverage is
still a separate milestone. No new UI structure is needed.

## Packaged-asset defect absorbed into this feature (2026-10-10)

`idea-android-catalog-gzip` was captured in commit `fce8645` under the test-integrity
rule and is absorbed here because it is the exact platform compatibility scope of
unit 3. The installed APK serves 404 for the manifest gzip: Android's asset merge
expanded it and packaged `kilter-7x10.v1.db` instead. Source and synced-asset checks
alone pass incorrectly. WebView133/API36 exposes wake lock, OPFS and Web Locks;
actual worker/database installation remains unverified until file delivery works.

Extend unit 2 to inspect the **final APK** after assembly and verify the exact
compressed bytes/digest. Preserve the existing strict source manifest and catalog
import validation. First inspect the pinned build tool's supported options. If its
gzip processing cannot be disabled safely, package under an inert asset suffix and
serve a narrowly scoped native asset alias at the original canonical URL. The alias
must match only this app's local catalog path and retain the exact gzip bytes; do
not weaken the downloader's origin/hash/size checks or silently rewrite the source
manifest. A broad custom server or native catalog database replacement is not justified
by this packaging defect. Regression must fail against the current APK.

## Catalog membership defect absorbed (2026-10-10)

`idea-catalog-playlist-callback` was captured in `90d4d86` under test integrity.
The parent authorized absorption here because catalog-to-playlist is this feature's
explicit acceptance. CatalogBrowser receives an optional `onManageLists(climb)`
callback and resolves the selected visible catalog row before forwarding it from
LocalClimbViewer. CruxControlWorkspace stores the dialog's name/reference instead
of a draft-only value and passes the provider's existing ID/layout reference to
PlaylistMembershipDialog. Reuse existing modal, repository writes and operation
safeguards; disable membership when playlists are unavailable. Verify callback row
identity, canonical ordered append, offline provider resolution and unchanged
local climbs/other playlist data. No new UI surface or foundation change.

## Provider resolution defect absorbed (2026-10-10)

`idea-catalog-list-resolution` records the second verified integration gap:
PlaylistLibrary never passes provider rows to its existing resolver. Parent
authorized this seam as required offline playlist acceptance. Workspace collects
unique provider references only when Lists is open, lazily starts the catalog and
reads existing `get(id, configuredAngle)` sequentially (one in flight). Cancel
stale generations between reads and ignore their results; the current query port
does not support aborting one issued read. Pass available rows to PlaylistLibrary
and its existing play-through. Show existing loading/error presentation and retry
for unavailable storage or lookup errors. A successful null lookup establishes
only that no compatible row was found at the configured angle, so show
Unavailable at that angle rather than globally Missing. No provider refs means no catalog startup. Tests cover lazy startup,
deduplication, errors, retry and stale results alongside offline emulator resolution.

## Implementation and verification (2026-10-10)

- Packaging checkpoint `03eb286` implements the explicit private recipe,
  production-parser preflight, atomic copy, inert `.gz.bin` suffix, exact local
  native URL alias, synced asset check and final-APK byte/digest/code-graph check.
  `build:android:catalog -- --catalog PATH --version-code N` requires the input;
  generic Android build/sync explicitly reports compile-only and omits catalog.
  No dependency or source manifest changes. The binary remains ignored/private.
- Inspected installed AGP8.13.0/sdk-common31.13.0 bytecode: AssetItem strips `.gz`
  solely by extension; MergedAssetWriter uses GZIPInputStream before AAPT. The
  supported [noCompress](https://developer.android.com/reference/tools/gradle-api/8.13/com/android/build/api/dsl/AndroidResources#noCompress())
  option controls APK ZIP storage, not this asset transformation. Preserved strict
  downloader and importer contracts; no native catalog database replacement.
- Synthetic package tests pass (5): explicit input/atomic byte copy; missing,
  tampered, truncated, oversized data; manifest identity/raw bounds/SQLite header;
  missing catalog with code present; expanded old APK regression; expected source
  manifest comparison and reachable Worker/WASM. The actual prior APK also failed
  final inspection because its gzip asset was absent. Private APKs 6/7/8 pass exact
  compressed digest `68d6d86aad984aca5cf9967d24c818d5bdf2984631b1fe9b9fa1fd30c0edbbbf`,
  5,122,102 bytes gzip /12,410,880 bytes raw after assembly. The synthetic CI step
  was included by the parent in `334edf8`; its script landed in `03eb286` before
  the parent pushed that CI state.
- Connected CatalogBrowser's existing detail action to the existing workspace
  membership dialog. Provider references retain native provider/source/layout IDs
  and append after the prior ordered entries. Lists lazily starts the catalog only
  with provider references, deduplicates across lists, performs one query at a
  time, cancels further stale work and ignores old results. Errors/unavailable
  storage have retry and do not claim Missing; a successful null lookup reports
  configured-angle unavailability.
- Focused root lint/typecheck pass; 160 tests across catalog/bootstrap/SQLite,
  workspace, playlist library and resolver pass (15 files). Added regressions for
  provider membership, lazy startup, cross-list deduplication, failure/retry versus
  configured-angle unavailability, stale pending reads and an uninstalled catalog. Native
  lint/typecheck/build pass; native90 tests plus package5 pass. Existing catalog
  browser1, bundled bootstrap5 and packaged iOS browser1 tests pass.
  Parent's final combined web suite also passes: 813 tests across 96 files, with
  output retained at `/tmp/cruxcontrol-web-integrated-tests.log`.
- Real private APK7 on isolated AndroidAPI36 /arm64 WebView133.0.6943.137:
  original `https://localhost/catalog/kilter-7x10.v1.db.gz` returns200, identity
  encoding and the exact pinned compressed byte count/SHA. Consent offer shows
  older snapshot, unknown source freshness and no live updates. Interrupted after
  a flushed65,536-byte database chunk before receipt activation; force-stop and
  relaunch reports Not installed. Then the **ordinary unmodified module Worker**
  installed the real gzip via the normal consent/import path, loaded SQLite WASM,
  queried compatible climbs and reopened in airplane mode. The worker exposes
  sync handles and Web Locks; successful write/import/query exercises them.
- Interrupted-attempt instrumentation is restricted to the emulator runner: a
  module wrapper imports the exact bundled worker, preserves queued startup
  messages, and blocks after the first flushed database chunk so the host can
  force-stop. It is absent after restart and absent from app assets. An earlier
  CDP auto-attach/debugger probe crashed the renderer; it is not used by the runner
  and is not evidence of ordinary worker failure. A brief emulator ADB offline
  transition interrupted an earlier probe; the bounded resumed proof passed.
- Real search excluded a nonexistent name and restored a known climb. Grade
  exclusion/reset,45°/40° filtering, read-only detail/board preview, provider append
  and offline list resolution/play-through pass. IndexedDB contains only
  `cruxcontrol-catalog-metadata`; **no authored-library IndexedDB database was
  created**. No service-worker registration or laptop server is involved.
- Full synthetic comparison includes every canonical field of4 draft/finished/
  Trash records (IDs/revisions/dates/status/trash timestamp, metadata, assignments,
  effect recipes/seeds/palette/targets) and2 playlists (IDs/revisions/dates/names/
  notes and ordered references, including shared and missing local references).
  All match the native preserved fixture before/after package update, interrupted
  install, successful install and offline relaunch. The only intentional change
  is one provider appended to Prototype ordered plus its revision/update time;
  prior order and all other authored fields remain identical. Snapshot reads use
  one read-only SQLite UNION statement across both tables and the production
  decode/encode/canonical backup codec; UI export delivery is a separate feature.
- Evidence stays outside Git at `/tmp/cruxcontrol-android-catalog-proof/evidence/`:
  before/upgraded/interrupted/installed/membership/offline/verified-session JSON,
  interrupted-write/result/session-result JSON and screenshots. The exact source
  for the portable proof is verified-session.json. No phone was enumerated,
  accessed, reset, uninstalled or maintained; no authored data was deleted.
- Final APK8 merged manifest/resources/config inspection confirms parent `1de6550`:
  allowBackup=false, both backup/device-transfer exclusion XML resources and
  loggingBehavior:none. MainActivity registers the separately owned SAF plugin
  (already committed `492ddf1`); its native file semantics remain portable-feature
  scope. The catalog feature does not claim automatic cloud backups or real
  device/board admission. Independent review and PR/CI remain parent-owned.
- Final integrated private build8 passed native TypeScript/Vite, Capacitor sync,
  Gradle assembly and final APK validation. The retained private artifact is
  `/tmp/cruxcontrol-android-catalog-proof/private-catalog-v8.apk`; merged manifest,
  both exclusion XML resource dumps and packaged Capacitor config are retained
  alongside it. Emulator UI and build ownership are released to the portable
  feature, which owns the same-signature APK8 source upgrade and exact comparison
  against verified-session.json before final SAF export/empty-client recovery.
  Catalog implementation is frozen for the parent-owned independent review.

## Standard review follow-up (2026-10-10)

The parent-owned Claude standard pass reviewed `03eb286` and `ef23d6f` and approved
with comments. Accepted corrections remain within this feature: `get(id, angle)`
joins angle-specific statistics, so null cannot establish global absence. Preserve
the saved reference/order and skipped playback, but label the provider row
Unavailable at the configured angle; local missing climbs retain Missing. Add a
real WASM/SQLite regression for a route with statistics only at 45° and no 40° row,
plus UI coverage for the resulting status. No schema or angle-fallback change.

Also prove the cold path where the catalog starts with queries=null and publishes
ready after Lists opens, both in a unit test and a bounded emulator force-stop →
Lists-first → provider resolution/play-through observation with full canonical
authored equality. Update the runner's normal offline phase to take this path and
include catalog in the existing empty-list hint. No repeat installation or import
interruption is required. Parent owns final adjudication; standard policy requires
no second independent pass.

The redundant lookup/loading-flash nit remains deferred. Mandatory private version
codes belong to Android parity. Existing evidence is private: catalog route names,
setter text and screenshots are present, and session-result.json/verified-session.json
come from the documented supplemental session rather than the original committed
runner. Do not alter historical evidence or attach that directory publicly. New
runner results retain provider identities rather than catalog names/setter text.

Follow-up verified and committed for final parent adjudication:

- The added real WASM/SQLite test inserts a fictional 45°-only route, proves lookup
  at 45° succeeds and lookup at 40° returns ready/null while its statistics remain
  present. Workspace regression tests verify Unavailable at 40°, retained ordered
  references and unavailable playback without a false Missing label. Local Missing
  behavior is unchanged. The old label fails these tests before the correction.
- The cold unit test starts queries=null, confirms no eager startup/read, publishes
  ready after Lists requests start, then resolves the provider and shows its board
  preview in play-through. It permits the existing harmless repeat read during the
  service subscription handoff; this pass does not resolve the deferred relookup nit.
- `smoke-android-catalog-lists.mjs` performs the bounded observation using the same
  coherent library read and Lists-first/play-through helper as the full runner.
  It accepts only the complete known synthetic fixture plus the prior native edit
  and one intentional provider append, and optionally validates/upgrades a private
  APK before restarting offline. No resets, catalog import or authored writes.
- Private APK9 passed TypeScript/Vite, Capacitor sync, Gradle assembly and final
  compressed byte/digest/Worker/WASM validation. On explicit emulator-5580 it
  upgraded APK8 in place, preserved every canonical field, then force-stopped and
  relaunched in airplane mode. Lists opened first, resolved the provider at its
  third ordered position and displayed its board preview in play-through without
  visiting Kilter first. The full library remained identical afterward. Only
  catalog-metadata IndexedDB exists and no service worker is registered. Restored
  the prior airplane setting and exited play-through; no phone operation.
- Follow-up evidence remains private at
  `/tmp/cruxcontrol-android-catalog-proof/cold-lists-v9/` (before/upgraded/cold-lists
  backups and result JSON). Result JSON contains provider identity rather than
  catalog names/setter text. APK retained at
  `/tmp/cruxcontrol-android-catalog-proof/private-catalog-v9.apk`.
- Root lint/typecheck and 169 focused tests across 16 files pass, including catalog,
  SQLite, workspace, playlist library/play-through and resolver. Script syntax and
  whitespace checks pass. The full installation/interruption runner was updated to
  share the proven Lists-first helper and emit verified-session.json, but its
  complete install cycle was deliberately not repeated. Historical evidence stays
  unchanged. No second independent review; parent owns PR/CI and final closure.

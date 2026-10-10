---
id: epic-library-preservation-android-catalog
kind: feature
stage: implementing
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
for unavailable storage or lookup errors; only a successful null lookup says
Missing. No provider refs means no catalog startup. Tests cover lazy startup,
deduplication, errors, retry and stale results alongside offline emulator resolution.

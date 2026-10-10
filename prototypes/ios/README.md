# Shared native shell prototype

This experiment packages the existing React screens with Capacitor 8.4.3 and a
native BLE adapter to prepare for iPhone testing. Xcode 27 / iOS 27 build and
startup pass, and the isolated simulator has verified synthetic library editing,
save/relaunch, import, ordered lists, update preservation, and native backup file
delivery. Physical-board operation, storage-pressure durability, native sign-in,
and production distribution remain unverified. Capacitor has not been selected as
the production framework. The isolated package pins
`@capacitor-community/bluetooth-le` 8.3.0, `@capacitor/app` 8.1.1,
`@capacitor/filesystem` 8.1.4, and `@capacitor/share` 8.0.3.

The separate app uses bundle ID `io.github.andromedus1.cruxcontrol.prototype` and
display name **CruxControl Prototype**. It loads bundled assets, with no remote
`server.url`. The `ios-prototype` build mode writes `web/dist-ios-prototype` and
selects `src/main.tsx` in this package as its entry point. It disables PWA generation
and omits service-worker registration and the update coordinator entirely. The
normal browser entry retains its existing PWA update admission behavior.

## Android library and build

The same package now includes Android with Capacitor Android 8.4.3 and the pinned
`@capacitor-community/sqlite` 8.1.1 bridge. Android stores authored climbs and
playlists in the app-specific `databases/cruxcontrol-librarySQLite.db` file, with
WAL journaling and FULL synchronization verified when opening. The two tables
retain the shared strict versioned records, including revisions, dates, metadata,
Trash, effects and ordered references. Operations share a serialized connection;
revision checks, saves, restore batches and complete backup capture use explicit
SQL transactions. A save succeeds only after commit. Unknown transaction state
requires an app restart, as does unsafe native cleanup. Unsupported
schemas and corrupt records produce errors without replacing the database or
opening a browser-storage fallback. iOS remains on its existing IndexedDB path.

Android disables OS cloud backup and device transfer for app data, with explicit
exclusion rules as well as `allowBackup=false`. Recovery must use the app's
verified library backup/recovery path; an implicit OS copy is not a recovery
guarantee. Capacitor bridge logging is disabled because bridge calls can contain
complete authored records or backup payloads.

Build with Node 22, JDK 21 and Android SDK/API 36 plus Build Tools 36.0.0. Set
`JAVA_HOME` and `ANDROID_HOME` to your local installations; keep local paths and
signing material outside Git. From the repository root:

```bash
npm --prefix prototypes/ios ci
npm --prefix prototypes/ios run sync:android
npm --prefix prototypes/ios run build:android
```

These two Android commands explicitly omit catalog data and print **COMPILE-ONLY**.
Their APK proves compilation, and is not the private dogfood build. Use the
catalog recipe below for a package with offline Kilter availability.

The generated project is `prototypes/ios/android`; the debug APK is under
`android/app/build/outputs/apk/debug/`. It uses the same application ID as the iOS
prototype, bundled assets and no remote server or service worker. The pinned BLE
plugin supplies the merged Android Bluetooth/scan/connect and legacy location
permissions. Plugin initialization and permission requests remain behind explicit
Connect. App pause/resume uses the existing foreground/disconnect contract. Real
Android BLE, physical-device behavior and destinations outside the app remain
separate acceptance gates.

The SQLite tests use Node 22's real SQLite engine for schema checking, revisions,
collision handling, Trash, corruption, rollback and ambiguous commits, concurrent
operations, whole-fixture export and file reopen. Bridge mocks verify composition
and overlapping initialization/close/reopen; they do not prove Android storage.
The Android compile also runs in CI.

For an isolated emulator preservation proof, prepare two debug APKs with the same
application ID and signing key and increasing version codes. The Gradle property
`-PprototypeVersionCode=2` overrides the default 1 for the update build. Copy each
APK outside the repository before building the next one. Use an explicitly chosen
emulator target; the runner rejects physical devices:

```bash
node --experimental-strip-types prototypes/ios/scripts/smoke-android.mjs \
  emulator-N /outside/git/initial.apk /outside/git/update.apk /outside/git/evidence
```

This requires Node 22 and `ANDROID_HOME` (or an explicit `ADB` executable). The
runner automates the normal backup file input and editor in the actual Android
WebView, imports only the synthetic fixture, verifies a complete native export,
changes one synthetic name, waits for save, force-stops/relaunches, installs the
newer binary with `adb install -r` and compares every authored field and ordered
membership. It checks the actual native database, journaling/synchronization, no
browser library databases and no service-worker registration. The runner waits for
the SAF write-success result, reads the complete JSON back from Downloads, and
validates it with the production decoder before closing the backup dialog. This
proves local provider save/readback; it does not prove a cloud provider uploaded or
retained a remote copy. Screenshots and JSON evidence stay outside Git. It
rejects unrelated existing records and can resume an interrupted synthetic proof
only after validating its original restore evidence and exact intentional edit.
It never clears storage, uninstalls the app or resets an existing library.

Android API 36 on an isolated arm64 emulator has passed fixture restore/edit/save,
process relaunch and same-signature version upgrades with canonical full-library
comparisons. This is synthetic-data evidence. Account-protected independent
backup, clean-client recovery, private signing-key preservation, real-device
storage pressure and actual board control still gate daily-use admission.

### Portable Android backup proof

The Android backup button opens the Storage Access Framework's **Save** picker.
The plugin reports “saved to the chosen location” only after the selected
provider's UTF-8 output stream closes. The portable proof selects Downloads,
reads those exact provider-written bytes back to the host, and restores them into
a separate app installation. It then compares the complete canonical library,
including Trash, effects and ordered playlist entries, makes one synthetic editor
change, force-stops the recovery app and compares again after relaunch. The current
portable runner injects the read-back bytes into the web file input with
`DataTransfer`; Android's system file chooser import path is covered separately by
the parity acceptance run and is not exercised by this runner.

Use Node 22 and two isolated API 36 emulators: a synthetic source installation
with the prior signed APK, and a fresh recovery installation. Supply the exact
validated source export as the canonical baseline and retain each run's evidence
outside Git:

```bash
node --experimental-strip-types prototypes/ios/scripts/smoke-android-portable.mjs \
  emulator-SOURCE emulator-RECOVERY /outside/git/final.apk \
  /outside/git/portable-evidence /outside/git/verified-source.json
```

The runner checks the final APK's merged backup exclusions and bridge logging
configuration, verifies the source before upgrade, applies the same-signature
update with `adb install -r`, and compares actual SAF exports before and after.
If a source-upgrade run stops after that update, pass its source-evidence directory
as the optional final argument to resume; the runner validates its machine
receipt, raw exports, canonical hashes and separate Logcat checks before taking a
fresh export. The source receipt is written immediately after the updated app's
actual SAF bytes decode and compare, before Logcat capture or dialog cleanup. The
`grade-roundtrip` mode requires the recovery package to be absent on a separate
fresh emulator; it refuses to reuse an installed recovery app. Use a new, empty
evidence directory for every attempt. The runner never clears app data, uninstalls
or resets either emulator. The cancellation check presses Android Back in the Save
picker and checks the cancellation result; it does not assume a provider left no
empty destination.

For the grade-inclusive proof, build the final APK with the expected private
catalog and record a build-boundary sidecar containing the source commit, tracked
and staged dirty state, build interval, command and APK SHA-256. Then pass that
sidecar after the `grade-roundtrip` mode. Use the accepted APK8 recovery export as
the source baseline; it has the already-verified synthetic name edit but no grade.
The run upgrades emulator 5582 in place, edits that synthetic climb to V4 at angle
45, reads the resulting SAF file back, and restores it to a separately installed
empty emulator 5586. It compares full canonical snapshots after export, restore
and force-stop/relaunch, including grade and angle. Keep both emulators offline
during the proof and keep all evidence outside Git.

```bash
node --experimental-strip-types prototypes/ios/scripts/smoke-android-portable.mjs \
  emulator-5582 emulator-5586 /outside/git/final.apk \
  /outside/git/grade-portable-evidence \
  /tmp/cruxcontrol-android-portable-proof-v8-resume1-20261010/recovery-relaunched.json \
  grade-roundtrip /outside/git/final-build-provenance.json
```

The initial 2026-10-10 APK8 run matched the catalog owner's complete synthetic
source, read the Downloads file back from the provider, restored those bytes into
the separate installation, and retained its single test edit across force-stop
and relaunch. That source fixture had no grade (angle 40), so the earlier proof did
not establish grade preservation. Its host-only evidence is at
`/tmp/cruxcontrol-android-portable-proof-v8-resume1-20261010/`; the original retry2
source-upgrade cause remains unknown because its command output and Logcat were not
retained. That operator-written receipt is superseded by the APK10 machine receipt.

The grade-inclusive APK10 run upgraded the preserved synthetic source from version
8 to 10 with `adb install -r`, verified the exact pre/post source snapshots, and
changed only the known climb from angle 40/no grade to angle 45/V4. The source edit
survived force-stop/relaunch and was written through the actual SAF Save picker.
The provider file was read back, decoded, restored into a newly created empty API
36 emulator, and compared canonically after restore and recovery relaunch. The
recovery import in this run used `DataTransfer` injection; Android's system file
chooser import is covered separately by parity acceptance. Android Back in the
Save picker reported cancellation. Checked unique Logcat canaries were absent;
Logcat truncation means the proof makes no claim that a complete backup payload
could never appear in logs.

The APK10 evidence is outside Git at
`/tmp/cruxcontrol-android-portable-grade-proof-20261010/`; its exact binary and
build-boundary provenance are at `/tmp/cruxcontrol-android-portable-proof-apk10/`.
APK SHA-256 is `c3bc59761093ffd4e1743935a36383627362199a0516796d02bc75c297a055a5`,
built from clean tracked commit `3a2e466636080582b92873bdcdf01e3fc7c32317`.
This proves local provider save/readback and isolated offline recovery, not a
cloud-backed provider upload, remote retention, owner-phone recovery or the
required automatic online backup. Verify any remote copy independently; automatic
online backup remains required before real authoring.

The APK11 follow-up did not repeat restore or cancellation. It rebooted the retained
graded recovery emulator, exported its current library through SAF, installed the
same-signature APK11 with `adb install -r`, and read back a second SAF export. The
complete canonical snapshots matched the APK10 graded recovery baseline before
and after update, including V4 at angle45. The run used no source emulator:

```bash
node --experimental-strip-types prototypes/ios/scripts/smoke-android-portable.mjs \
  - emulator-5586 /outside/git/apk11/final.apk \
  /outside/git/grade-upgrade-evidence \
  /tmp/cruxcontrol-android-portable-grade-proof-20261010/grade-recovery-relaunched.json \
  recovery-grade-upgrade /outside/git/apk11/build-provenance.json
```

This mode requires the retained recovery installation and a newer APK. It neither
restores again nor clears or uninstalls the app. APK11 evidence is outside Git at
`/tmp/cruxcontrol-android-portable-grade-upgrade-apk11-20261010/`; the APK and
build-boundary sidecar are in `/tmp/cruxcontrol-android-portable-proof-apk11/`.
Its APK SHA-256 is
`419248fc966ba36a0698897a97ef676f4a50d7c01151a253198cd8cf653d2d0e`, built from
clean tracked commit `bd57b1ebdab9d1f21414eaf72794be1b2c03391c`.

## Private Android catalog package

Use Node 22, JDK 21, API 36/Build Tools 36.0.0 and the standard `zip`/`unzip`
tools. Supply the catalog gzip explicitly; keep that binary and all APKs outside
Git and public workflow uploads. The committed `web/public/catalog/manifest.json`
is the expected artifact: 5,122,102 gzip bytes, 12,410,880 raw bytes, SHA-256
`68d6d86aad984aca5cf9967d24c818d5bdf2984631b1fe9b9fa1fd30c0edbbbf`.
It remains an older Legacy Kilter snapshot with unknown source freshness and no
live updates.

```bash
npm --prefix prototypes/ios run build:android:catalog -- \
  --catalog /outside/git/kilter-7x10.v1.db.gz --version-code 2
```

The private recipe rejects absent or mismatched input before building. It reuses
the production manifest parser, verifies bounded size/digest/gzip/raw size/SQLite
header, writes atomically into the web build output, syncs Android and checks both
synced assets and the final APK. It also follows the reachable module Worker and
SQLite WASM references. It never rewrites the expected source manifest. The
packaged manifest and exact gzip digest must agree with that source.

AGP 8.13's asset merger unconditionally expands filenames ending in `.gz` before
AAPT. Its [noCompress option](https://developer.android.com/reference/tools/gradle-api/8.13/com/android/build/api/dsl/AndroidResources#noCompress())
controls ZIP storage compression, so the private package uses `.db.gz.bin` and a
native alias for the exact local manifest-declared `.db.gz` URL. It serves the
original gzip bytes with identity encoding; the normal importer retains its
strict origin, compressed-size, SHA-256 and database validation. Other requests
retain Capacitor's routing.

`npm --prefix prototypes/ios run test:catalog-package` uses shareable synthetic
artifacts to test invalid inputs and final-APK regressions, including Android's
old expanded-database failure. Generic CI performs those tests and a compile-only
build; it neither includes nor uploads the private catalog.

After the native preservation proof has restored the complete synthetic fixture,
provide its expected whole-library backup and run against an explicit emulator:

```bash
node --experimental-strip-types prototypes/ios/scripts/smoke-android-catalog.mjs \
  emulator-N /outside/git/private.apk /outside/git/expected-synthetic.json \
  /outside/git/catalog-evidence
```

The runner rejects unrelated authored records, verifies the final APK and actual
canonical local gzip response, uses the normal consent flow, and compares complete
canonical library snapshots. Its interrupted attempt imports the exact packaged
worker through an emulator-only module wrapper and stops after flushing a real
64 KB database chunk. Force-stop/relaunch restores the ordinary Worker: an
interrupted candidate stays inactive, then the unmodified Worker/WASM importer
installs normally. It checks search/grade/angle, detail, one intentional ordered
provider append, airplane-mode relaunch, list resolution and board preview in
play-through. Only catalog receipt metadata uses IndexedDB on Android.

If a UI assertion interrupts the run after installation but before membership,
`--resume-installed` requires the saved interrupted/reinstalled canonical evidence
and continues without clearing catalog or authored storage. Evidence remains
outside Git. API 36 / WebView 133 has passed these checks with the pinned real
snapshot. This does not establish current official coverage, physical-board
operation, public redistribution or account-backed automatic recovery.

For a bounded follow-up against that already-installed catalog, use the expected
complete synthetic backup after the intentional provider append:

```bash
node --experimental-strip-types prototypes/ios/scripts/smoke-android-catalog-lists.mjs \
  emulator-N /outside/git/expected-session.json /outside/git/cold-lists-evidence \
  /outside/git/optional-private-upgrade.apk
```

The APK argument is optional. When present, the runner checks its private catalog,
compares the entire library before and after `install -r`, then force-stops and
opens Lists first in airplane mode, without visiting Kilter first. It verifies
provider resolution/play-through and complete unchanged authored contents without
another catalog install or reset. The full runner now also uses this Lists-first
offline path and emits `verified-session.json`. New JSON results retain provider
identities rather than catalog names/setter text. Earlier private evidence also
contains catalog text and screenshots; its supplemental `session-result.json` and
`verified-session.json` came from a separate documented session. Retain that
historical evidence unchanged and never attach its directory publicly.

## Android interaction and retained private signing

Android list sharing uses the same Storage Access Framework write/close handoff
as library backups. With no recipient-accessible web host configured, the dialog
provides the complete playlist JSON file and omits origin-based links. Browser
sharing retains its current URL/copy/download behavior. Hardware Back calls the
existing logical dialog, detail, editor and play-through actions; pending imports,
file saves and membership writes consume it until completion. At the root, pending
writes and unsaved list changes prevent minimizing.

Private catalog builds require an explicit `--version-code` from 1 through
2100000000. Choose a value above the installed package, and retain both the same
application ID and signing key. Never use `adb install -d`, uninstall or storage
reset to work around an update failure. Debug builds retain the Android debug key
and cannot be upgraded with a different private key.

Keep a durable keystore and its credentials outside Git, with restricted directory
and file permissions. Release builds read only these environment variables:
`CRUX_ANDROID_KEYSTORE`, `CRUX_ANDROID_KEY_ALIAS`,
`CRUX_ANDROID_STORE_PASSWORD`, `CRUX_ANDROID_KEY_PASSWORD`. Load them from an
excluded local credentials file without printing them. The repository ignores
keystores and environment files; a local signing directory must also be excluded.
Missing credentials fail the signed recipe before a build; no debug-key fallback.

```bash
set -a
source /outside/git/private-signing/credentials.env
set +a
npm --prefix prototypes/ios run build:android:release -- \
  --catalog /outside/git/kilter-7x10.v1.db.gz --version-code 20
```

The output is `prototypes/ios/android/app/build/outputs/apk/release/app-release.apk`.
The release disables debugging. `build:android:signed-proof` instead creates an
explicitly labeled instrumented synthetic-emulator variant using that same key
and app ID; never distribute it for everyday authoring. Both recipes verify the
final private catalog package and write an adjacent `.apk.build.json` sidecar
with exact APK SHA-256, source commit and clean-tree status. Keep that sidecar
with the APK when copying it; the signed runner verifies it when present. Keep all APKs private. Android's signing and version
contracts are described in its [build variants](https://developer.android.com/build/build-variants)
and [versioning](https://developer.android.com/studio/publish/versioning) guides.

Before owner-phone rollout, Andrew must copy both keystore and credentials into
an independent encrypted location outside this laptop, retrieve them, and verify
the retrieved key by building/signing a package and matching its certificate
SHA-256 using `apksigner verify --print-certs`. A copy on the same laptop is not
accepted retention. Never rotate a lost key or change the app ID as an update
shortcut. No owner-phone installation is authorized by emulator proof.

A repeatable signing proof takes an explicit isolated emulator, an instrumented
initial APK, a higher-version non-debuggable release APK, a complete synthetic
backup and a new evidence directory:

```bash
node --experimental-strip-types prototypes/ios/scripts/smoke-android-signed.mjs \
  emulator-N /outside/git/signed-proof.apk /outside/git/release.apk \
  /outside/git/expected-synthetic.json /outside/git/new-evidence
```

The runner checks the same signing certificate, stable app ID, increasing version
and final-release debugging flag. It restores through the actual Android system
document chooser when empty, preserves an exact existing synthetic library when
resuming, then compares complete actual provider-written SAF backups before and
after `install -r` and after release process relaunch. The real release is operated
through native UI events, without enabling WebView debugging.

API36 synthetic emulator evidence establishes local Back, keyboard resizing,
timeout prevention/background wake-lock release, native file chooser and retained
signature upgrade behavior. Physical phone permissions, Fullride lighting/clear,
effects, pause/interruption and explicit reconnect remain required acceptance.
The parity feature stays implementing until these actions and independent key
retention pass. Automatic online backup and clean-install online recovery also
remain required before irreplaceable everyday authoring.

## Native transport boundary

The prototype's composition root injects `NativeBleByteTransport` through the
existing installation registry and `BoardByteTransport` port. It reuses the React
UI, controller, Aurora codecs, capacity/pacing policy and effects. Android injects
a native SQLite library; iOS and packaged browser inspection use the existing
IndexedDB library repositories. Opening the packaged assets in a browser exposes an
unavailable transport; it does not fall back to Web Bluetooth.

Bluetooth initialization and device selection begin only after explicit **Connect**.
The selected device is remembered in memory for the current runtime only; a new
session must choose again. Native `pause` (backgrounding) invalidates pending work
and disconnects. `resume` permits an explicit reconnect; it does not reconnect or
restart effects automatically. `Info.plist` supplies the Bluetooth usage description
without adding a background Bluetooth mode.

The adapter copies caller buffers and serializes write batches in FIFO order.
Connection generations reject stale chooser, connect, and write completions;
disconnect bypasses the write queue, and reconnect waits for pending native writes
and cleanup. The Nordic UART characteristic must advertise a supported write mode:
without-response is preferred, with-response is the fallback. Native connect uses
a 10-second timeout and each native write uses a 5-second timeout. These application
contracts still need real-device validation.

## Setup

Install the root dependencies using the root `.nvmrc` (Node 20). The prototype is a
separate npm package with its own lockfile and `.nvmrc` (Node 22); use Node 22 or
newer for its commands. With both Node versions available through nvm:

```bash
# From the repository root
nvm use
npm ci
cd prototypes/ios
nvm use
npm ci
npm run sync
```

`sync` typechecks the adapter, builds the shared web code in prototype mode, copies
its assets, and synchronizes the native plugins into the committed Swift Package
Manager project, `ios/App/App.xcodeproj`. Re-run it after web, adapter, or plugin
changes. The privacy manifest declares the file-timestamp API reason required by
the Filesystem plugin for app-container file access. Generated bundles and
installed packages are ignored by Git.

A native build needs full Xcode and an installed iOS simulator runtime; standalone
Command Line Tools are insufficient. Capacitor's requirements are in its
[environment setup guide](https://capacitorjs.com/docs/getting-started/environment-setup).
The verified development host is macOS 26.6 arm64 with Xcode 27.0 (27A266a),
the iOS 27.0 simulator runtime (24A434), and Node 20.20.2 / 22.23.3 installed
through nvm. The shell's global Node selection and developer directory remain
unchanged. Apple's [Device Hub documentation](https://developer.apple.com/documentation/xcode/device-hub)
covers simulator management in this Xcode version.

From the repository root, open the project or run the repeatable isolated startup
check with an explicitly selected simulator ID:

```bash
npm --prefix prototypes/ios run open
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer prototypes/ios/scripts/smoke-simulator.sh YOUR_SIMULATOR_ID
```

Adjust `DEVELOPER_DIR` if Xcode has a different name or location. The script builds,
installs, launches, checks that the process remains alive after five seconds, and
saves a startup screenshot and logs to a temporary evidence directory (or the
optional second argument). Inspect the screenshot manually. The verified isolated
target was an iPhone 17 simulator. No signing team or simulator identifier is
committed; physical-device signing remains to be configured when a test phone is
available.

## Synthetic library

Use only [the synthetic backup](fixtures/synthetic-library.json) in this experiment.
It contains four climbs (one draft, two finished, one in Trash), two ordered lists
with shared membership, a spatial effect recipe, and a reference to a missing climb.
It contains no personal library data. The app does not seed it automatically.

Open **Back up & restore**, choose the fixture through **Library backup file**,
review it, and explicitly restore it. Make the file available to the simulator's
file picker first. Keep experiments in this separate app; do not import personal
backups or alter the established browser/PWA origin to perform these checks.

The iOS shell uses the existing IndexedDB repositories. Their availability
here is not a durable native-storage decision for iOS. In the isolated iPhone 17 / iOS 27
simulator, the synthetic fixture imported through the normal picker, a created V4
draft survived save and relaunch, and the fixture's ordered list contents remained
intact. A native app update also retained the synthetic records and list order.
These checks do not establish preservation under storage pressure or on physical
devices.

## Checks and evidence boundaries

Run the adapter's static checks and deterministic transport tests, then the browser
smoke check against the packaged-mode web assets (use Node 22+):

```bash
# From the repository root, after dependency installation
npm --prefix prototypes/ios run lint
npm --prefix prototypes/ios run typecheck
npm --prefix prototypes/ios run test
npm --prefix prototypes/ios run build
npm -w web run test:ios-prototype
```

Playwright's Chromium browser must be installed (`npx playwright install chromium`
from `web/` when needed).

The transport tests exercise a fake native client, including explicit connection,
write ordering/modes, copied buffers, cancellation, stale completions, failures,
and shared Fullride light/clear packets. They do not execute CoreBluetooth. The
browser smoke checks startup, fixture restore/export, and preservation through
browser reload in Chromium. It cannot establish that these operations work in
WKWebView. Native compilation, isolated simulator launch, and the interactions
recorded below pass; startup shows no Bluetooth permission prompt. Scene safe-area
layout keeps controls clear of the status bar, and focusing Name or Grade does not
cause horizontal page zoom.

Record further simulator results against the commit, Xcode version, simulator model,
and iOS runtime in the owning work item:

- Launch the packaged app and navigate Drafts, Finished, Trash, Lists, and the editor.
  Check board rendering, scrolling, text input, and navigation back to the library.
- Restore the fixture through the normal UI. Confirm four climbs, both lists,
  membership order, the missing-climb reference, and the saved effect recipe.
  The actual simulator check restored four climbs and two playlists; the ordered
  list check preserved fixture order and the missing-reference position.
- Edit a synthetic climb, finish saving, terminate and relaunch the app, and confirm
  the edit and list order remain. Record the original fixture and intentional edit
  separately so preservation comparisons are meaningful.
- Export through **Save or share library backup**, cancel once, then retry and
  choose **Save to Files** in the iOS share sheet. Cancellation leaves the dialog
  usable and retains the app-owned cache copy until the next export preflight,
  because a nested share destination may still need it. The successful path saves
  an actual JSON file; the app reports that export completed and asks users to check the chosen destination. The simulator's saved JSON was decoded
  with the production codec and matched all four fixture records, both ordered
  playlists, Trash, missing-reference membership and effect recipe, plus the
  separately created V4 draft. The owned cache copy is removed after successful
  share completion. A separate empty simulator reviewed and restored the saved file
  through the normal picker, retained its five climbs and two playlists after
  relaunch, and re-exported a canonical snapshot matching the first export in
  every record and ordered membership (ignoring the export timestamp). Its owned
  cache copy was also removed after the share sheet completed. The corrected
  cancellation/retry path was then verified with a distinct OS destination name
  and another exact canonical comparison. Include repeated exports to an existing
  filename in physical-device picker acceptance.
- Press **Connect** and confirm unsupported Bluetooth is reported: the native BLE
  plugin does not support the iOS simulator. Library startup should not initialize
  Bluetooth or open a permission prompt. No simulated board success is added.

The interactive simulator checks above establish behavior only for the isolated
synthetic dataset and the exercised simulator paths. A real iPhone and Fullride
board are required for light/clear, permission denial,
interruption/reconnect, foreground recovery,
and actual-device responsiveness. Check that backgrounding ends the session and
returning requires explicit reconnect before lighting or effects can resume.
Synthetic-data preservation across an app update passed on the simulator.
Physical-device update preservation, an explicit durable-storage strategy, and
native sign-in/API behavior remain acceptance gates.

The [native BLE feature](../../.work/active/features/epic-ios-controller-bridge-native-ble.md)
owns adapter preparation and its review/CI evidence. The
[iOS controller epic](../../.work/active/epics/epic-ios-controller-bridge.md)
owns the remaining native acceptance gates. The
[client comparison](../../.research/analysis/briefs/ios-shared-client.md) and
[prior-art review](../../.research/analysis/landscapes/ios-board-client-prior-art.md)
explain why this shell is the first experiment and what could change the framework
decision.

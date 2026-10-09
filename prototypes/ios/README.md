# iOS shell prototype

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

## Native transport boundary

The prototype's composition root injects `NativeBleByteTransport` through the
existing installation registry and `BoardByteTransport` port. It reuses the React
UI, controller, Aurora codecs, capacity/pacing policy, effects, and IndexedDB
library repositories. Opening the packaged assets in a browser exposes an
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

The shell currently uses the existing IndexedDB repositories. Their availability
here is not a durable native-storage decision. In the isolated iPhone 17 / iOS 27
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

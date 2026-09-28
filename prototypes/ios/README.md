# iOS shell prototype

This experiment packages the existing React screens with Capacitor 8.4.3 and a
native BLE adapter to prepare for iPhone testing. Native compilation and real-board
operation remain unverified; Capacitor has not been selected as the production
framework. The isolated package pins `@capacitor-community/bluetooth-le` 8.3.0 and
`@capacitor/app` 8.1.1.

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
changes. Generated bundles and installed packages are ignored by Git.

A native build needs full Xcode 26 or newer and an installed iOS simulator runtime.
Standalone Command Line Tools are insufficient. Capacitor's requirements are in
its [environment setup guide](https://capacitorjs.com/docs/getting-started/environment-setup).
As checked on 2026-09-28, the development Mac has macOS 26.3, selects standalone
Command Line Tools, and has no installed Xcode app. Xcode 26.6 supports that macOS
version; Xcode 27 requires macOS 26.6 or newer,
according to [Apple's compatibility table](https://developer.apple.com/xcode/system-requirements/).
An OS upgrade is therefore not required to try this prototype with compatible Xcode.

After installing compatible Xcode, completing its first-launch setup, and adding
an iOS simulator runtime, use these commands from the repository root:

```bash
npm --prefix prototypes/ios run open
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer npm --prefix prototypes/ios run run
```

Adjust `DEVELOPER_DIR` if Xcode has a different name or location. This selects the
tools for that command without changing the global developer directory. `open`
opens the project in Xcode; `run` rebuilds/syncs and asks for a run target. Select
an iPhone simulator. No signing team is committed; physical-device signing remains
to be configured when a test phone is available.

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
here is not a durable native-storage decision. Backup file selection, download,
and recovery through WKWebView also remain unproved. A successful reload or
relaunch does not establish preservation under storage pressure or across updates.

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
browser reload in Chromium. It cannot establish that the Xcode project compiles or
that these operations work in WKWebView. Native compile and simulator checks have
not yet run.

Once Xcode is available, record simulator results against the commit, Xcode version,
simulator model, and iOS runtime in the owning work item:

- Launch the packaged app and navigate Drafts, Finished, Trash, Lists, and the editor.
  Check board rendering, scrolling, text input, and navigation back to the library.
- Restore the fixture through the normal UI. Confirm four climbs, both lists,
  membership order, the missing-climb reference, and the saved effect recipe.
- Edit a synthetic climb, finish saving, terminate and relaunch the app, and confirm
  the edit and list order remain. Record the original fixture and intentional edit
  separately so preservation comparisons are meaningful.
- Export through **Download library backup** and inspect the actual saved file.
  Verify IDs, revisions, lifecycle states, list ordering/membership, and recipes;
  restore into a separate empty test simulator and compare. If file selection or
  download fails, record the native gap instead of counting the dialog as a pass.
- Press **Connect** and confirm unsupported Bluetooth is reported: the native BLE
  plugin does not support the iOS simulator. Library startup should not initialize
  Bluetooth or open a permission prompt. No simulated board success is added.

All simulator checks above are pending. A real iPhone and Fullride board are required
for light/clear, permission denial, interruption/reconnect, foreground recovery,
and actual-device responsiveness. Check that backgrounding ends the session and
returning requires explicit reconnect before lighting or effects can resume.
Synthetic-data preservation across an app update, an explicit durable-storage
strategy, and native sign-in/API behavior also remain acceptance gates.

The [native BLE feature](../../.work/active/features/epic-ios-controller-bridge-native-ble.md)
owns adapter preparation and its review/CI evidence. The
[iOS controller epic](../../.work/active/epics/epic-ios-controller-bridge.md)
owns the remaining native acceptance gates. The
[client comparison](../../.research/analysis/briefs/ios-shared-client.md) and
[prior-art review](../../.research/analysis/landscapes/ios-board-client-prior-art.md)
explain why this shell is the first experiment and what could change the framework
decision.

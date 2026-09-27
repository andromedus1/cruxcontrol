# iOS shell prototype

This experiment packages the existing React screens with Capacitor 8.4.3 to prepare
for iPhone testing. It is the first preparation step: a native BLE adapter has not
been added, and Capacitor has not been selected as the production framework.

The separate app uses bundle ID `io.github.andromedus1.cruxcontrol.prototype` and
display name **CruxControl Prototype**. It loads bundled assets, with no remote
`server.url`. The `ios-prototype` build mode writes `web/dist-ios-prototype` and
disables PWA generation and service-worker registration. Browser builds retain
their existing PWA update admission behavior.

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

`sync` builds the shared web code in prototype mode and copies its assets into the
committed Swift Package Manager project, `ios/App/App.xcodeproj`. Re-run it after
web changes. Generated bundles and installed packages are ignored by Git.

A native build needs full Xcode 26 or newer and an installed iOS simulator runtime.
Standalone Command Line Tools are insufficient. Capacitor's requirements are in
its [environment setup guide](https://capacitorjs.com/docs/getting-started/environment-setup).
As checked on 2026-09-27, the development Mac has macOS 26.3 and only Command Line
Tools. Xcode 26.6 supports that macOS version; Xcode 27 requires macOS 26.6 or newer,
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

The browser smoke check runs against the packaged-mode web assets:

```bash
# From the repository root, after dependency installation
npm --prefix prototypes/ios run build
npm -w web run test:ios-prototype
```

Playwright's Chromium browser must be installed (`npx playwright install chromium`
from `web/` when needed).

It checks startup, fixture restore/export, and preservation through browser reload
in Chromium. It cannot establish that the Xcode project compiles or that these
operations work in WKWebView. Native compile and simulator checks have not yet run.

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
- Confirm connection controls report unsupported: the shell still uses Web
  Bluetooth, which WKWebView does not provide. No simulated board success is added.

All simulator checks above are pending. Native BLE integration is the next distinct
preparation task; an iOS simulator cannot validate Bluetooth delivery. A real
iPhone and Fullride board are required for light/clear, permission denial,
interruption/reconnect, foreground recovery, and actual-device responsiveness.
Synthetic-data preservation across an app update, an explicit durable-storage
strategy, and native sign-in/API behavior also remain acceptance gates.

The [iOS controller epic](../../.work/active/epics/epic-ios-controller-bridge.md)
owns the remaining work and acceptance evidence. The
[client comparison](../../.research/analysis/briefs/ios-shared-client.md) and
[prior-art review](../../.research/analysis/landscapes/ios-board-client-prior-art.md)
explain why this shell is the first experiment and what could change the framework
decision.

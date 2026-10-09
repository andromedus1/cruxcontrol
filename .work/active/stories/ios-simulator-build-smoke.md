---
id: ios-simulator-build-smoke
kind: story
stage: review
tags: [infra, ble]
parent: null
depends_on: [epic-ios-controller-bridge-native-ble]
release_binding: null
gate_origin: null
created: 2026-10-09
updated: 2026-10-09
---

# Compile and launch the isolated iOS prototype on the new Mac

## Brief

Andrew confirmed the laptop migration is complete and authorized installing the
development tooling and resuming work. Establish a repeatable native simulator
build and startup check for the existing isolated prototype. This bounded proof
belongs to the broader [iOS epic](../epics/epic-ios-controller-bridge.md); it does
not close that epic's physical BLE, durable storage, backup, sign-in or distribution
gates. Community-catalog work can proceed independently on Android/web.

## Acceptance

- Install/verify compatible Xcode and an iOS simulator runtime, recording versions.
- Restore the root Node 20 and prototype Node 22 environments from committed
  lockfiles; build and synchronize the prototype assets and plugins.
- Compile the actual native project for an iPhone simulator without committing a
  signing identity or device identifier.
- Install and launch the isolated app; inspect startup and record observed results.
- Document repeatable commands and precisely separate completed checks from the
  remaining synthetic-library interactive checklist and physical acceptance.

## Simplification opportunity

Reuse the committed Capacitor/SPM project and synthetic fixture. Do not introduce
another shell, production framework decision, personal-data migration or fake
Bluetooth success to compensate for unavailable hardware.

## Execution

- Capability: current host, with direct ownership of tooling and native build
  diagnosis; ordinary reversible setup is covered by Andrew's instruction.
- Review weight: standard from `.work/CONVENTIONS.md`; standalone story uses
  bounded inline review after verification.
- Initial preflight: macOS 26.6, arm64; standalone Command Line Tools selected,
  no Xcode app or `simctl`. App Store metadata identifies compatible stable Xcode
  27.0. The automatic install requires local authentication; its App Store page
  is open for Andrew to complete that step.
- Installed `mas` and `nvm` through the existing Homebrew installation. Installed
  Node 20.20.2 and 22.23.3 using nvm, verified download checksums, and restored
  both npm packages with `npm ci`. Existing global Node and shell profile are
  unchanged; commands explicitly source the nvm loader.

## Verification checkpoint

- Root lint, typecheck, 664 web tests, and production build passed on Node20.
- Prototype lint, typecheck, 30 native-adapter contract tests, asset build and
  Capacitor plugin sync passed on Node22. Packaged Chromium synthetic-library
  restore/export/reload smoke passed (1 test). These are browser/contract checks.
- Xcode27.0 (27A266a) installed; Andrew completed its first-launch license and
  components. Installed iOS27.0 arm64 runtime (24A434) through `xcodebuild
  -downloadPlatform iOS`. Created an isolated iPhone17 simulator for synthetic work.
- Native project scheme App compiled successfully with `CODE_SIGNING_ALLOWED=NO`.
  Resolved Swift package8.4.3 at89e0d8ec2321025f549ddb19259a717467943b97; committed
  the generated Package.resolved to make native package resolution reproducible.
- First launch exposed UIKit's enforced scene lifecycle; the focused
  [scene repair](idea-ios-scene-launch.md) now passes the real native startup check.
  The [safe-area repair](idea-ios-status-bar-overlap.md) then resolved observed
  status-bar overlap using native content insets. No global xcode-select change.
- `prototypes/ios/scripts/smoke-simulator.sh` compiles, installs, launches, requires
  process survival, and captures a screenshot. On the same isolated simulator,
  inspected final screenshot shows My Climbs, empty local collections, backup,
  screenshot import, visible Connect/Screen awake, and no startup Bluetooth prompt.
  Evidence lives outsideGit under `/tmp/cruxcontrol-ios-safe-area/`; no simulator
  identifiers or raw logs/screenshots enter this commit.
- Compiler warnings remain in pinned plugin dependencies (unused manufacturer-data
  filter cast and optional language coercion), plus skipped AppIntents metadata.
  Neither path is exercised by this startup proof; physical/plugin behavior stays
  subject to its real acceptance gates.

## Pending evidence

Interactive WKWebView fixture restore/export, editing and ordered-list preservation
across relaunch/update have not run. No physical iPhone/BLE, native sign-in, durable
storage-pressure or distribution acceptance is implied. Those remain in the iOS epic.
The guide owns repeatable setup and the remaining checklist; this bounded story owns
native compile/install/startup evidence only.

## Review (2026-10-09)

Bounded inline review: setup used pinned packages, command-scoped developer tools,
isolated simulator and synthetic empty library. Confirmed native build and visual
startup evidence, repeatable commands, no identifiers/secrets/personal data staged.
No independent story reviewer ran. Required aggregate CI remains to be completed.

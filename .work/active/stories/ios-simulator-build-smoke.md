---
id: ios-simulator-build-smoke
kind: story
stage: implementing
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

## Pending evidence

Native compile and simulator launch have not run. Xcode installation and a runtime
are prerequisites. The iOS epic remains open regardless of this story's result.

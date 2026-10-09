---
id: idea-ios-scene-launch
kind: story
stage: implementing
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-10-09
updated: 2026-10-09
tags: [ble, infra]
---

# Prototype cannot launch with the iOS 27 SDK

Native simulator build/install succeeds on Xcode27.0, but the isolated prototype
exits at startup. Reproduced twice on iPhone17/iOS27.0 simulator. UIKit reports:
`Application failed to launch: UIScene life cycle is required for apps built with
this SDK.` The committed AppDelegate/Main storyboard uses the older application
lifecycle and Info.plist has no scene manifest. Keep this failure visible while
repairing; native startup is not a passing check. No personal library or phone
was involved.

## Root cause and bounded fix

The isolated Capacitor8.4.3 template registers only the application delegate. The
installed iOS27 SDK enforces scene lifecycle at launch. Adopt one storyboard-backed
window scene while retaining the current bridge, bundle origin and existing plugin
versions. Forward cold and warm scene URLs/user activities through the existing
Capacitor ApplicationDelegateProxy; leave aggregate UIApplication notifications to
UIKit so App8.1.1 pause/resume listeners retain their semantics.

Grounding: Apple's [scene migration guide](https://developer.apple.com/documentation/uikit/transitioning-to-the-uikit-scene-based-life-cycle)
confirms the launch requirement, storyboard window creation, and continued aggregate
UIApplication notifications. Its primary DocC JSON was read on2026-10-09. The pinned
App plugin subscribes to those notifications. The current upstream Capacitor template
uses a newer SceneDelegateProxy absent from8.4.3; do not call an unavailable API or
upgrade dependencies to compensate.

## Regression and acceptance

A simulator launch liveness check reproduced the failure before the fix, after a
successful native build and install. Commit a repeatable native smoke script: build,
install, launch, require the launched process to remain alive, and capture a screenshot
for workspace inspection. Run it against the same isolated simulator before/after.
Verify packaged workspace appears and no Bluetooth permission appears at startup.
This does not establish physical Bluetooth, backup round trips or durable storage.
The broader build/startup story records tool versions and guide updates separately.

## Execution

Host inline focused repair via fix/implement; standard standalone bounded review.
No personal library or phone maintenance, no identity/signing data in Git.

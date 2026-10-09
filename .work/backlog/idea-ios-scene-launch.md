---
id: idea-ios-scene-launch
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

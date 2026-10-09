---
id: idea-ios-status-bar-overlap
kind: story
stage: implementing
parent: null
depends_on: [idea-ios-scene-launch]
release_binding: null
gate_origin: null
created: 2026-10-09
updated: 2026-10-09
tags: [ui]
---

# Native prototype status bar overlaps workspace controls

After resolving the iOS27 launch failure, the actual iPhone17 simulator screenshot
shows Screen awake and Connect under the status bar. The rest of My Climbs renders.
The prototype currently accepts Capacitor's content-inset default; investigate the
native viewport/safe-area configuration before claiming usable native startup.
Reproduction image is outside Git at /tmp/cruxcontrol-ios-scene-after/startup.png.
No personal data is present.

## Bounded repair

Set the isolated shell's native webview content-inset policy to respect safe areas,
using the pinned Capacitor configuration supported by its source. Preserve browser
layout and scene/transport semantics. This is an existing-screen bug, so no new mock
is required. Capture actual simulator before/after screenshots and inspect top
controls; the native smoke script checks continued launch. Keep fixed editor actions
in view when performing the remaining interactive native checklist.

## Execution

Inline fix, standard standalone review. Dependency has verified native launch at
review. No phone or personal library update. Native screenshot is the meaningful
regression evidence here; jsdom cannot reproduce UIKit safe-area geometry.

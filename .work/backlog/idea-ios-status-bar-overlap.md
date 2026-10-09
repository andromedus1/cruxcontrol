---
id: idea-ios-status-bar-overlap
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

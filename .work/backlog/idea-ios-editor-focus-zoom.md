---
id: idea-ios-editor-focus-zoom
created: 2026-10-09
updated: 2026-10-09
tags: [ui]
---

# Native editor zooms and clips controls on text entry

Actual iPhone17/iOS27 simulator interaction: open a new climb, focus Name and enter
synthetic text, then Grade and enter V4. WKWebView zooms from a402-point content
width to536points, clips the right side of fields/tools, and leaves Back offscreen
after the keyboard's Done action. The screenshot and accessibility hierarchy verify
the effect, not a browser emulation. This makes basic editing awkward despite the
safe initial viewport. Investigate computed field typography and iOS focus zoom;
do not disable user pinch zoom to hide it.

Evidence outsideGit: `/tmp/cruxcontrol-native-keyboard.png`,
`/tmp/cruxcontrol-native-after-done.png`, and the interaction logs under
`/tmp/cruxcontrol-native-maestro-edit-rest/`. Only synthetic data was used.

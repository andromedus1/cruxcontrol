---
id: story-fix-ios-editor-focus-zoom
kind: story
stage: implementing
tags: [ui, bug]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-10-09
updated: 2026-10-09
---

# Prevent iOS editor zoom when focusing text fields

## Symptom

On an iPhone 17 / iOS 27 simulator, creating a climb and entering text in Name,
then Grade, makes WKWebView zoom from a 402-point content width to 536 points.
The right sides of the fields and tools become clipped, and Back stays offscreen
after dismissing the keyboard. The screenshot and accessibility hierarchy verify
the behavior; it is not inferred from browser emulation. Only synthetic data was
used.

Evidence outside Git: `/tmp/cruxcontrol-native-keyboard.png`,
`/tmp/cruxcontrol-native-after-done.png`, and interaction logs under
`/tmp/cruxcontrol-native-maestro-edit-rest/`.

## Root cause

The route-editor stylesheet uses the undefined `--font-size-md` token in the
editable fields' font shorthand. When that declaration is invalid, the controls
inherit the 12px monospaced label font. iOS zooms focused text controls whose
computed font is smaller than 16px. The board zoom buttons use the same undefined
token.

## Fix approach

Use the existing 16px `--font-size-base` design token in both affected font
shorthands. Preserve normal pinch zoom and viewport behavior.

## Regression test

Add a computed-style assertion to the existing phone-viewport route-editor
Playwright test. The Name, Angle, and Grade controls must compute to 16px.

## Acceptance criteria

- [ ] Editable Name, Angle, and Grade controls compute to 16px in the phone-width
      browser test.
- [ ] Route-editor CSS no longer references the undefined `--font-size-md` token.
- [ ] Existing phone pinch zoom remains available and layout constraints are not
      used to mask the focus behavior.

## Simplification opportunity

No broader typography or viewport cleanup is included; replacing the invalid token
with the existing canonical base token removes the broken fallback path.

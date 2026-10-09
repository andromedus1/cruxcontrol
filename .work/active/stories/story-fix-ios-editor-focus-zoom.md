---
id: story-fix-ios-editor-focus-zoom
kind: story
stage: review
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

- [x] Editable Name, Angle, and Grade controls compute to 16px in the phone-width
      browser test.
- [x] Route-editor CSS no longer references the undefined `--font-size-md` token.
- [x] Existing phone pinch zoom remains available and layout constraints are not
      used to mask the focus behavior.

## Simplification opportunity

No broader typography or viewport cleanup is included; replacing the invalid token
with the existing canonical base token removes the broken fallback path.

## Implementation notes

- Execution capability: bounded CSS correction with the existing Playwright editor workflow; project default review weight is standard.
- Files changed: `web/src/route-editor/RouteEditorWorkspace.css`, `web/e2e/local-route-editor.spec.ts`.
- Regression test: the existing phone-viewport e2e now checks computed font size for Name, Angle, and Grade. Before the CSS fix it failed with Name at `12px`; after the fix all three compute to `16px`.
- Confirmation: `vite build` passed; all four tests in `web/e2e/local-route-editor.spec.ts` passed, including the new assertion. The existing viewport meta remains `width=device-width, initial-scale=1.0`, which leaves pinch zoom enabled.
- Native confirmation: parent rebuilt/synchronized the prototype, compiled and
  installed it over the isolated app without clearing data, then focused Name and
  Grade. Both now fit the 402-point viewport without horizontal zoom/clipping;
  the Name-focused hierarchy proves the document remains402points wide (before:
  536). Screenshots: `/tmp/cruxcontrol-native-font-focused.png` and the
  `native-grade-focused.png` artifact under `/tmp/cruxcontrol-native-maestro-font-grade-after/`.
  Normal keyboard-driven vertical scrolling remains; Back returns to the selected
  climb's detail dialog, where the saved V4 grade is intact.
- Adjacent issues parked: none.

## Bounded inline review (2026-10-09)

Approve the two-token correction after browser red/green evidence and actual native
focus inspection. It restores the declared design-system font without restricting
user zoom, changing persistence, or introducing platform branches. No independent
story reviewer ran. Latest CI is pending a timing correction to the existing
sparse-effects save test; the prototype lane passed. Keep at review until required
aggregate CI succeeds.

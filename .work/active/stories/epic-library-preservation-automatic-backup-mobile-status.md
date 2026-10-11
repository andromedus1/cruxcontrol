---
id: epic-library-preservation-automatic-backup-mobile-status
kind: story
stage: implementing
parent: epic-library-preservation-automatic-backup
depends_on: [epic-library-preservation-automatic-backup-surfaces]
release_binding: null
gate_origin: null
created: 2026-10-11
updated: 2026-10-11
tags: [ui]
---

# Keep the backup status readable on a phone

SignedProof24 emulator acceptance reveals a broken narrow-screen backup status:
the Manage button consumes nearly the whole horizontal row and squeezes status
copy into a few characters per line. This makes the intended compact status very
tall and overlaps the button with text. Reproduced in the real Android WebView
at a phone viewport; private screenshot is retained outside Git in automatic app
acceptance evidence. Inspect interaction with existing mobile `.button` width
rules, preserve the approved compact status design, and verify computed geometry
on the real device after correction. Authored data and backup behavior are intact.

## Design and verification

The mobile `.workspace-library-actions .button` selector applies `width: 100%`
to the nested Manage button. Override that width at this compact status boundary,
with specificity independent of stylesheet order, while allowing the text column
to use the remaining width. No surface redesign or new mock is needed: restore
the approved side-by-side compact status. Verify actual computed WebView geometry
and a screenshot at phone width, and retain a geometry assertion in native
acceptance. Existing portable-action buttons retain their full-width mobile rule.

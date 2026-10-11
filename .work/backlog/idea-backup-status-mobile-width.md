---
id: idea-backup-status-mobile-width
created: 2026-10-11
updated: 2026-10-11
tags: [ui]
---

SignedProof24 emulator acceptance reveals a broken narrow-screen backup status:
the Manage button consumes nearly the whole horizontal row and squeezes status
copy into a few characters per line. This makes the intended compact status very
tall and overlaps the button with text. Reproduced in the real Android WebView
at a phone viewport; private screenshot is retained outside Git in automatic app
acceptance evidence. Inspect interaction with existing mobile `.button` width
rules, preserve the approved compact status design, and verify computed geometry
on the real device after correction. Authored data and backup behavior are intact.

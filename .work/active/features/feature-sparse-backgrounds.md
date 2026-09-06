---
id: feature-sparse-backgrounds
kind: feature
stage: drafting
tags: [ui, ble]
parent: null
depends_on: [story-background-dogfood-design]
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
---

# Ship the approved sparse background animations

Andrew selected the three-trail Matrix study and explicitly requested implementation
of all four other studies: fireflies, shooting stars, jellyfish, and embers.

## Design decisions

- Approved source: `.mockups/screens/story-background-dogfood-design/index.html`,
  `matrix-three`, `fireflies`, `meteor`, `jellyfish`, and `embers` studies.
- New defaults reserve 8, 6, 9, and 10 holds respectively, never more than 11.
  Matrix retains its ten-hold default. Existing 20-total-light / 2-FPS admission,
  protected climb colors, and user-editable palettes remain authoritative.
- New presets use 120-second closed sequences and recipe version 2 only.
- Replace the current v2 Matrix rendering in place; no library rewrite or palette,
  ID, seed, reserve, period, target, playlist, or authored-setting changes. V1
  rendering stays frozen. New Matrix defaults use three rain columns; saved
  column settings remain honored as a pool of fall lanes with at most three
  simultaneous streams, each long enough to read. Budget splits 4/3/3 at ten.
- Existing UI controls and strict snapshot/import codecs are extended; no new
  screen, persistence schema, library dependency, or transport change.

## Mockups

- `.mockups/screens/story-background-dogfood-design/index.html` — approved by Andrew
  in chat on 2026-09-05; the two-trail Matrix alternative is not selected.

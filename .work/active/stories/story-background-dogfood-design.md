---
id: story-background-dogfood-design
kind: story
stage: review
tags: [ui, ble]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
---

# Retire Frogger and revisit sparse background motion after dogfooding

Andrew's first dogfood was positive overall; remove Frogger, revisit Matrix as
falling green code, and propose other themes costing at most eleven effect holds.

## Scope and acceptance

- Remove Frogger from the existing Add a preset picker. Keep stored Frogger
  recipes readable, editable, renderable, and importable: retirement must not
  invalidate a climb or playlist. No saved data writes or migrations.
- Produce a committed, standalone Matrix motion study on the actual 305 Fullride
  positions at two poses/second. Show bright leading cells, dim trailing cells,
  staggered falls, and a closed long sequence; reserve at most ten effect holds.
- Provide a small candidate shortlist with explicit maximum hold budgets <=11.
  Preview promising candidates so Andrew can judge sparse motion before selection.
  Candidate implementation and production Matrix replacement follow design feedback.
- Preserve current production Matrix and all authored color settings; this request
  asks for another design attempt, not an automatic rewrite of saved recipes.
- Mock supports pause, stepping, scrubbing, loop-join review, and reduced motion.
  Any colors are illustrative; the physical controller quantizes and guards role
  colors. Show route holds and subtract them from effect eligibility.

## Design and simplification

Keep the existing preset registry for saved-group labels, defaults and compatibility.
Filter the single retired kind at the creation picker. No generic retirement system
or schema change. Existing UI components make a separate removal mock unnecessary.
Use the existing motion tokens without modifying their locked global contract.
Matrix study compares the sparse five-stream approach with two or three readable
trails. New ideas are design targets, not assertions of shipped behavior.

## Mockups

- `.mockups/screens/story-background-dogfood-design/index.html`

## Implementation notes

- Execution capability: inline owner for cohesive picker retirement and design study;
  bounded documentation worker per update-documentation skill.
- Review weight: standard from .work/CONVENTIONS.md; standalone bounded inline review.
- Phone offered for inspection; no phone access necessary for this design deliverable.

## Verification

- All 583 unit tests pass across 82 files with two workers. New mounted editor
  coverage verifies retired Frogger v1 and v2 remain editable and absent from the
  creation picker; existing strict draft/playlist codecs and renderer tests pass.
- ESLint and TypeScript/Vite production build pass. Build output went to /tmp so
  the phone's existing localhost:4173 preview build was not replaced.
- Chromium study check: 305 positions; every half-second frame of all six studies
  with/without nine route holds remains in its declared budget, excludes route
  holds, and matches the corresponding pose one complete cycle later exactly.
  Observed maximum effect counts: Matrix 10/10, fireflies 8, meteor 6,
  jellyfish 9, embers 10. These validate mock geometry, not physical BLE output.
- Play, frame-step, reduced-motion pause and 390px mobile layout verified; no
  browser script errors. Desktop screenshot inspected and study opened locally.
- Documentation updated and cross-checked in SPEC/ARCHITECTURE; generated knowledge
  index lint has zero errors/warnings. No unrelated findings or data mutations.

## Design recommendations

Prefer Matrix's two five-cell streams over three shorter streams. Production
design should retain the saved ten-hold reserve and authored palette, assign
brightness by tail age, and keep drops aligned to physical columns. Actual API-2
color steps need a wall check; preview shading is illustrative.

New candidates: fireflies (8), shooting stars (6), jellyfish (9), embers (10).
Fireflies and shooting stars are the strongest first choices. These are proposals
for Andrew's selection, not additional implementation commitments.

References: NPS firefly flash patterns
(https://home.nps.gov/grsm/learn/nature/firefly-flash-patterns.htm) informs the
glow/pause/answer rhythm; NASA meteor explanation
(https://spaceplace.nasa.gov/asteroid-or-meteor/en/) informs the bright head and
trailing streak. Timings, budgets, and choreography are original design choices.

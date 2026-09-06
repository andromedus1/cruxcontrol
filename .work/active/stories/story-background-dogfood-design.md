---
id: story-background-dogfood-design
kind: story
stage: implementing
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

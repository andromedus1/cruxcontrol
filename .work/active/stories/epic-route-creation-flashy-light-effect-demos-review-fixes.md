---
id: epic-route-creation-flashy-light-effect-demos-review-fixes
kind: story
stage: implementing
tags: [bug, ui, ble, data]
parent: epic-route-creation-flashy-light-effect-demos
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-26
updated: 2026-09-26
---

# Correct effects feature review findings

## Brief
Close material findings from the single required standard feature review: respect explicitly assigned effects on semantic holds when no spatial background is present; enforce unused scope even for included custom assignments in both recipe versions; make Layer up move toward the topmost/later array position; reject unknown spatial include/exclude IDs at the definition-aware portable-import boundary; expose Beach Ball authored direction through existing recipe controls.

## Adjudication
All five findings reproduce concrete mismatches with the accepted contracts. Role protection under spatial backgrounds remains exact and static per the newer effects contract; assignment-only animation must retain its earlier explicit opt-in behavior. This qualification reconciles the earlier animation acceptance with the current protected-background requirement. No change to stored recipes, capacity, controller protocol, or reserved colors. Fix verification only after this standard pass, no repeated independent feature review.

## Verification
Add focused regressions before fixes and run relevant renderer, editor and import suites. Existing v1 fixtures, versioned codecs and role-protection tests must remain green. Final integration includes full tests, typecheck, lint, production build, browser tests, and CI.

---
id: epic-build-effects-hardening-seamless-loops
kind: feature
stage: drafting
tags: [ui, ble]
parent: epic-build-effects-hardening
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
---

# Longer seamless themed background loops

## Brief

Revise all ten existing spatial presets into longer, theme-appropriate closed sequences (normally 1–3 minutes), without slowing a short sequence as the only change. Preserve recipeVersion 1 playback; new presets use a new version and saved effects expose an explicit, non-destructive upgrade. Keep all current palette/period/intensity/target controls and make shape controls functional. Fix zero intensity and empty-frame cancellation, guard decorative colors after API-2 conversion, and avoid redundant held-frame computation/board-path construction with evidence. Keep route lights exact and the 20-light/2-FPS hardware profile unchanged. Produce standalone motion previews before production edits. Test cycle joins including trails/color/state, all kinds, seeds, masks, saved v1 compatibility, upgrade persistence and relevant playback lifecycle.

## Inherited direction

Parent epic owns priorities and accepted decisions. Preserve authored content, IDs,
memberships and old saved recipes. Resolve routine design choices under the authorized
autopilot scope. No controller upgrade or increased hardware capacity claim.

## Grounding

Read docs/SPEC.md, docs/ARCHITECTURE.md and docs/PRINCIPLES.md plus current code and
relevant completed route-creation/playlists features. Research navigator has no brief
blocking this epic. Existing protocol/board-control briefs and measured capacity feature
remain constraints; they are not evidence of unmeasured hardware performance.

## Mockups

Inherit .mockups/design-system/ and the parent bee study where relevant. Remaining motion,
backup and update surfaces require focused standalone mocks during design before code.

## Simplification opportunity

Extend existing pure frame/repository/UI boundaries; avoid new frameworks or replacement
storage. Share validated logic only where repeated consumers and contracts justify it.

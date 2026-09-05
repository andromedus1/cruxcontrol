---
id: epic-build-effects-hardening-library-backup
kind: feature
stage: drafting
tags: [ui, data]
parent: epic-build-effects-hardening
depends_on: [epic-build-effects-hardening-curious-bee]
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
---

# Whole-library backup and recovery

## Brief

Export and restore a bounded, versioned file containing every local climb/draft including Trash and climbs outside playlists, all playlists, shared membership references, stable IDs, lifecycle metadata and saved effect recipes. Keep existing IndexedDB databases and ordinary playlist sharing semantics. Validate the whole file before writes; offer a reviewable non-destructive recovery strategy for ID conflicts and partial failures rather than wiping the library or silently duplicating shared climbs. Recovery must be repeatable/idempotent and report failures honestly. Provide UI mockup before production, download/upload UI and proportionate codec/repository/browser tests. No account/cloud backend or origin migration.

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

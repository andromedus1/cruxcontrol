---
id: epic-build-effects-hardening-safe-updates
kind: feature
stage: drafting
tags: [ui, infra]
parent: epic-build-effects-hardening
depends_on: [epic-build-effects-hardening-library-backup]
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
---

# Safe PWA updates during editing and playback

## Brief

Replace auto-activation/reload with a waiting update and explicit safe apply flow. Saved edits, active playback, and in-flight library mutations must settle before reload; no surprise interruption of board control or loss of unsaved local work. Handle dismissed prompts, multiple tabs/visibility as appropriate, update failures and offline usage. Preserve same origin and storage. Ground exact vite-plugin-pwa/Workbox behavior in installed sources and primary documentation; test old/new build transition and dirty/playback gates. Reuse existing UI patterns; create a standalone mock for any new update surface before production.

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

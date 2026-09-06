---
id: epic-build-effects-hardening-safe-updates-review-fixes
kind: story
stage: implementing
tags: [ui, infra, tests]
parent: epic-build-effects-hardening-safe-updates
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
---

# Preserve workspace availability and update protection across lifetimes

## Accepted correction set

1. Skip PWA registration in development. Registration failure must remain visible
and retryable while the local workspace can open under confirmed shared admission.
Keep available-but-rejecting locks and changed controllers as blocking admission;
do not recreate runtime or discard work to retry only registration.
2. Include unsaved new-list name in playlist dirty safety and dependencies.
3. Move direct playlist mutation lifetime tokens to the persistent workspace;
release through promise finally even after Lists unmounts/remounts. Clear transient
playlist form/modal/play-through reporting on unmount without clearing write tokens.
4. Exercise two simultaneous update attempts and a new client waiting behind an
exclusive activation lease using real same-origin browsers/service workers. Confirm
losing/old tabs never silently resume under a changed controller or auto-reload.

## Ownership and verification

Luna xhigh feature owner: production PWA/startup/playlist/workspace code and focused
unit regressions. Root: real browser fixture and integrated verification. One
standard independent review completed; this child closes directly on green named-fix
evidence, without another independent review. Existing storage and recipe contracts
remain; no new UI structure requires another mock.

## Development fixture reconciliation

Absorb parked `idea-vite-dev-flag-alias` into this same accepted startup correction.
A real Vite development-server browser test shows the aliased import.meta read bypasses
Vite's env substitution and still registers the disabled worker. Read import.meta.env.DEV
directly using the existing vite/client declarations. The browser must open its local
workspace without an update-error banner. No storage or production behavior changes.

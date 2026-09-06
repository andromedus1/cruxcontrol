---
id: epic-build-effects-hardening-safe-updates-registration-message
kind: story
stage: done
tags: [ui, infra, tests]
parent: epic-build-effects-hardening-safe-updates
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
---

# Preserve registration error presentation after workspace admission

## Accepted final-completion finding

Native registration can fail while shared admission correctly opens the local app.
CruxControlWorkspace immediately calls setBlocked(null), whose combined waiting/error
branch replaces the error message with saved/reload copy. AppUpdateControl also uses
an unconditional update-available heading. Preserve the actual error message while
blockers change and keep error presentation truthful and retryable. Do not disturb
waiting-state blocker copy, protected admission, retries, or runtime identity.

## Verification and ownership

Luna xhigh owns the minimal coordinator/control correction and meaningful regression
through mounted app/workspace composition with a real coordinator; reproduce red first.
No new visual structure: bug/copy correction reuses existing control and needs no mock.
Root owns integrated checks and remote CI. This child closes on verification; the
already-completed standard feature, epic and final passes close through named-fix
evidence without an independent rereview. No storage, animation or phone mutation.

## Implementation notes

- Execution capability: Luna xhigh, selected for the cross-tab admission and
  persistence safety surface.
- Review weight: standard, supplied by the parent workflow; this named-fix
  closure uses the completed feature review evidence and does not start another
  independent review.
- Files changed: `web/src/pwa/update-service.ts`,
  `web/src/pwa/AppUpdateControl.tsx`, and the mounted composition regression in
  `web/src/App.test.tsx`.
- Tests added: mounted `App` plus real `createAppUpdateService` admission test
  reproduces registration failure, adds and clears a Lists dirty blocker while
  preserving the error copy, clicks retry, and verifies runtime identity is
  unchanged; focused PWA tests cover the existing waiting and admission cases.
- Simplification: error snapshots retain their existing message when workspace
  blockers change; waiting snapshots keep their existing blocker copy rules.
- Discrepancies from design: none.
- Adjacent issues parked: none.

## Verification evidence

- Red reproduced before the fix: the mounted workspace changed
  `Service worker script unavailable.` to `Your library is saved. Reload when
  you are ready.` when its initial `setBlocked(null)` ran.
- Green: `npm test -- --run src/App.test.tsx src/pwa/update-service.test.ts
  src/pwa/AppUpdateControl.test.tsx --maxWorkers=2` (19 tests), typecheck, and
  assigned-file ESLint.

---
id: epic-build-effects-hardening-safe-updates-registration-message
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

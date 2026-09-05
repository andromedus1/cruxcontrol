---
id: epic-build-effects-hardening-library-backup-review-fixes
kind: story
stage: implementing
tags: [ui, data, tests]
parent: epic-build-effects-hardening-library-backup
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
---

# Verify recovery boundaries and report exact outcomes

Preserve restore outcome phase and committed counts; hide stale preflight counts after
failure. Distinguish no-write draft failure, partial draft commit and zero-add playlist
failure. Guard refresh retries against duplicates/stale completion and clear errors on
success. Guard export close/continuations. Test actual file/read, conflict, retry, focus
and busy contracts, not internal state mirrors.

Add focused persistence evidence for supported historical records/recipe versions,
byte/count import/export bounds, canonical ordering/conflicts, concurrent second-connection
inserts, queued-add failure abort and raw unchanged records in both stores. Verify service
write sequencing, idempotent partial/full retry and late conflicts. Expand real browser
recovery fixture with old Trash, orphan/shared references, metadata and recipes, then
prove exact stored values survive reload/no-op/conflict.

Root owns library-backup source/tests and its browser scenario. Safe-update application
worker owns surrounding UI gating and requests any necessary interface additions. One
standard review already completed; child closes directly on meaningful green verification.

## Dialog correction evidence

Six failing UI regressions reproduced before correction. Outcome state now retains
phase and committed counts, excludes stale preflight counts after failures, and reports
no-write versus partial-commit results precisely. A synchronous operation guard spans
export/restore/refresh promises and blocks duplicate actions/close; every async result
checks its generation, including before download dispatch. Read-only file selection can
be replaced/cancelled, invalidating the older read. Refresh success clears prior errors
without repeating restoration. Partial retry performs a fresh review and recognizes
already-added climbs. Fourteen focused dialog tests pass, including conflicts, exact
counts, failed-refresh retry, unmounted export, stale files, size-before-read and busy
controls. Native focus return will be verified in the richer browser scenario.

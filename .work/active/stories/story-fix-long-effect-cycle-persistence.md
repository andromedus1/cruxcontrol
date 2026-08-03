---
id: story-fix-long-effect-cycle-persistence
kind: story
stage: done
tags: [bug, data]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Persist board-paced effect cycle times

## Symptom

Saving a climb with a corrected long-cycle effect fails with: `corrupt local draft at
effectGroups[0].periodMs: expected a number from 250 to 10000`.

## Root cause

The cadence repair expanded the editor to 180-second cycles and changed Snake/Pac-Man to
120 seconds, but the local-draft and portable-playlist codecs retained the original
10-second validation ceiling.

## Fix approach

Align both persistence boundaries with the editor's 180-second ceiling while retaining
the existing finite-number and lower-bound validation.

## Regression test

Draft and portable codec tests round-trip a complete 120-second spatial recipe and reject
values above 180 seconds.

## Implementation notes

- **Execution capability**: host-owned focused repair; two mirrored persistence validators
  and their existing codec suites define the complete boundary.
- **Files changed**: shared effect-period limits, local draft decoder, portable playlist
  decoder, editor range binding, and focused codec/editor tests.
- **Regression evidence**: both 120-second round-trip tests failed with the reported
  10-second-ceiling error before the fix and pass afterward; 180.001 seconds fails closed.
- **Verification**: 68 files / 424 tests, typecheck, lint, and production/PWA build pass.
- **Bounded inline review**: approved. Local, portable, and editor limits now share the
  same 180-second constant, eliminating the drift that caused the save failure.

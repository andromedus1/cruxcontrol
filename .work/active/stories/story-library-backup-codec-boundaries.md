---
id: story-library-backup-codec-boundaries
kind: story
stage: done
tags: [data]
parent: epic-build-effects-hardening-library-backup
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
---

# Reject future records and bound export rows before encoding

## Brief

Close two confirmed library-backup codec boundary bugs found by the persistence
contract tests. A stored draft or playlist with an unsupported future schema can
currently be reinterpreted as a current domain model when `updatedOrder` is
missing. An oversized export snapshot can currently walk malformed rows before
rejecting the supported count limit. Both failures can undermine trustworthy
backup recovery and need to be tracked as one small codec story.

## Parked audit trail

- `idea-library-backup-future-schema-dispatch`: `storedDraft` and `storedPlaylist`
  must honor the declared stored schema before choosing raw decoding versus domain
  model encoding.
- `idea-library-backup-early-count-bounds`: export count limits must be applied
  before mapping rows into stored records.

## Design

Keep the public backup format and existing stored-record codecs unchanged. At the
start of each raw record adapter, inspect its declared `schemaVersion`; dispatch
to raw decoding only for the explicitly supported stored schema versions and let
the existing schema errors identify unsupported future versions. Domain snapshots
continue to use the existing model-to-stored encoder. This preserves historical
stored rows while preventing a future raw value from bypassing its decoder when an
index field is absent.

Apply the existing climb, playlist, and reference count checks to the export
snapshot before mapping any row. Retain the later UTF-8 serialized-size check and
all nested row validation after counts pass. Do not change record ordering,
canonical comparison, recipe handling, or storage behavior.

## Acceptance criteria

- A future draft or playlist schema is rejected whether or not `updatedOrder` is
  present; the error identifies the unsupported stored schema.
- Supported historical draft schemas and current domain snapshots continue to
  decode and encode exactly as before.
- Export rejects an oversized climb, playlist, or reference array before walking
  malformed rows and returns the existing oversized-payload error code.
- Existing UTF-8 byte bounds, duplicate checks, canonical equality, and all
  IndexedDB/service contract tests remain green.

## Implementation notes

- Execution capability: bounded inline implementation; two pure codec boundary
  changes with focused regression evidence.
- Review weight: standard project convention; child story closes directly after
  verification.
- Files changed: `web/src/library-backup/codec.ts` and
  `web/src/library-backup/codec.test.ts`.
- Tests added/removed: future draft/playlist schema dispatch and malformed
  oversized export regressions were added in the existing codec contract suite.
- Simplification: none; existing validation and codec paths are retained.
- Discrepancies from design: none.
- Adjacent issues parked: none; the two audit items were absorbed into this story.
- Verification: `npm test -- --maxWorkers=2 src/library-backup/codec.test.ts
  src/library-backup/indexeddb-store.test.ts src/library-backup/service.test.ts`
  (31 tests passed), `npm run typecheck`, `npm run lint -- --no-warn-ignored`,
  and `npm run build` all passed.

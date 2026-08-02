---
id: epic-playlists-portable-sharing-codec
kind: story
stage: done
tags: [ui, data]
parent: epic-playlists-portable-sharing
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Portable Playlist Codec and Export

## Brief

Define and verify the independent portable playlist envelope, local climb snapshots,
strict UTF-8/base64url URL-fragment codec, URL boundary, complete file fallback, and
small browser transport adapters.

## Implementation

Implement Unit 1 in the parent feature's `## Implementation Units` section.

## Implementation notes

- Execution capability: GPT-5.6 Sol at xhigh reasoning, selected by the autopilot
  caller because this unit is an untrusted-input and browser-transport boundary.
- Review weight: standard (caller and project convention); independent review is not
  applicable to this child-story checkpoint and remains at the parent feature boundary.
- Files changed: `web/src/playlists/portable-types.ts`,
  `web/src/playlists/portable-codec.ts`, `web/src/playlists/portable-export.ts`,
  `web/src/playlists/portable-transports.ts`, their three focused test files,
  and `web/src/playlists/index.ts` exports.
- Tests added: 26 behavior tests covering the strict envelope, Unicode UTF-8/base64url
  round trips, every role/packed color/effect kind, exact ordering, forbidden local
  authority fields, domain invariants, path-specific malformed/unsupported/oversized
  failures, the 1,800-character URL boundary, complete file fallback, missing-local
  positions, capability-gated sharing, truthful clipboard failures, and object-URL
  revocation.
- Simplification: one strict decoder now validates and canonicalizes object, encoded,
  fragment, and export-created payloads; browser effects use one small injected port,
  with no storage-record compatibility path or duplicated wire model.
- Discrepancies from design: none.
- Adjacent issues parked: none.

## Verification

- `npm -w web run test -- --run src/playlists/portable-codec.test.ts src/playlists/portable-export.test.ts src/playlists/portable-transports.test.ts` — 3 files, 26 tests passed.
- `npm -w web run typecheck` — passed.
- `npm -w web run lint` — passed.
- `npm test` — 52 files, 335 tests passed.
- `npm run build` — TypeScript and Vite production/PWA build passed.

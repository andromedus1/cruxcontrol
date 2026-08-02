---
id: epic-playlists-portable-sharing-import
kind: story
stage: done
tags: [ui, data]
parent: epic-playlists-portable-sharing
depends_on: [epic-playlists-portable-sharing-codec]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Previewed Playlist Import and Sharing UI

## Brief

Build the compatibility preview, compensating multi-repository import executor, and
responsive share/import dialogs over the verified portable codec and adapters.

## Implementation

Implement Unit 2 in the parent feature's `## Implementation Units` section.

## Implementation notes

- Execution capability: GPT-5.6 Sol at xhigh reasoning, continued from the
  feature-owning autopilot worker because import spans untrusted input, two storage
  authorities, compensation, browser capability ports, and responsive UI.
- Review weight: standard (caller and project convention); independent review is not
  applicable to this child-story checkpoint and remains at the parent feature boundary.
- Files changed: new `web/src/playlists/portable-import.ts`,
  `PlaylistShareDialog.tsx`, `PlaylistImportDialog.tsx`, and
  `portable-history.ts`; focused tests for the planner/executor and dialogs; integration
  in `PlaylistLibrary`, `CruxControlWorkspace`, playlist CSS/exports and their tests;
  the production-build Playwright workflow; and current-state updates to
  `docs/ARCHITECTURE.md` and `docs/SPEC.md`.
- Behavior delivered: strict URL/file preview with zero writes; active-installation
  compatibility checks; fresh local climb and playlist IDs with exact entry order;
  provider-reference retention and explicit unresolved counts; reverse-order
  compensation with root plus cleanup failure evidence; bounded file reads; truthful
  clipboard/download/Web Share capability handling; matching-hash clearing on cancel
  and success; success deduplication; selected-list refresh; trigger focus restoration;
  and compact dialog controls without horizontal overflow.
- Tests added: 19 Unit 2 behavior tests across planner/executor, share/import dialogs,
  library focus integration, and startup-hash workspace routing. Playwright additionally
  exports a locally authored two-climb list, imports the downloaded file, proves fresh
  IDs with preserved status/content/order, and proves both copies survive reload.
- Simplification: URL and file inputs converge on one decoder/planner, executor retry
  state is separate from post-success refresh state, and browser history/share/file
  effects remain injectable ports rather than UI globals.
- Discrepancies from design: `PlaylistImportPlan` carries `installationId` because the
  designed executor signature otherwise has no installation authority for
  `LocalDraftRepository.create`. The current installation/runtime has no provider
  catalog resolver, so provider references are retained in order and truthfully counted
  as unresolved instead of inferring availability; this preserves the designed payload
  and can consume a future catalog resolver without migration.
- Adjacent issues parked: none.

## Verification

- `npm -w web run test -- --run src/playlists/portable-import.test.ts src/playlists/PlaylistShareDialog.test.tsx src/playlists/PlaylistImportDialog.test.tsx src/playlists/PlaylistLibrary.test.tsx src/app/CruxControlWorkspace.test.tsx` — 5 files, 32 tests passed.
- `npm test` — 58 files, 362 tests passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — TypeScript and Vite production/PWA build passed.
- `npm -w web run test:e2e` — 4 Chromium scenarios passed, including the portable
  two-climb export/import/reload round trip.

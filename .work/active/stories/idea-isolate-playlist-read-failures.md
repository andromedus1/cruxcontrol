---
id: idea-isolate-playlist-read-failures
kind: story
stage: done
tags: [ui, data]
parent: feature-library-read-resilience
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-09-26
---

# Isolate playlist read failures

## Brief
A corrupt playlist row or playlist-store read failure currently rejects the combined
workspace refresh, which can temporarily hide My Climbs, Drafts, and Trash behind a
playlist-related retry error. Consider settling playlist reads separately so playlist
storage failure degrades only the Lists surface while the independent climb database
remains usable. This was accepted as a lower-risk resilience follow-up during the
standard review of `epic-playlists-local-library`; write-path isolation and explicit
retry behavior remain intact.

## Delivery scope
Authorized in the everyday-reliability cleanup. Preserve stored library data and existing visual structure. Add focused regression evidence and complete the applicable review lane.

## Simplification opportunity
Repair the existing path directly; no new subsystem.

## Implementation notes (2026-09-26)
Root cause: one Promise.all withheld both climb collections when playlist loading failed. Climb and playlist refresh now settle independently and commit their own state; Lists exposes retry without suppressing the library. Recovery notices identify unreadable climbs and retain original stored evidence. Tests failed before the fix and now cover independent failure/retry, pending playlist read, deduplicated diagnostics, and preservation of cached lists plus unsaved edits.

Verification: `npm -w web test -- src/drafts/indexeddb-repository.test.ts src/app/CruxControlWorkspace.test.tsx` — 33 tests pass. TypeScript passed after integration. Child checkpoint closes directly; parent owns standard independent review. Inline host capability chosen for data-preservation contract. Full repository/CI checks follow before parent completion.

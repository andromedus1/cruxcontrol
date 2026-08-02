---
id: epic-playlists-portable-sharing
kind: feature
stage: drafting
tags: [ui, data]
parent: epic-playlists
depends_on: [epic-playlists-local-library]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Portable Playlist Sharing and Import

## Brief

Make a playlist portable without a backend. Export a versioned share payload through a
URL when size permits and through a downloadable/shareable file for every valid list;
import previews the result and creates new local records only after confirmation.
Provider entries remain namespaced references. Browser-local entries carry immutable
climb snapshots because their UUIDs cannot resolve on another device.

Import never overwrites existing climbs or lists silently, rejects corrupt or
incompatible payloads at the boundary, and reports unresolved provider entries without
discarding their order or provenance.

## Epic context

- Parent epic: `epic-playlists`
- Position in epic: independent portability consumer of the verified playlist library.

## Inherited design decisions

- Backendless, explicit sharing only; each browser remains authoritative for its own
  data.
- Local snapshots import as copies; provider identities remain namespaced references.
- URL sharing has a file fallback rather than truncation.
- Mockups pending under active autopilot; reuse existing dialog and recovery patterns.

## Research briefs

None required; use browser URL, file, and Web Share capabilities behind small adapters.

## Foundation references

- `docs/SPEC.md` — Playlist sharing and per-user isolation.
- `docs/ARCHITECTURE.md` — Static/backendless local-data model.

## Mockups

- Inherits design system: `.mockups/design-system/`
- Parent UI alignment: `.work/active/epics/epic-playlists.md`

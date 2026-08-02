---
id: epic-playlists-local-library
kind: feature
stage: drafting
tags: [ui, data]
parent: epic-playlists
depends_on: [epic-route-creation-climb-lifecycle]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Local Playlist Library and Management

## Brief

Deliver the core flexible-list capability: a user can create, rename, annotate, and
delete lists; add either Draft or Finished climbs to multiple lists; remove entries;
and manually reorder each list. Persist one versioned browser-local playlist aggregate
whose ordered membership uses a namespaced union of local and future provider climb
references.

The surface reuses the existing climb workspace and design system. It must preserve
memberships while a local climb is in Trash, visibly distinguish unavailable entries,
and avoid tying list usefulness to the deferred community catalog.

## Epic context

- Parent epic: `epic-playlists`
- Position in epic: foundation capability; play-through and sharing consume its typed
  repository and management surface.

## Inherited design decisions

- One climb may belong to multiple manually ordered, semantically flexible lists.
- Drafts and Finished climbs are both eligible; Trash preserves but disables entries.
- Storage is local-first with stable namespaced local/provider references.
- Mockups pending under active autopilot; reuse the selected hybrid browser composition
  and locked design system.

## Research briefs

None required; this extends the existing native IndexedDB and climb-view contracts.

## Foundation references

- `docs/SPEC.md` — Capability 8 and Playlist domain model.
- `docs/ARCHITECTURE.md` — Playlist module and local-data authority.

## Mockups

- Inherits design system: `.mockups/design-system/`
- Parent UI alignment: `.work/active/epics/epic-playlists.md`

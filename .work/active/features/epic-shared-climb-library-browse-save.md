---
id: epic-shared-climb-library-browse-save
kind: feature
stage: drafting
tags: [ui, data]
research_refs:
  - .research/analysis/briefs/invited-offline-library.md
parent: epic-shared-climb-library
depends_on: [epic-shared-climb-library-publish]
release_binding: null
gate_origin: null
created: 2026-09-26
updated: 2026-09-26
---

# Browse shared climbs and retain personal copies

## Brief

Let a member browse and refresh the group's contributions, filter by the approved
search/setter/angle controls, inspect a compatible climb, and save a retained copy
into an existing or newly named personal playlist. Use the existing board renderer
and Android controller, with explicit connection and normal scene/capacity rules.
Preserve My Climbs, Drafts, Trash, Playlists, and persistent board controls when
adding the shared destination.

A saved contribution becomes locally usable without shared access. Record its source
identity, revision, and attribution from the first save, while preserving local
ownership and stable local playlist references. Append at the chosen list's end
without reordering existing entries. Handle duplicate actions, concurrent list edits,
and partial climb/list writes honestly: the repositories are independent transactions.
Include any durable provenance in whole-library backup/restore and keep existing
backups and authored records readable without reset.

Receiving group changes does not require a release or background sync engine. Define
bounded, restartable refresh and clear offline/stale/unavailable states; authentication
responses and shared API data must not become an accidental public service-worker
cache. A failed or incomplete refresh never removes personal records. Explicitly
saved copies provide the guaranteed offline experience; full-group offline caching
is not required. This feature does not implement manufacturer catalogs or accepted
source updates.

## Epic context

- Parent: [shared-library epic](../epics/epic-shared-climb-library.md).
- Consumes publication snapshots and revisions; establishes backupable local
  provenance for the subsequent explicit-update feature.

## Inherited design decisions

- Main browsing/saving journey approved 2026-09-26.
- Retained copies remain unchanged unless their user explicitly accepts an update.
- Board definition, layout, placements, effects, and supported angle must validate
  before saving or lighting; an angle reminder does not change the physical wall.
- Viewing a climb never opens the Bluetooth chooser automatically.
- Shared access failure does not disable saved local climbs, lists, or board sessions.
- Private drafts, playlists, and backups remain local and exportable.

## Research briefs

- [Invited/offline library comparison](../../../.research/analysis/briefs/invited-offline-library.md)
  — refresh, interrupted reads, offline ownership, recovery and provenance.

## Foundation references

- `docs/SPEC.md` — board control, playlists, shared library, backup preservation.
- `docs/ARCHITECTURE.md` — local repositories, portable import, workspace composition.

## Mockups

- Inherits `.mockups/design-system/`.
- Approved 2026-09-26: [browse/save journey](../../../.mockups/flows/shared-library/index.html)
  — browse → inspect → existing/new playlist → save confirmation.
- Search-empty and refresh states are interactive. Other failures reuse the
  existing inline retry treatment; preserve keyboard focus and return context.

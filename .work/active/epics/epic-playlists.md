---
id: epic-playlists
kind: epic
stage: drafting
tags: [ui]
parent: null
depends_on: [epic-climb-browser, epic-route-creation-climb-lifecycle]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-08-02
---

# Playlists: Curated Climb Lists

## Mockups

- Inherits locked design system: `.mockups/design-system/`

## Design decisions

- **Identity and portability**: ordered local lists reference stable namespaced climb
  IDs and share through portable links/files.
- **Board use**: a connected client can step through and light playlist climbs; all
  browsing, ordering, and sharing remains usable without a board connection.
- **Flexible membership**: one climb can belong to multiple lists, and lists may
  contain both finished climbs and drafts for uses such as favorites, current
  projects, and training exercises.

## Brief

The "make my own session" capability: named, hand-picked, manually reorderable
lists of climbs the user assembles themselves. Each playlist has a shareable URL
and can be "played through" on the physical board — step climb-by-climb, lighting
each in turn — when a board is connected. Without a connection the playlist is
still fully usable for browsing and sharing.

A playlist is a CruxControl-local construct: Kilter has no playlist concept and no
playlist API, so playlists are stored locally and reference climbs by stable Kilter
climb ID (so a shared playlist resolves against any recipient's local catalog). This
epic is distinct from epic-recommendations (auto-generated, algorithmic circuits) and
epic-logbook (logging attempts/sends, not curating lists). It reuses the catalog,
selection surface, 2D renderer, and shareable-URL routing from epic-climb-browser, and
the BLE adapter from epic-board-control for play-through.

## Strategic decisions
- **Standalone vs board-dependent**: Playlists work standalone (browse / reorder /
  share); board play-through is an enhancement active only when connected — so the
  epic depends on epic-climb-browser, not epic-board-control. — keeps the core usable
  without hardware.
- **Storage & sync**: Local-first, CruxControl-local (no Kilter playlist API exists);
  no server round-trip required. — matches the data-ownership principle.
- **Climb references**: Playlists store stable Kilter climb IDs, not embedded climb
  data, so shared playlists resolve against any local catalog. — makes share URLs
  portable.

## Research briefs

None required. Reuses surfaces from epic-climb-browser (renderer, filtering,
shareable URLs) and epic-board-control (BLE play-through); no new domain knowledge.
No `[needs-brief]`.

## Foundation references

- `docs/SPEC.md` — Capability 8 (Playlists); domain model (Playlist entity).
- `docs/ARCHITECTURE.md` — Module Map §8 (Playlists); reuse of §4 (Renderer),
  §5 (Climb Browser routing), §3 (BLE Adapter for play-through).

## Anticipated child features

Provisional — `/epic-design` decides the real decomposition:
- Playlist store (create/rename/delete; ordered climb-ID lists; local persistence)
- Playlist editor UI (add from browser, drag-reorder, remove)
- Shareable playlist URL (encode/resolve by climb ID)
- Board play-through (step through, light each climb; needs epic-board-control)

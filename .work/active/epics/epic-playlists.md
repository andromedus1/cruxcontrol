---
id: epic-playlists
kind: epic
stage: implementing
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
- **Reference scope**: persisted playlist membership uses a namespaced union of local
  climb IDs and provider climb IDs. Draft/Finished/Trash transitions never rewrite
  membership; trashed entries remain visible but unavailable until restored.
- **Multiple membership**: one climb may belong to any number of manually ordered
  lists. Lists impose no semantics beyond a user-chosen name and optional notes, so
  favorites, projects, and training exercises use the same model.
- **Portable local climbs**: because a friend's browser cannot resolve another
  browser's local UUID, shared payloads include immutable snapshots for local entries
  while provider entries remain namespaced references. Import creates local copies and
  never overwrites existing climbs or lists silently.

## Research briefs

None required. Reuses surfaces from epic-climb-browser (renderer, filtering,
shareable URLs) and epic-board-control (BLE play-through); no new domain knowledge.
No `[needs-brief]`.

## Foundation references

- `docs/SPEC.md` — Capability 8 (Playlists); domain model (Playlist entity).
- `docs/ARCHITECTURE.md` — Module Map §8 (Playlists); reuse of §4 (Renderer),
  §5 (Climb Browser routing), §3 (BLE Adapter for play-through).

## UI alignment deferred

Autopilot cannot run the interactive mockup chooser. The child features should reuse
the selected hybrid climb-browser workspace and locked Kanagawa/Field Console design
system. Net-new surfaces are a Lists collection/library, list editor with reorder and
membership actions, share/import dialog, and board play-through controls. A later
`epic-design --only-questions epic-playlists` pass may add dedicated mocks, but the
existing patterns and locked product decisions are sufficient to implement without
blocking.

## Decomposition

Split by user capability rather than technical layer. The local library feature owns
the versioned playlist aggregate, membership reference union, and complete management
surface because those contracts must evolve together. Play-through and portable
sharing are independent consumers once that library is verified and can proceed in
parallel without duplicating persistence.

### Child features

- `epic-playlists-local-library` — create, rename, annotate, delete, add/remove, and
  manually reorder local/provider climb memberships — depends on: `[]`
- `epic-playlists-play-through` — step through a list and light each available climb
  on the configured board — depends on: `[epic-playlists-local-library]`
- `epic-playlists-portable-sharing` — versioned URL/file sharing and safe import,
  embedding snapshots only for browser-local climbs — depends on:
  `[epic-playlists-local-library]`

### Decomposition risks

- Local climb UUIDs are not portable; shared local snapshots must create copies rather
  than pretending identities resolve across browsers.
- Trash retains membership by stable ID, but play-through must skip unavailable
  entries explicitly instead of mutating the list.
- URL payload size is bounded by browsers and messaging clients. The sharing feature
  must retain a downloadable/importable file fallback rather than silently truncating.
- Provider-backed references remain a typed future branch until catalog installation
  ships; local-list usefulness must not depend on that deferred work.

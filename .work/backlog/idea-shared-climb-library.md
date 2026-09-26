---
id: idea-shared-climb-library
created: 2026-09-12
updated: 2026-09-26
tags: []
---

# Shared contributed climb library

Andrew wants a shared library that people using CruxControl can submit climbs to.
Other users should be able to receive updates and see those contributed climbs.
His partner and friends should be able to use CruxControl to control the board,
make their own playlists, and create climbs.

## Strategic decisions

- **First audience:** invited partner and friends — confirmed 2026-09-26.
- **Initial board control:** Android is sufficient. Direct iPhone board control
  remains deferred and does not block this shared-library milestone — confirmed
  2026-09-26.
- **Ownership:** explicit climb submission, library updates independent of app
  releases, and personal drafts/playlists under each person's control, as already
  approved in the saved roadmap.

## Open direction

The publication policy is being clarified: submissions visible immediately to the
invited group, or Andrew's approval before publication. The invitation/access and
update mechanisms require focused research before service architecture is selected.

Andrew approved this as the next major addition in the
[saved milestone priorities](roadmap-next-milestones.md). Aim for explicit climb
submission, library updates independent of app releases, and personal drafts and
playlists that remain under each person's control. Scoping is in progress; no
service, authentication provider, or synchronization contract is selected yet.

## Existing implementation to build on

- `web/src/playlists/portable-types.ts` and `portable-codec.ts` own bounded,
  versioned climb snapshots, including board identity and effect recipes.
- `web/src/playlists/portable-import.ts` validates active-board compatibility before
  writing fresh local copies. It does not supply ongoing shared-library identity or
  update tracking.
- `web/src/playlists/types.ts` and `resolve.ts` preserve ordered local/provider
  references. Design must keep personal lists and authored records safe when shared
  contributions change or disappear.
- The app remains static-first with local IndexedDB ownership. Reuse existing
  renderer, controller, import validation, and local backup boundaries; avoid
  creating a second authoring or board-control stack.

This is distinct from importing manufacturers' existing community libraries.
Andrew also reaffirmed interest in supporting Kilter, MoonBoard, Tension, and
other boards, with regularly updated community catalogs, as a farther-out idea.
That direction is already captured in [Multi-Board Providers](epic-multi-board-providers.md).

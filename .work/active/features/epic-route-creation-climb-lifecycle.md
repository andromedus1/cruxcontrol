---
id: epic-route-creation-climb-lifecycle
kind: feature
stage: drafting
tags: [ui, data]
parent: epic-route-creation
depends_on: [epic-route-creation-local-draft-library]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Draft, Finished, and Trash Climb Lifecycle

## Brief

Give locally authored climbs an explicit Draft or Finished status. Keep drafts out of
the overall My Climbs library and place them in a dedicated Drafts workspace; My
Climbs presents finished climbs. Add a recoverable Trash for deleted drafts and
finished climbs, with automatic removal after 30 days.

Lists may reference both drafts and finished climbs because flexible collections such
as Current Projects naturally include unfinished work. Trashing and restoring a climb
must preserve its list memberships while the climb remains recoverable.

## Strategic decisions

- **Library visibility**: My Climbs contains finished climbs; drafts have a separate
  workspace so incomplete experiments do not crowd the main library.
- **Deletion**: deletion moves climbs to recoverable Trash for 30 days.
- **List compatibility**: both drafts and finished climbs can belong to any number of
  lists, and recoverable deletion retains those memberships.

## Simplification opportunity

Extend the existing local draft aggregate and repository instead of introducing a
parallel finished-climb store. Derive library, drafts, and trash views from one
lifecycle field and deletion metadata.

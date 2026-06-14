---
id: epic-route-creation
kind: epic
stage: drafting
tags: [ui]
parent: null
depends_on: [epic-climb-browser, epic-catalog-sync]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
---

# Route Creation: Visual Editor + Publish

## Brief

The authoring capability: a visual editor to create climbs by tapping holds on the
board diagram, assigning roles (start/middle/finish/foot-only), saving drafts locally,
and publishing to the Kilter API. Reuses the board renderer + selection surface from
epic-climb-browser and the authenticated publish path from epic-catalog-sync.

When done, a user can build a new climb visually, persist it as a local draft, and
publish it. It does NOT introduce a new renderer or a new API client — it composes the
ones the browser and sync epics provide.

## Research briefs

- `docs/briefs/data-model.md` — frames-string encoding (the output format the editor
  produces) and hold roles.
- Publish auth + endpoint: covered by the **epic-catalog-sync** `[needs-brief]`
  (Kilter sync protocol & auth). No separate brief needed; consume that one. If the
  publish endpoint turns out to diverge materially from sync, split a brief at
  `/epic-design` time.

## Foundation references

- `docs/ARCHITECTURE.md` — Module Map §6 (Route Editor); reuse of §4 (Renderer) and
  §2 (Sync Engine) for publish.
- `docs/SPEC.md` — Capability 3 (Route Creation & Editing).

## Anticipated child features

Provisional:
- Tap-to-place editor producing valid frames strings
- Role assignment UI (start/middle/finish/foot-only)
- Local draft persistence
- Publish flow via the sync/auth client

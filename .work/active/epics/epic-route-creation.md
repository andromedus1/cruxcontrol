---
id: epic-route-creation
kind: epic
stage: drafting
tags: [ui]
parent: null
depends_on: [epic-climb-browser, epic-board-control]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-08-02
---

# Route Creation: Visual Editor + Publish

## Mockups

- Inherits locked design system: `.mockups/design-system/`

## Design decisions

- **First-milestone persistence**: local drafts are authoritative and support export
  and explicit sharing.
- **Provider publication**: publishing into Kilter's community is deferred until the
  current Kilter authentication and API are freshly researched.
- **Draft validity**: a local draft can be saved in any state, including empty,
  incomplete, or unconventional role combinations. Kilter/community publication
  validation is a separate future concern and must never block local saving.
- **Draft lighting**: any draft state can be sent to the configured board on demand;
  the editor does not require a conventional number of starts, finishes, middle, or
  foot-only holds before enabling lighting.
- **Initial metadata**: name, angle, and selected holds/roles form the primary editing
  surface; grade, description, and setter notes are optional.
- **Role interaction**: tapping may cycle a hold through unused, start, middle, finish,
  foot-only, and unused, with an explicit role toolbar available for direct assignment.
- **Full-color control**: ship an Advanced Light mode in the first milestone with
  access to the controller's full quantized color range. Ordinary climb authoring
  continues to use semantic Kilter roles so climb meaning remains distinct from a
  freeform light scene.
- **Connected editing**: retain a persistent “Light draft” action and offer a Live
  Preview toggle that updates the board while editing. Live Preview defaults off to
  avoid surprise lighting and unnecessary Bluetooth traffic.

## Brief

The first-milestone authoring capability: a visual editor to create climbs by tapping
holds on the board diagram, assigning roles (start/middle/finish/foot-only) or custom
light colors, saving unrestricted drafts locally, and lighting them on the configured
board. Reuses the board renderer from epic-climb-browser and the transport from
epic-board-control. Kilter publishing remains deferred.

When done, a user can build a new climb visually, persist it as a local draft in any
state, and light it. It does NOT introduce a new renderer or transport — it composes
the ones the browser and board-control epics provide.

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
- Advanced full-color lighting and optional connected Live Preview
- Kilter publish flow remains deferred

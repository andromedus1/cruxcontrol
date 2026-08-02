---
id: epic-route-creation-local-draft-library
kind: feature
stage: drafting
tags: [ui, data]
parent: epic-route-creation
depends_on:
  - epic-universal-board-platform-domain-definition
  - epic-climb-browser-local-climb-viewer
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Local Draft Library

## Brief

Deliver the locally authoritative draft model and durable browser persistence needed
for the first Fullride create-save-light loop. A user can create, save, reopen, update,
and delete Fullride drafts without an account, network connection, community catalog,
or Kilter validity gate. Every draft preserves its stable local identity, installation
and definition revision, angle, semantic or custom hold assignments, and optional
metadata, including completely empty and unconventional states.

The library projects saved drafts into the normalized local climb-viewer contract so
they appear in “My climbs” immediately and survive app reloads. It owns browser-local
schema/version handling and honest persistence failures, but not the route-editor UI,
board rendering, Bluetooth control, Kilter frames encoding, provider publication,
catalog storage, or a share/export interface. The stored record should remain portable
enough for a later explicit export capability without making export part of this
milestone.

## Epic context

- Parent epic: `epic-route-creation`
- Position in epic: foundation capability; the visual editor workspace depends on its
  draft identity, persistence, and viewer projection.

## Inherited design decisions

- Local drafts are authoritative and may be saved in any state, including empty or
  unconventional role combinations.
- Name and angle are the primary metadata; grade, description, and setter notes are
  optional. Local persistence does not enforce provider publication requirements.
- Hold assignments preserve the same semantic roles and exact quantized custom colors
  consumed by the renderer and controller.
- The first milestone is one configured Fullride 7x10 installation. Kilter auth,
  publication, provider encoding, and community catalog work are excluded.
- Durable data stays browser-local and does not require an account or backend.

## Research briefs

- `docs/briefs/data-model.md` — Kilter placement/role concepts and the distinction
  between source-native climb encoding and the normalized application model.
- `docs/briefs/foundation-pwa-sqlite.md` — browser-local persistence constraints and
  worker/OPFS context; the draft store remains independent of the provider catalog.
- `docs/briefs/board-rendering-and-filtering.md` — normalized local viewer boundary.

## Foundation references

- `docs/ARCHITECTURE.md` — Route Editor, Data Layer, and Board Domain boundaries.
- `docs/SPEC.md` — Route Creation, offline-first, per-user isolation, and Fullride
  acceptance scope.
- `docs/PRINCIPLES.md` — local ownership, explicit boundaries, and truthful failures.

## Mockups

- Inherits design system: `.mockups/design-system/`
- Existing list/detail composition: `.mockups/screens/epic-climb-browser/option-hybrid.html`
- Route-editor mockups pending — see parent epic's `## UI alignment deferred` note.

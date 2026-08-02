---
id: epic-route-creation
kind: epic
stage: review
tags: [ui]
parent: null
depends_on: [epic-climb-browser, epic-board-control]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-08-02
---

# Route Creation: Local Draft Editor + Lighting

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

## UI alignment deferred

This epic introduces a responsive route-setting workspace with metadata controls,
role/color tools, save state, and connected light controls. Its product decisions and
visual language are already locked, but dedicated route-editor screen selection cannot
run inside autopilot. Both child features inherit `.mockups/design-system/` and the
approved responsive browser composition at
`.mockups/screens/epic-climb-browser/option-hybrid.html`; the editor should reuse its
board prominence, compact touch-safe controls, phone-first composition, wide split
console, and persistent primary action. A later interactive
`epic-design --only-questions epic-route-creation` pass may add dedicated route mocks
without blocking this create-save-light milestone.

## Decomposition

Split at the durable local-data boundary, then compose the completed renderer and
controller into one user-visible editor. The draft library owns identity, browser
persistence, and projection into “My climbs”; the editor workspace owns all setting
interactions and connected lighting. A separate role-toolbar or lighting feature was
rejected because both operate on the same in-progress assignment state and would create
coordination overhead without an independently useful capability.

### Child features

- `epic-route-creation-local-draft-library` — unrestricted, durable Fullride drafts
  and projection into the local climb viewer — depends on:
  `[epic-universal-board-platform-domain-definition, epic-climb-browser-local-climb-viewer]`
- `epic-route-creation-editor-workspace` — responsive semantic/custom-color authoring,
  save/reopen, explicit Light Draft, and opt-in Live Preview — depends on:
  `[epic-route-creation-local-draft-library, epic-climb-browser-fullride-renderer, epic-board-control-light-scenes]`

### Decomposition risks

- **Persisted schema drift is the trickiest data risk.** Draft records outlive a
  deployment, so the library must version and validate stored data, retain the board
  definition revision, and surface recovery rather than silently discarding or
  coercing unknown placements/colors.
- **Semantic and custom color state can blur.** The editor must preserve whether an
  assignment is a climb role or an arbitrary light color; rendering, persistence, and
  controller scenes must derive from that single assignment state without lossy
  conversion.
- **Rapid edits can outrun BLE.** Live Preview must use the controller's existing
  bounded latest-frame-wins operation, remain off by default, and never bypass the
  explicit Light Draft action or write directly to transport.
- **Autopilot lacks a dedicated route-editor mock selection.** Implementation is
  constrained to the locked design system and accepted browser patterns; any novel
  layout direction is deferred rather than improvised.

## Child features reviewed and complete (2026-08-02)

- `epic-route-creation-local-draft-library` — done after standard feature review.
- `epic-route-creation-editor-workspace` — done after standard feature review.
- The epic is ready for its separate aggregate review. Physical Fullride/Android
  Chrome BLE evidence remains an explicit manual checkpoint and is not claimed by
  either child review.

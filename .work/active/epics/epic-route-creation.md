---
id: epic-route-creation
kind: epic
stage: done
tags: [ui]
parent: null
depends_on: [epic-climb-browser, epic-board-control]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-09-26
---

# Route Creation: Local Draft Editor + Lighting

## Current delivery state

All seven child features and this expanded epic have completed their required
reviews. Authoring, lifecycle, screenshot import, saved animations, measured API-2
capacity, and effects are complete for the accepted scope. The effects and aggregate
review corrections pass local checks and GitHub CI. Current Trash retention is
explicit Delete forever; no automatic expiry is claimed.

The early opt-in Live Preview and explicit Light Draft decisions below are
superseded by [automatic selected-climb lighting](../../archive/feature-selected-climb-controls.md)
and the [shared session controls](../../archive/story-session-controls-header.md).
Use `docs/SPEC.md` for current user-visible behavior.

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

## Review (2026-08-02)

**Verdict**: Approve with comments

**Blockers**: none unresolved. Fixed inline: the real-Chromium smoke now proves
autosave rather than bypassing it with explicit Save, reloads and reopens exact
semantic and custom-color state, then edits and persists both kinds again; application
composition now detects stored definition, layout-revision, angle, and placement
incompatibility before projection so an old draft remains stored unchanged and gets an
explicit recovery notice instead of crashing or silently rendering against the wrong
board.

**Important**: none

**Nits**: none

**Rejected**: requiring Kilter community publication or automated physical BLE proof
to block this local create-save-light milestone. Publication is explicitly deferred by
the locked user decision, while powered-board/Android-Chrome behavior remains a real
manual acceptance checkpoint rather than evidence CI can honestly fabricate.

**Notes**: Aggregate substrate epic review at effective weight `standard`; exactly one
independent balanced same-harness fresh-context pass ran, and no second independent
pass ran after fixes. The pass reviewed the epic and locked user decisions, both child
feature review records, application/runtime composition, versioned IndexedDB draft
codec/repository/projection, editor reducer and semantic/custom assignment model,
coalescing autosave and conflict recovery, responsive workspace and exact 3/3/2-bit
color control, the complete renderer and light-scene seams, controller/transport
contracts, foundation assertions, and real-browser evidence without repeating child
line review.

The corrected snapshot traces an unrestricted empty or unconventional local draft
through create, optimistic autosave, reload/reopen, subsequent semantic and exact
custom-color edits, retry/reload/save-copy recovery, and explicit Light Draft or
opt-in/default-off latest-state Live Preview. Local user content stays entirely in
browser IndexedDB; editor/rendering code performs no provider publication, auth,
catalog, network, direct Bluetooth, or placement-to-LED work. Unsupported Bluetooth
degrades explicitly while responsive 390×844 and 1440×900 coverage preserves the
roving-keyboard board surface, 2.5×/1× renderer scales, named controls, status/live
regions, 44 px actions, sticky safe-area footer, and reduced-motion behavior.

Full verification passed `npm test` (38 files, 218 tests), `npm run typecheck`, `npm
run lint`, `npm run build`, and `npm -w web run test:e2e` (2 Chromium tests). The
browser pass covers autosave/reload/reopen and exact `#FF6DAA` → `#24DBAA` custom
color persistence at 1440×900 plus compact keyboard/sticky-action behavior at
390×844. Controller fakes cover connect/light/clear, error/disconnect recovery,
bounded duplicate gestures, and latest-frame-wins preview. Physical BLE remains
pending on a powered Fullride 7×10 with Android Chrome; this approval makes no claim
that the hardware checkpoint has passed.

## Child features reviewed and complete (2026-09-26)
All direct children are done: local-draft-library, editor-workspace, climb-lifecycle, animated-light-designs, kilter-screenshot-import, board-light-capacity-envelope, and flashy-light-effect-demos (all prefixed `epic-route-creation-`). Effects standard review completed with five verified corrections. Aggregate review should inspect current create/save/reopen/import/lifecycle/effects/control integration and foundation assertions, without repeating feature-level line review. Current behavior supersedes the original explicit Light Draft/Live Preview design through the accepted automatic-lighting and shared-header follow-ups. Local 662 tests and 13 browser workflows plus CI run 36249285638 are green.

## Aggregate review (2026-09-26)
Standard weight, one independent fresh-context Sol pass. Accepted one material gap: saved spatial include/exclude references were omitted from definition-aware compatibility checks. `story-fix-spatial-target-recovery` adds the check and verifies unchanged recovery records. All other create/save/reopen/import/lifecycle/effects/controller seams passed aggregate inspection; reviewer ran 7 integration files/90 tests. Fix verification passes the full 664-test suite, lint/build and 13 browser workflows; CI run 36250137466 passed for application commit 2a7fb76. No second independent epic pass is required. Current Trash retention is explicit Delete forever, superseding the historical 30-day purge. Prior API-2 physical evidence applies; no new device run and API 3 remains unmeasured.

## Final completion review (2026-09-26)
The authorized run closed the effects/route-creation loose end and six saved everyday-reliability items, plus the aggregate spatial-target recovery correction. Shared-library, catalog, and other roadmap implementation remain outside this run. Feature production used bounded ownership with inline integration; standard review weight comes from `.work/CONVENTIONS.md`.

Exactly one balanced same-harness fresh-context Sol completion pass found no new material implementation blocker. The preferred external peer was unavailable due expired OAuth. The reviewer confirmed the spatial recovery correction and full local evidence: 85 files/664 tests, lint, TypeScript/Vite/PWA build, and 13 Chromium workflows. CI run 36250137466 subsequently passed. Two documentation nits were accepted: qualify semantic-role reassertion for spatial backgrounds in ARCHITECTURE and distinguish prior API-2 dogfooding from unmeasured API-3/other device acceptance in README. The stale opening review status is corrected. No second independent completion pass is required.

Completed family records will be archived with refs to committed full bodies; roadmap links and the generated navigator are refreshed together. No merge, deployment, or phone maintenance is claimed. PR #20 owns the proposed application update.

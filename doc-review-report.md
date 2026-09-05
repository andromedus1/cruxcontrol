# Doc Review Report

**Project:** CruxControl

**Date:** 2026-09-05

**Review mode:** System-only fresh audit of pinned snapshot `972d04c846cc4333a7f6cdfd63da4592900aa4c9`

**Scope:** `/tmp/cruxcontrol-bee-review-a083e52` at detached `972d04c`; five current
planning documents (`docs/VISION.md`, `docs/SPEC.md`, `docs/ARCHITECTURE.md`,
`docs/PRINCIPLES.md`, and `docs/DEPLOY.md`), generated knowledge indexes,
research provenance, `.work/` delivery state, source contracts/tests, and CI/deploy
configuration. The untracked `node_modules` symlink, generated `web/dist`, and
`web/playwright.snapshot.config.ts` were ignored. The concurrent root worktree was
not audited.

**Documents reviewed:** 5 system-level planning docs; 0 module planning doc sets.
The indexed corpus also contains 17 research docs and 1 superseded historical doc;
research briefs were used for provenance and referenced-file checks, not structural
review.

**Passes run:** 1 system-level pass; no module pass was applicable. Module discovery
found only `docs/architecture/history/north-star.md`, which is indexed as historical
and superseded, not current module planning.

**Issues found:** Critical 0 · High 0 · Medium 0 · Low 0 · Info 4

## Verdict

**PASS — documentation exit gate satisfied.** The current foundation bundle agrees
with the pinned source and delivery configuration. The animation planning updates
correctly describe the eleven v2 spatial presets, v1 compatibility boundary,
explicit upgrade behavior, Bumblebee controls/orientation, and foreground-only
playback. No Critical, High, Medium, or Low documentation issue remains.

## Pass 1: System-Level

### Critical (0)

None.

### High (0)

None.

### Medium (0)

None.

### Low (0)

None.

### Info (4)

#### I1. Current planning inventory and frontmatter

The five current planning docs all have non-empty `description`, `type: planning`,
`kind: planning`, and `updated` fields, and all five appear in the generated
knowledge indexes (`docs/knowledge-index.yaml`, `docs/knowledge-index-detail.yaml`,
and `docs/knowledge-index-nav.yaml`). This `planning` type is the project's indexed
foundation-doc type. No current module-level planning bundle was discovered.

#### I2. Animation and current-milestone claims match source contracts

`docs/SPEC.md:94-119` and `docs/ARCHITECTURE.md:76-99` agree with the source:

- `web/src/light-effects/preset-library.ts:6-37` defines eleven presets, creates
  new presets as recipe version 2, and upgrades v1 periods with the documented
  `max(old period, preset default)` rule.
- `web/src/board-renderer/types.ts:23-58` defines the eleven recipe kinds and the
  `recipeVersion: 1 | 2` compatibility boundary; the codecs reject v1 Bumblebee
  recipes as documented in `web/src/drafts/codec.ts:232-258`.
- `web/src/route-editor/LightEffectsPanel.tsx:66-83` clamps Bumblebee hover input,
  exposes independent Body/Wings controls, and provides explicit seamless-loop
  adoption.
- `web/src/route-editor/use-editor-lighting.ts:148-154` cancels browser animation
  on visibility loss. `web/src/pwa/ScreenAwakeControl.tsx:15-85` implements the
  documented foreground-aware screen-awake control.

The source also retains the documented future boundary: backup/safe-update work is
still future at this snapshot and is not treated as a documentation defect.

#### I3. Current verification is reproducible

Fresh snapshot checks passed: `npm test --workspace web -- --run` (75 files, 513
tests passed, 1 intentional source-verification test skipped), web typecheck, web
lint, and production PWA build (130 modules; service worker generated). The browser
lane also passed all 8 Playwright tests, including screen-awake persistence,
Bumblebee Body/Wings persistence, explicit v1-to-v2 adoption, and local lifecycle/
playlist flows. These results support the implemented milestone claims without
turning future catalog, logbook, ML, backup, or safe-update intent into current claims.

#### I4. Research provenance and index observations

The generated indexes were current at `2026-09-05T23:28:02Z`, with 23 indexed docs
and schema version 2. All indexed brief/program-report artifacts declare
`research_method`; all seven `blocks_phase` relationships resolve to an on-disk brief
and an on-disk `.work/` item. The historical north-star is correctly marked
superseded by `docs/ARCHITECTURE.md`.

## Clean Areas

- Ownership is consistent: VISION owns rationale/audience, SPEC owns capabilities and
  domain contracts, ARCHITECTURE owns boundaries/data flow/dependencies/risks,
  PRINCIPLES owns durable rules, and DEPLOY owns the operator runbook.
- Implemented and future status is consistent across the foundation docs for local
  Fullride control, local climb lifecycle, screenshot import, playlists, animation,
  catalog bootstrap/sync, logbook, grade prediction, recommendations, and multi-board
  expansion.
- Cross-document animation safety language agrees: v1 dispatch remains available,
  v2 is explicit, semantic roles are protected, complete scenes obey the accepted
  API-2 capacity policy, and visibility loss cancels browser playback.
- The Fullride definition claim is supported by
  `web/src/domain/boards/definitions/kilter-fullride-7x10.generated.ts:4,32` and
  the definition tests: 305 controllable placements with generated identities and
  LED mappings.
- Local draft and playlist claims align with their IndexedDB repositories/codecs and
  tests, including Draft/Finished/Trash lifecycle, 30-day retention, multi-list
  ordering, unavailable-entry resolution, and fresh-identity portable imports.
- Screenshot-import claims align with the local analysis/review/import source and
  tests: transient pixels, supplied 16-climb facts, ordinary 40-degree drafts, and
  active/Trash duplicate detection.
- Deployment documentation matches `.github/workflows/ci.yml:9-43,73-100` and
  `web/wrangler.jsonc:1-7`: green web lane gating, opt-in `ENABLE_DEPLOY`, repository
  secrets, Cloudflare Workers Static Assets, and SPA fallback.
- All Markdown links in the five current planning docs resolve, including the
  historical document, local briefs, and `.research/briefs/cloudflare-deploy`.

## Blocking Briefs Status

There is no active roadmap document with `Blocking briefs` lines; `.work/` owns
delivery status. The knowledge index declares seven `blocks_phase` relationships.
Every listed brief and target item exists on disk.

| Brief | Target item | Exists? | Target status |
|---|---|---|---|
| `.research/briefs/cloudflare-deploy/parent.md` | `.work/active/features/epic-foundation-ci-deploy.md` | Yes | done |
| `.research/briefs/kilter-grade-prediction/parent.md` | `.work/backlog/epic-grade-prediction.md` | Yes | drafting |
| `docs/briefs/board-control-web-bluetooth.md` | `.work/active/epics/epic-board-control.md` | Yes | done |
| `docs/briefs/board-rendering-and-filtering.md` | `.work/active/epics/epic-climb-browser.md` | Yes | done |
| `docs/briefs/catalog-sync-api.md` | `.work/active/epics/epic-catalog-sync.md` | Yes | drafting |
| `docs/briefs/foundation-pwa-sqlite.md` | `.work/active/epics/epic-foundation.md` | Yes | implementing |
| `docs/briefs/recommendations-and-training.md` | `.work/backlog/epic-recommendations.md` | Yes | drafting |

No missing next-phase blocking brief was found.

## DONE Output Verification

No active phase roadmap is present; the superseded historical document's Phase 0–3
roadmap is explicitly migrated to `.work/`. Done scopes were checked against source
outputs and the fresh verification commands.

| Done scope | Expected output sampled | Evidence |
|---|---|---|
| Board definitions/control | generated 305-placement definition, API-2/API-3 codecs, Web Bluetooth transport/controller, capacity policy | Source files exist; controller, codec, transport, and capacity tests pass |
| Climb browser/renderer | Fullride definition-driven renderer, private raster resolver, schematic fallback, local viewer | Source files exist; renderer/viewer tests pass |
| Route creation/import | IndexedDB drafts, editor/autosave, lifecycle, screenshot import | Source files exist; draft/editor/import tests pass |
| Playlists | IndexedDB lists, ordering/resolution, play-through, portable import/export | Source files exist; playlist tests and Playwright flows pass |
| Animation hardening currently implemented | v2 themes, v1 renderer dispatch, explicit upgrade, Bumblebee controls/orientation, foreground cancellation | Source files exist; relevant effect/editor/PWA tests and three animation-related Playwright flows pass |
| PWA/deploy foundation | CI workflow, Worker config, manifest/service worker/build verifier | Files exist; lint, typecheck, build, and browser CI lane pass |

No done scope with a missing declared output or declared test file was found.

## Provenance Summary

Counts below cover indexed `type: brief` and `type: program-report` documents only;
brief structure was not audited here.

| `research_method` | Documents | Latest updated |
|---|---:|---|
| `/research-program` | 0 | — |
| `/deep-research` | 8 | 2026-06-14 |
| `/research` | 1 | 2026-06-14 |
| `/brief` | 5 | 2026-06-14 |
| `hand-written` | 0 | — |
| `migrated` | 2 | 2026-08-02 |
| missing | 0 | — |

The corpus's highest-fidelity recorded method is `/deep-research`. Four `/brief`
documents updated 2026-06-13 predate the latest deep-research material and are
informational refresh candidates: `board-control-web-bluetooth`,
`board-rendering-and-filtering`, `catalog-sync-api`, and
`recommendations-and-training`. This is provenance information, not a finding.

## Audit Provenance

- Read `research-pipeline:doc-review` and the retained research-pipeline
  `docs/build-process.md` before auditing.
- Read the pinned snapshot `AGENTS.md` and `.agents/rules/agile-workflow.md`.
- Read `docs/knowledge-index.yaml`, `docs/knowledge-index-nav.yaml`, and
  `docs/knowledge-index-detail.yaml` to verify the document inventory and index
  freshness.
- Checked frontmatter, cross-document references, historical supersession, source
  contracts, implemented/future boundaries, `.work/` target status, CI workflow,
  Wrangler configuration, and the current animation/PWA source.
- Fresh commands passed: `npm test --workspace web -- --run`,
  `npm run --workspace web typecheck`, `npm run --workspace web lint`,
  `npm run --workspace web build`, and `npm -w web run test:e2e`.
- This report is the only file written by this audit. No foundation doc, source file,
  knowledge index, work item, or research artifact was edited.

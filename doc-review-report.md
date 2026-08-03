# Doc Review Report

**Project:** CruxControl

**Date:** 2026-08-02

**Review mode:** System-only

**Documents reviewed:** 7 system/operational documents + generated knowledge index and delivery substrate

**Passes run:** 1 system-level pass; no module planning documents were discovered

**Issues found:** Critical 0 · High 0 · Medium 4 · Low 4 · Info 3

## Verdict

**Pass with non-blocking documentation drift.** The source foundation bundle accurately
describes the implemented local Fullride milestone, physical API-2 evidence, API-2/API-3
codec boundary, saved effects, screenshot import, climb lifecycle, and lists. There are
no Critical or High findings. Four Medium source/index/substrate inconsistencies and four
Low clarity/provenance issues remain for a later documentation update.

## Pass 1: System-Level

### Critical (0)

None.

### High (0)

None.

### Medium (4)

#### M1. Generated knowledge indexes predate material foundation changes

**Files:** `docs/knowledge-index-detail.yaml`, `docs/knowledge-index-nav.yaml` vs
`docs/ARCHITECTURE.md`, `docs/PRINCIPLES.md`, and `.work/`

**What:** The indexes were last generated before the final effects/dogfooding foundation
updates. The detail index still records BLE as an API-level-3-only adapter, while current
architecture and code select API level 2 or 3. It also omits the new animation-safety
principle. The navigator reports 20 active stories and 17 backlog items; the current
substrate contains 35 active stories and 20 backlog items. Because these indexes are
session-navigation inputs, this is operationally meaningful drift even though the source
documents are correct.

**Fix:** Regenerate all knowledge-index layers with `/knowledge-index`; do not hand-edit
the generated YAML.

#### M2. Specification frontmatter miscounts its capability areas

**File:** `docs/SPEC.md:13`

**What:** The decision says capabilities are grouped into eight areas, but the document
contains sections 0 through 8: nine areas. Playlists were added as area 8 without updating
the count.

**Fix:** Change the decision to nine areas or remove the fragile count.

#### M3. Vision states future catalog/sync behavior in the present tense

**File:** `docs/VISION.md:104`

**What:** “CruxControl reads the public catalog and optionally syncs” describes behavior
that the README, architecture, substrate, and current installation correctly identify as
future work. The current installation has no catalog provider configured, catalog
bootstrap is drafting, and catalog sync is drafting.

**Fix:** Phrase this non-goal as intended future behavior (for example, “will read … and
may optionally sync”).

#### M4. Flashy-effects feature record retains a superseded physical checkpoint

**Files:** `.work/active/features/epic-route-creation-flashy-light-effect-demos.md:317`
vs `.work/active/stories/story-fix-{spatial-effect-board-cadence,matrix-ball-pong-variance,
bird-flock-path-variance,pac-man-path-variance,pentagram-shape}.md`

**What:** The feature implementation note says Snake, Beach Ball, and Pong have not been
operator-observed. Subsequent done stories record physical effects starting, successful
Beach Ball/Pong/Matrix behavior, recognizable birds and Pac-Man, and multiple pentagram
dogfood bounces. The foundation documents reflect the later evidence, but the owning
feature remains `implementing` with the earlier checkpoint.

**Fix:** During feature closure, replace the stale checkpoint with the accumulated
physical evidence and final review/verification record, then advance the feature through
its standard review boundary.

### Low (4)

#### L1. Two indexed briefs lack research provenance

**Files:** `docs/briefs/data-model.md`, `docs/briefs/hardware-and-protocol.md`

**What:** Both are `type: brief` but omit `research_method`, so the index cannot attest
which research workflow produced them.

**Fix:** Backfill the truthful method (`migrated` if the origin cannot be established),
then regenerate the index.

#### L2. Future modules are not consistently labeled in the architecture module map

**File:** `docs/ARCHITECTURE.md:100-118`

**What:** Logbook & Sessions and ML Pipeline are described with present-tense module
behavior, whereas nearby implemented modules are explicitly labeled and other sections
correctly call logbook/ML future milestones. This is not a contract contradiction, but
it makes the intended architecture map easy to mistake for an implementation inventory.

**Fix:** Prefix those entries with “future” or add one sentence explaining that the map
mixes implemented and intended modules and that implementation status lives in `.work/`.

#### L3. Current test-evidence prose names API-3 but omits API-2 coverage

**File:** `docs/SPEC.md:235-241`

**What:** The milestone evidence mentions API-level-3 bytes but not the now-material
API-level-2 codec/capacity policy suite. The surrounding capability and physical claims
are correct; this is incomplete evidence wording rather than a false claim.

**Fix:** Say “API-level-2/3 bytes and measured API-2 capacity policy.”

#### L4. URL-based sharing wording blurs implemented list sharing and future climb URLs

**File:** `docs/SPEC.md:272-273`

**What:** “sharing is explicit and URL-based (climbs, playlists)” can be read as a
current-status assertion. Portable playlist URL/file sharing exists; individual/provider
climb URLs remain future catalog work, and large lists use files rather than URLs.

**Fix:** Distinguish current playlist fragment/file sharing from future provider climb
URLs, or keep the constraint technology-neutral (“sharing is explicit”).

### Info (3)

#### I1. No module planning document set exists

Dynamic discovery found no module north stars or module architecture bundles. The only
file under `docs/architecture/` is the correctly indexed, superseded historical north-star.
No module passes were expected or skipped.

#### I2. All audited local Markdown links resolve

Every relative Markdown link in README, VISION, SPEC, ARCHITECTURE, PRINCIPLES, and
DEPLOY resolves to an existing file. The Cloudflare workflow, Worker configuration,
script names, Node version, workspace name, and documented status-check name match the
repository.

#### I3. The current automated baseline is reproducible

`npm test --workspace web -- --run` completed with 68 test files and 443 tests passing,
matching README. Current code also directly supports the documented 305 placements,
30-day Trash retention, 16-climb supplied migration, portable lists, API-2 127/20-light
profile, controller-selected API-2/API-3 codecs, all ten named spatial presets, reserved
semantic roles, and visibility-loss cancellation.

## Clean Areas

- Document ownership is mostly crisp: VISION owns rationale and audience, SPEC owns
  capability contracts/current milestone, ARCHITECTURE owns boundaries/data flow,
  PRINCIPLES owns durable decision rules, DEPLOY owns the operator runbook, and README
  is a concise current user/developer entry point.
- README no longer claims playlists are future, API-3 is the only controller protocol,
  physical board validation is pending, or the suite contains 218 tests.
- README, SPEC, ARCHITECTURE, PRINCIPLES, code, and physical work evidence agree on the
  scoped API-2 profile: 127 static lights, complete animated scenes of at most 20 lights
  at 2 FPS, no sparse deltas, and no mutation/truncation of unsafe saved designs.
- The ten named spatial presets agree across source docs and the preset registry: Ocean
  Tide, Tie-dye Spiral, Matrix Rain, Snake, Beach Ball, Pac-Man, Pong, Bird Flock,
  Frogger, and the fading circled inverted pentagram.
- Foreground-only animation behavior is consistent in README, SPEC, ARCHITECTURE,
  PRINCIPLES, the editor/detail UI, and visibility/disconnect/unmount tests.
- Screenshot import boundaries align: selected PNGs are processed locally and released;
  the supplied 16-climb migration contains checksum-linked facts without source pixels;
  confirmed records are ordinary 40° drafts; active and Trash duplicates are skipped.
- Draft/Finished/30-day Trash lifecycle and flexible multi-list membership, ordering,
  resolution, play-through, and portable sharing align across docs, code, unit tests, and
  Playwright flows.
- Private-source boundaries are consistent: the tracked calibrated raster is explicitly
  local/private, schematic rendering is the distributable fallback, and the untracked
  Kilter documents/screenshots remain outside application assets.
- DEPLOY accurately matches `.github/workflows/ci.yml` and `web/wrangler.jsonc`: the web
  lane gates a main-push deploy, `ENABLE_DEPLOY` is opt-in, credentials are GitHub
  secrets, and the Worker uses SPA fallback.
- All five indexed planning documents have present, non-empty project-schema-v2
  frontmatter (`description`, `type`, `kind`, `updated`); none are older than one year.

## Blocking Briefs Status

The project has no active roadmap document with “Blocking briefs” lines. The knowledge
index instead declares seven `blocks_phase` relationships; every brief and target work
item exists.

| Brief | Blocks item | Exists? | Status |
|---|---|---:|---|
| `.research/briefs/cloudflare-deploy/parent.md` | `epic-foundation-ci-deploy` | Yes | Written; target done |
| `.research/briefs/kilter-grade-prediction/parent.md` | `epic-grade-prediction` | Yes | Written; target drafting |
| `docs/briefs/board-control-web-bluetooth.md` | `epic-board-control` | Yes | Written; target done |
| `docs/briefs/board-rendering-and-filtering.md` | `epic-climb-browser` | Yes | Written; target done |
| `docs/briefs/catalog-sync-api.md` | `epic-catalog-sync` | Yes | Written; target drafting |
| `docs/briefs/foundation-pwa-sqlite.md` | `epic-foundation` | Yes | Written; target implementing |
| `docs/briefs/recommendations-and-training.md` | `epic-recommendations` | Yes | Written; target drafting |

No missing NEXT-item blocking brief was found.

## DONE Output Verification

There is no phase roadmap; `.work/` owns delivery status. The implemented system claims
were checked against current source paths and the green full suite.

| Done scope | Expected output sampled | Evidence |
|---|---|---|
| Board control | API-2/API-3 codecs, Web Bluetooth transport, controller, capacity policy | Files exist; codec/controller/capacity tests pass |
| Climb browser | Fullride definition, private raster resolver, schematic fallback, local viewer | Files exist; renderer/viewer tests pass |
| Route creation | IndexedDB drafts, editor/autosave, lifecycle, screenshot import | Files exist; repository/editor/import tests and E2E pass |
| Playlists | IndexedDB lists, reorder/resolution, play-through, portable import/export | Files exist; playlist unit/component/E2E tests pass |
| PWA/deploy foundation | Workbox manifest/build verifier, icons, CI, Worker config | Files exist; PWA verifier passes in the production build suite |

No done scope with a missing declared output or missing declared test file was found.

## Provenance Summary

Provenance is aggregated across indexed `brief` and `program-report` documents.

| `research_method` | Documents | Latest updated |
|---|---:|---|
| `/research-program` | 0 | — |
| `/deep-research` | 8 | 2026-06-14 |
| `/research` | 1 | 2026-06-14 |
| `/brief` | 5 | 2026-06-14 |
| `hand-written` | 0 | — |
| `migrated` | 0 | — |
| missing | 2 | 2026-06-13 |

The corpus's highest-fidelity recorded method is `/deep-research`.

### Refresh Candidates

Lower-tier or unattributed briefs last updated before the latest deep-research material.
This is informational and does not imply their technical content is wrong.

| Slug | `research_method` | Updated | Note |
|---|---|---|---|
| `board-control-web-bluetooth` | `/brief` | 2026-06-13 | Predates latest deep-research run |
| `board-rendering-and-filtering` | `/brief` | 2026-06-13 | Predates latest deep-research run |
| `catalog-sync-api` | `/brief` | 2026-06-13 | Predates latest deep-research run |
| `recommendations-and-training` | `/brief` | 2026-06-13 | Predates latest deep-research run |
| `data-model` | missing | 2026-06-13 | Provenance should be backfilled first |
| `hardware-and-protocol` | missing | 2026-06-13 | Provenance should be backfilled first |

## Audit Provenance

- Read the installed `research-pipeline:doc-review` instructions and complete retained
  build-process methodology before auditing.
- Audited README, all five indexed foundation documents, DEPLOY, applicable AGENTS.md,
  current work-view state, generated knowledge indexes, representative implementation
  contracts, workflow/configuration files, and full test output.
- Used repository files and current command output as authority; no planning documents,
  generated indexes, private Kilter source directories, or application code were changed.
- This report is the only audit artifact created by this pass.

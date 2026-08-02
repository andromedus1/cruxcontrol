# Doc Review Report

**Project:** CruxControl

**Date:** 2026-08-02

**Documents reviewed:** 5 system planning documents; 0 module planning sets

**Passes run:** 3 full system passes (initial audit, exit-gate audit, and follow-up
remediation audit)
**Initial issues:** 0 Critical / 2 High / 2 Medium / 3 Low / 2 Info

**Final issues:** 0 Critical / 0 High / 0 Medium / 3 Low / 4 Info

## Initial System-Level Pass

### Critical (0)

None.

### High (2)

#### Implemented and future product outcomes are blurred in the vision

**Files:** `docs/VISION.md`, compared with `README.md`, `docs/SPEC.md`, code, and
the `.work/` substrate.

**What:** The vision described find/create/light/climb/save-result and URL sharing as
if they were all part of the completed first milestone. The implemented milestone is
local create, save, reopen, render, and board lighting. Logbook/results, community
catalog browsing, playlists, and shareable URLs remain future work.

**Fix:** State the implemented create-save-light boundary explicitly and present
logging, community browsing, playlists, and sharing as future outcomes.

#### Hosted deployment is asserted without deployment acceptance evidence

**Files:** `docs/VISION.md`, `docs/SPEC.md`, `docs/DEPLOY.md`.

**What:** The documents said the application “ships” as a hosted app, while the deploy
runbook states that Cloudflare secrets, opt-in configuration, and branch protection
are still operator setup. The distributable PWA and CI deploy path are implemented,
but a live hosted deployment has not been verified.

**Fix:** Describe the app as built for static hosted distribution and reserve “live”
or “ships” claims for deployment acceptance evidence.

### Medium (3, resolved in follow-up)

#### User-facing Kilter role terminology is stale

**Files:** `docs/SPEC.md`, compared with
`web/src/domain/boards/definitions/kilter-fullride-7x10.ts`.

**What:** The spec calls the middle role cyan and the foot-only role orange. The
canonical user-facing names are blue and gold/yellow. Source protocol RGB values may
still be described separately as cyan and amber/orange.

**Suggested fix:** Separate user-facing semantic labels from source protocol RGB.

**Resolution:** `SPEC.md` now uses green, blue, red/pink, and gold/yellow for the
user-facing roles while preserving provider/source protocol RGB separately.

#### Architecture implies a currently active Kilter sync connection

**File:** `docs/ARCHITECTURE.md`.

**What:** Static-distribution prose says the client talks to the Kilter sync API even
though the sync adapter is future work and `epic-catalog-sync` remains drafting.

**Suggested fix:** Say a future provider adapter may connect to that API; retain BLE
as the current external connection.

**Resolution:** `ARCHITECTURE.md` now distinguishes configured-but-unverified static
hosting, the current BLE edge, and the future Kilter provider adapter.

#### Mobile constraint includes unimplemented logging

**File:** `docs/SPEC.md`.

**What:** The constraint says responsive browsing, editing, and logging work on modern
phones. Local draft browsing/editing are implemented, but logging remains a drafting
epic.

**Suggested fix:** Describe current browsing/editing separately and state that logging
must be responsive when its milestone ships.

**Resolution:** `SPEC.md` now states that local browsing/editing are responsive today
and makes responsive logging a requirement for its future milestone.

### Low (4 initial/follow-up findings; 3 remain)

1. `docs/VISION.md` frontmatter still describes friend distribution and shareable
   URLs more absolutely than the revised body. This records decision intent rather
   than claiming current behavior, but could be sharpened later.
2. `docs/briefs/data-model.md` is a brief without `research_method` frontmatter.
3. `docs/briefs/hardware-and-protocol.md` is a brief without `research_method`
   frontmatter.
4. “Original SVG hold artwork” could be mistaken for vendor artwork. This was resolved
   in the follow-up by naming the renderer's independently authored schematic SVG
   archetypes explicitly.

### Info (4)

1. No module-level planning documents were discovered. Code directories are modules,
   but their delivery designs correctly live in `.work/` rather than duplicate module
   planning sets.
2. All planning-document Markdown references resolve, and every indexed
   `blocks_phase` brief exists on disk.
3. The knowledge index contains 23 documents and matches the discovered corpus; all
   five planning documents have the index-required frontmatter.
4. Canonical role terminology and source protocol RGB terminology are intentionally
   separate: product docs use green/blue/red-pink/gold-yellow, while research primers
   preserve exact provider/source values.

## Blocking Briefs Status

| Brief | Blocks | Exists | Status |
|---|---|---:|---|
| `docs/briefs/foundation-pwa-sqlite.md` | `epic-foundation` | Yes | Written |
| `.research/briefs/cloudflare-deploy/parent.md` | `epic-foundation-ci-deploy` | Yes | Written |
| `docs/briefs/board-control-web-bluetooth.md` | `epic-board-control` | Yes | Written |
| `docs/briefs/board-rendering-and-filtering.md` | `epic-climb-browser` | Yes | Written |
| `docs/briefs/catalog-sync-api.md` | `epic-catalog-sync` | Yes | Written |
| `.research/briefs/kilter-grade-prediction/parent.md` | `epic-grade-prediction` | Yes | Written |
| `docs/briefs/recommendations-and-training.md` | `epic-recommendations` | Yes | Written |

The ready catalog-bootstrap feature is blocked by a documented VFS import decision,
not a missing brief.

## DONE Work Verification

| Work | Expected output | Evidence |
|---|---|---|
| Universal board platform | Fullride definition and installation/controller contracts | Present; 305-placement tests pass |
| Board control | API-level-3 codec, Web Bluetooth lifecycle, light/clear/preview | Present; contract and integration tests pass |
| Climb browser | Fullride renderer and browser-local draft viewer | Present; renderer/viewer tests pass |
| Route creation | Unrestricted IndexedDB drafts and responsive editor | Present; create-save-light and E2E specs exist |

Automated verification: 38 Vitest files and 218 tests pass. Typecheck, lint, and
production build were also green in the independent audit. Physical Fullride 7x10 +
Android Chrome verification remains explicitly and consistently pending.

## Provenance Summary

| `research_method` | Documents | Latest updated |
|---|---:|---|
| `/deep-research` | 8 | 2026-06-14 |
| `/research` | 1 | 2026-06-14 |
| `/brief` | 5 | 2026-06-14 |
| `(missing)` | 2 | — |

### Refresh Candidates

Lower-tier documents older than the latest `/deep-research` work are informational
refresh candidates: `board-control-web-bluetooth`, `board-rendering-and-filtering`,
and `catalog-sync-api`. The method-missing data-model and hardware/protocol primers
are also natural migration candidates.

## Clean Areas

- iOS direct control, multi-board providers, ML, and recommendations are consistently
  future or deferred.
- Catalog bootstrap/community browsing are separated from the completed local-draft
  path.
- No document claims the physical board smoke has passed.
- Installed dependencies, CI configuration, and current code match the documented
  React/Vite, IndexedDB, wa-sqlite, Web Bluetooth, and PWA boundaries.

## Auto-Fix Loop

- **Iteration 1:** 0 Critical / 2 High / 2 Medium / 3 Low / 2 Info. Fixed both
  High findings in `VISION.md`, `SPEC.md`, and `DEPLOY.md`.
- **Iteration 2 (fresh full exit-gate audit):** 0 Critical / 0 High / 3 Medium /
  4 Low / 3 Info.
- **Follow-up remediation:** Corrected the three Medium findings and the concise SVG
  provenance finding at the goal-closure checkpoint.
- **Iteration 3 (fresh full follow-up audit):** 0 Critical / 0 High / 0 Medium /
  3 Low / 4 Info.

**Outcome: PASS.** The mechanical exit condition is satisfied by a freshly dispatched
full audit returning zero Critical, High, or Medium findings. The three remaining Low
findings are optional VISION frontmatter phrasing and two legacy briefs without
`research_method`; they remain for future corpus refresh rather than milestone closure.

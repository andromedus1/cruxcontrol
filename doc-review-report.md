# Doc Review Report

**Project:** CruxControl
**Date:** 2026-10-18
**Revision:** `910c6e1` on `codex/kilter-catalog-filters` (filter implementation `cf7142c`)
**Documents reviewed:** 7 (5 system planning documents + AGENTS.md and CLAUDE.md; 0 module passes)
**Passes run:** 1 fresh system pass (`--system-only`)
**Issues found:** Critical **0** / High **0** / Medium **1** / Low **0**
**Exit gate:** 0 Critical and 0 High, independently confirmed by this dispatched fresh audit.

## Pass 1: System-Level

### Critical (0)

None.

### High (0)

None.

### Medium (1)

#### M1 — Android preservation feature-review status is stale

**Files:** `docs/VISION.md:20,70`, `docs/SPEC.md:310,545`, `docs/ARCHITECTURE.md:296` versus `.work/active/features/epic-library-preservation-android-parity.md:625–658`.

**What:** The system docs explicitly say that required *feature review* remains after the owner-observed phone/Fullride acceptance. The Android-parity feature now has `stage: done`; its Standard review adjudication records a completed independent Claude Opus review, the accepted editor-Back fix and verification, and its Closure records passing required CI run `39169868839`. The previously reviewed sibling preservation features are also done in the current work snapshot. These statements describe an earlier checkpoint rather than the current feature status. The preservation epic itself is still in review, so this is stale status wording rather than evidence that all preservation delivery is complete. General readiness requirements mentioning review/delivery remain valid.

**Fix:** Replace the specific outstanding-*feature-review* claims with the current distinction: Android-parity feature review and required CI have passed; preservation epic review/final delivery remain where applicable. Preserve the owner-observed versus synthetic/instrumented distinction, scenario limits and pending physical iPhone acceptance. Do not imply that installed release30 contains the subsequently fixed editor-Back source change.

### Low (0)

None.

## Clean Areas

- SPEC and ARCHITECTURE accurately describe combined whole-catalog name/angle, inclusive rounded-grade ranges, three-star minimum rating, distinct ascensionists at the selected angle and literal setter-substring matching. The adapter applies parameterized predicates before pagination (`web/src/data/catalog/kilter-catalog.ts`).
- All five sort modes, rating default, UUID ascending tie-breaks, cursor v2 filter/sort/snapshot/layout/page-size binding, invalid-statistic keys and final-inspected-candidate continuation match the implementation. Default pages contain up to 25 rows and inspect up to 250 candidates; no total result count is claimed.
- The dedicated filter sheet stages changes, validates Apply, discards Cancel/Escape/native Back, resets only its draft and exposes applied-chip removal. Committed query changes invalidate selection, page history and stale results. Catalog row metrics use the optional shared viewer slot. Supporting adapter/UI tests and targeted E2E files exist.
- Hold selection/count, grade-consensus accuracy, personal sent/liked state and remaining official filters remain explicitly deferred. Anonymous catalog statistics do not establish personal history or complete official-app parity.
- Older-snapshot source freshness remains unknown, with no live refresh. Download consent, offline reads, authored-library availability and unresolved public binary distribution permission remain explicit.
- Android native SQLite and web/iOS IndexedDB storage are consistently distinguished. Local persistence is not called independent recovery. Portable-file and automatic-online recovery remain separate capabilities, with clean-install verification, immutable retention, conflict handling and offline pending-state requirements.
- Recorded Android lighting, clear, effects, connected playlist play-through, background/reopen, reconnect and offline checks remain owner observations. The docs do not turn them into instrumented radio evidence or catalog-specific physical playlist/Trash/angle proof. Physical iPhone BLE, storage-pressure and authentication acceptance remain open.
- AGENTS.md and CLAUDE.md are identical. Their same-origin/profile preservation, fresh whole-library backup, safe update admission and post-update comparison rules are aligned with the documented update/recovery boundaries.
- DEPLOY's Worker target, `ENABLE_DEPLOY` opt-in, main-push restriction, `needs: [web]`, secret names and required web status-check name match `.github/workflows/ci.yml` and the checked-in configuration. Concrete deployment values are not treated as drift.
- All local Markdown links in the seven reviewed system/rule documents resolve. All 30 paths in the current generated knowledge index exist. The index inventories five system planning docs; no module pass was requested.
- All five planning documents have description/type/updated frontmatter. Their local `type: planning` / `kind: planning` schema agrees with the project's generated index; the skill's generic type examples are not treated as a competing schema.

## Blocking Briefs Status

No system roadmap document contains a NEXT-phase blocking-brief table. Delivery ordering belongs to `.work/`. Existing indexed `blocks_phase` references were checked for file existence; future brief contents were not re-audited.

| Brief | Owning work | Exists on Disk? | Status |
|-------|-------------|-----------------|--------|
| `.research/briefs/cloudflare-deploy/parent.md` | epic-foundation-ci-deploy | Yes | Present |
| `docs/briefs/foundation-pwa-sqlite.md` | epic-foundation | Yes | Present |
| `docs/briefs/board-control-web-bluetooth.md` | epic-board-control | Yes | Present |
| `docs/briefs/board-rendering-and-filtering.md` | epic-climb-browser | Yes | Present |
| `docs/briefs/catalog-sync-api.md` | epic-catalog-sync | Yes | Present; current acquisition remains separately gated |
| `.research/briefs/kilter-grade-prediction/parent.md` | epic-grade-prediction | Yes | Present; implementation future |
| `docs/briefs/recommendations-and-training.md` | epic-recommendations | Yes | Present; implementation future |

No claimed-written blocking brief is missing; no missing NEXT-phase brief was identified.

## DONE / Implemented Output Verification

The system documents use capability prose rather than numbered DONE phases. These implemented claims have corresponding source/test outputs; this audit does not rerun product acceptance or infer physical-device results from source files.

| Capability/checkpoint | Documented status | Expected output | Files exist? |
|-----------------------|-------------------|-----------------|--------------|
| Statistics filters | Implemented; feature in review | CatalogFilterDialog, CatalogBrowser, query adapter, tests and catalog E2E | Yes |
| Worker-backed catalog | Implemented older-snapshot slice | Catalog service, SQLite worker, bootstrap and E2E | Yes |
| Native Android library | Implemented; synthetic and owner evidence qualified | Native library adapter/opening boundary and tests | Yes |
| Native BLE boundary | Implemented; physical iPhone unverified | Native BLE transport and tests, native runtime | Yes |
| Whole-library backup | Implemented | Library backup service/codecs/store/dialog and tests | Yes |
| Static deployment | Configured, operator opt-in | CI deploy job and Worker configuration | Yes |

Relevant outputs include `web/src/catalog/CatalogFilterDialog.tsx`, `web/src/catalog/CatalogBrowser.tsx`, `web/src/data/catalog/kilter-catalog.ts`, `web/src/data/sqlite/catalog.worker.ts`, `web/e2e/catalog-browser.spec.ts`, `web/e2e/catalog-bootstrap.spec.ts`, `prototypes/ios/src/native-library.ts`, `prototypes/ios/src/native-ble-transport.ts`, `prototypes/ios/src/runtime.ts`, `web/src/library-backup/service.ts`, `.github/workflows/ci.yml` and `web/wrangler.jsonc`.

## Provenance Summary

Informational aggregation of indexed brief/report frontmatter only; brief structure and semantic support were outside this system-only audit.

| research_method | Briefs/reports | Latest updated |
|-----------------|----------------|----------------|
| /research-program | 0 | — |
| /deep-research | 8 | 2026-06-14 |
| /research | 2 | 2026-10-10 |
| /brief | 5 | 2026-06-14 |
| hand-written | 0 | — |
| migrated | 2 | 2026-08-02 |
| (missing) | 5 | 2026-10-09 |

### Refresh Candidates

The corpus's highest recorded tool tier is `/deep-research`, latest 2026-06-14. Four lower-tier `/brief` artifacts predate it: `board-control-web-bluetooth`, `board-rendering-and-filtering`, `catalog-sync-api` and `recommendations-and-training` (all 2026-06-13). This is the skill's date/tier heuristic, not a finding that their topics need renewed research. No topic-overlap conclusion is asserted. Missing-method analytical briefs were not assigned an inferred research tier.

## Audit Boundaries

This was the independently dispatched Phase 2 fresh system audit after the docs update. Only this report was written; source documents, work items and generated indexes were left to the host. No commits, device operations, network service changes or new acceptance claims were made. Untracked `docs/kilter_docs/`, `docs/set_boulders/` and private files were not inspected. The parent-provided installed-release30 and owner-observation context was checked against durable work records where available; it was not independently measured on hardware.

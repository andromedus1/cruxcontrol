# Doc Review Report

**Project:** CruxControl
**Date:** 2026-10-10
**Workflow:** research-pipeline:doc-review; fresh Claude Sonnet pass via peeragent
**Reviewer job:** `20261010T173302Z-bb971f17`
**System documents:** 5; **module planning documents:** 0; **passes:** 1
**Independent verdict:** 0 Critical / 0 High / 3 Medium / 10 Low / 8 Info

The report records its reviewed snapshot. Ongoing implementation is not represented as completed acceptance. No C/H fix loop was required.

# CruxControl documentation audit (fresh, read-only)

Scope was committed state through `4f0e81c`, the parent review record `1de6550`, and the index-regeneration commit `d963359`. I edited nothing and did not run builds, tests, the emulator, or any Git or account mutation.

**Repository moved during the audit.** HEAD advanced to `03eb286` ("verify private Android catalog packaging", committed 11:35). It is outside the requested range, so I did not audit it, except where noted on M3 and L10. The uncommitted tree (CatalogBrowser, PlaylistLibrary, CruxControlWorkspace, LibraryBackupFilePlugin and other files) is not claimed by any committed document.

## Verdict

**Critical 0 / High 0.** This is the mechanical result of the single system pass. There is no roadmap document with phases and no module-level planning docs, so the roadmap-specific checks map to `.work/` items.

- **Medium findings:** 3 remain and the host should fix them. They do not gate the verdict.
- **Delivery caveat:** C/H-clear does not mean the native proof is complete. Final-source empty restore, merged OS-backup config proof, bridge-log/Logcat proof, and green PR CI are still pending, per the work items. No foundation document claims them as done.

## Inventory

| Item | Count |
|---|---|
| System planning docs | 5 (VISION, SPEC, ARCHITECTURE, PRINCIPLES, DEPLOY) |
| Module planning docs / module passes | 0 |
| Project rules | `AGENTS.md` (`CLAUDE.md` is a symlink to it), `.agents/rules/agile-workflow.md`, `.work/CONVENTIONS.md` |
| READMEs checked for operational claims | `README.md`, `prototypes/ios/README.md`, `ml/README.md` |
| Historical doc (non-authoritative) | `docs/architecture/history/north-star.md` |
| Passes run | 1 |

I excluded `docs/kilter_docs/` and `docs/set_boulders/` (untracked, private). Research briefs were checked for paths, frontmatter and provenance only.

## Pass 1: System-level

**Totals: Critical 0, High 0, Medium 3, Low 10, Info 8.**

### Medium (3)

**M1. ARCHITECTURE describes iOS backup delivery as if it were platform-neutral.**
- **Where:** `docs/ARCHITECTURE.md:297-301` says native delivery "encodes UTF-8 JSON into the app cache and passes a Filesystem URI to Share… cancellation retains it".
- **Contradicting code:** committed Android delivery uses a Storage Access Framework `ACTION_CREATE_DOCUMENT` plugin with no app cache.
  - `prototypes/ios/src/runtime.ts:65-66` selects `createAndroidBackupDelivery` for Android.
  - `prototypes/ios/src/android-backup-delivery.ts` and `LibraryBackupFilePlugin.java` implement it.
  - `.work/active/features/epic-library-preservation-portable-files.md` ("Design decisions") records the design.
- **Fix:** qualify the paragraph as iOS, and add the Android SAF path with "native proof pending".

**M2. README preset list contradicts SPEC, ARCHITECTURE and code.**
- **Where:** `README.md:45-48` lists Frogger and omits Fireflies, Shooting Stars, Jellyfish and Embers.
- **Evidence:** `web/src/route-editor/LightEffectsPanel.tsx:63` filters Frogger out of the picker. `web/src/light-effects/preset-library.ts:7-21` has 14 pickable presets. `docs/SPEC.md:129-146` and `docs/ARCHITECTURE.md:149-167` agree with the code.
- **Fix:** list the 14 available presets and note that Frogger is retained only for saved recipes.

**M3. `prototypes/ios/README.md:67` ("The Android compile also runs in CI") over-claims for the scoped commits.**
- **At `4f0e81c` and `d963359`:**
  - `.github/workflows/ci.yml:145-150` runs `npm --prefix prototypes/ios run test:catalog-package` before `build:android`.
  - The committed `prototypes/ios/package.json` has no such script; the script file `prototypes/ios/scripts/android-catalog.test.mjs` did not exist in those commits.
  - So the committed `android-prototype` lane fails before reaching compile.
- **Tracking:** the native-library item records this as "CI commit integration (blocker until committed)" (`.work/active/features/epic-library-preservation-native-library.md:358`).
- **At HEAD `03eb286`:** the script and package entry exist, so the missing-script cause is gone. I did not audit its README changes.

### Low (10)

- **L1. OS backup config stated as fact without its pending verification.** `docs/SPEC.md:291-295`, `docs/ARCHITECTURE.md:257-261` and VISION say the package "disables OS Auto Backup" and excludes backup domains.
  - Source at HEAD supports it: `AndroidManifest.xml` has `allowBackup="false"`, and `backup_rules.xml` and `data_extraction_rules.xml` exclude the domains.
  - The native-library item (line 363) still lists "Verify the final merged manifest/rules" as pending. Add a "source policy; merged manifest unverified" qualifier. The OEM caveat is already present.
- **L2. System docs do not surface the pending final-source empty-emulator proof.**
  - `docs/VISION.md:41-44`, `docs/SPEC.md:382-384`, `README.md:23-27` and `prototypes/ios/README.md:94-98` say the emulator "has passed" restore/edit/relaunch/update. This is accurate for the evidence obtained (1→2, 2→3, 3→4 with a resumed edit).
  - The native-library item (line 370) lists a separate final-source empty-emulator run as a blocker.
  - This is not false, but the claim is not scoped to a source revision. Note the pending run in SPEC or ARCHITECTURE.
- **L3. The daily-use admission gate is not stated in the system docs.**
  - It reads: automatic online backup and clean-client recovery before real authoring.
  - It lives in `.work/active/epics/epic-library-preservation.md:355,368` and `prototypes/ios/README.md:98`. VISION and SPEC only say protections are "intended, not shipped", which does not contradict it.
- **L4. "Sync Engine" is not a module.** `docs/ARCHITECTURE.md:182` ("via the Sync Engine") names a module that is absent from the Module Map; Catalog Providers is §3. The decision at `:38` ("separate incremental shared_syncs module") also has no map entry.
- **L5. Stale ARCHITECTURE module-number and tag cross-references in work items.**

  | File:line | Says | Current |
  |---|---|---|
  | `epic-logbook.md:47` | §7 (Logbook) | §9 |
  | `epic-logbook.md:41` | catalog-sync carries `[needs-brief]` | tags are now `[data]` |
  | `epic-grade-prediction.md:61` | §8 (ML) | §13 |
  | `epic-recommendations.md:49` | §8 (ML) | §13 |
  | `epic-catalog-sync.md:50` | §2 (Sync Engine) | §3 |
  | `epic-foundation.md:87`, `epic-foundation-scaffold.md:44`, `epic-foundation-sqlite-readpath.md:44` | §1 (Data Layer) | §2 |

- **L6. Broken relative links** (36 markdown files and 78 checked in total; 6 broken).
  - `.work/backlog/epic-grade-prediction.md:34,44` and `.work/backlog/epic-recommendations.md:37` have an extra `../`.
  - `.research/briefs/cloudflare-deploy/parent.md:33` points to `../foundation-pwa-sqlite/parent.md`; the real file is `docs/briefs/foundation-pwa-sqlite.md`.
  - `docs/architecture/history/north-star.md:162-163` has two more (historical, so Info-weight).
- **L7. Missing `research_method` on 5 `type: brief` docs** under `.research/analysis/briefs/`: android-chrome-recovery-access, independent-library-preservation, invited-library-hosting-costs, invited-offline-library, ios-shared-client. This is one grouped finding covering 5 docs. `build-process.md` says analytical artifacts keep their own schema, so it is informational in spirit.
- **L8. Stale text in the preservation epic.** `.work/active/epics/epic-library-preservation.md:131` says "the epic remains at drafting", but the frontmatter is `stage: implementing`. The body also cites `native-backup-service-costs`, which is missing from `research_refs`.
- **L9. `AGENTS.md:24` points to `.agents/skills/patterns/`**, which does not exist. No patterns gate has run.
- **L10. `prototypes/ios/README.md` Android section (~lines 70-98) predates the SAF save path.** It documents only `smoke-android.mjs` and omits `smoke-android-portable.mjs`. The portable-files item defers this alignment explicitly (tracked). `03eb286` changed this README, but I did not audit it.

### Info (8)

1. **Frontmatter type:** all five planning docs use `type: planning` / `kind: planning`, outside the skill's example enum. The index generator accepts it, it is consistent, and it was adjudicated in the 2026-10-09 report. It is not counted as a finding.
2. **No roadmap or phases:** blocking-brief and DONE-phase checks are mapped to `.work/` items.
3. **Decision counts:** ARCHITECTURE and SPEC each carry 15 `decisions` entries (index lint guidance is 12).
4. **Old reports:** root `doc-review-report.md` (2026-10-09, 27 docs) and `MIGRATION_REPORT.md` (bootstrap era) are stale records. The index now has 30 docs.
5. **DEPLOY.md** (updated 2026-08-02) is accurate for the `web` lane, `needs: [web]` and the `ENABLE_DEPLOY` gate. CI has since added `ios-prototype`, `android-prototype` and `ml` lanes, which are not required checks or deploy dependencies.
6. **Brief vs implementation:** `docs/briefs/foundation-pwa-sqlite.md` recommends OPFSCoopSyncVFS. Code and ARCHITECTURE use `AccessHandlePoolVFS` (`web/src/data/sqlite/catalog.worker.ts:4,64`), and the decision is recorded in `epic-foundation-catalog-bootstrap.md:105,565`.
7. **Epic stage:** `epic-shared-climb-library` is `implementing` while all 4 features and 4 stories are `drafting`. The docs correctly say it is not implemented.
8. **Uncommitted work and HEAD movement:** HEAD moved to `03eb286` during the audit, and the uncommitted tree is not claimed by any committed document (see the top note).

## Clean areas

- The five docs agree on every core claim: Fullride-first, local ownership, and separate board / catalog-provider / controller boundaries.
- Native storage is described consistently as not independent recovery.
- No service, account or automatic-backup implementation is claimed (matches the drafting private-vault and automatic-backup items).
- The catalog is consistently an "older snapshot, unknown freshness, no live updates, public distribution gated".
- No physical-phone, Fullride or iPhone acceptance is claimed anywhere.
- Source-verified against committed code:
  - **Library backup:** limits of 25 MiB / 10,000 / 1,000 / 100,000 (`codec.ts:18-21`); Android snapshot in one `BEGIN IMMEDIATE` transaction (`native-library.ts:530`); WAL plus `synchronous=FULL` (`open-native-library.ts:93-94`).
  - **Controller / capacity:** 127-light static scenes and 20 lights at 2 FPS (`capacity-policy.ts:26-32`); 180 ms preview debounce (`use-editor-lighting.ts:32`); catalog page size 25 (`CatalogBrowser.tsx:169`).
  - **PWA and catalog storage:** PWA `registerType: 'prompt'`, `skipWaiting: false`, `clientsClaim: false`, `injectRegister: false` (`vite.config.ts:52-53,97-98`); two OPFS slots with receipt metadata (`catalog-receipt.ts`).
  - **Versions:** Capacitor 8.4.3, BLE 8.3.0, App 8.1.1, SQLite 8.1.1; React 19, Vite 6; `.nvmrc` 20, prototype 22.
  - **Android config:** `loggingBehavior: "none"` at HEAD.
- **DEPLOY.md** matches `ci.yml`: the job name `web (lint / typecheck / test / build)`, `needs: [web]`, the `ENABLE_DEPLOY` gate, wrangler-action v3, and Worker name `cruxcontrol`.
- **Knowledge index:** all 30 entries exist and match frontmatter `updated`.
- **Work graph:** every `depends_on` and `parent` id in active and backlog resolves (0 unresolved).

## Blocking-brief status

There is no roadmap-owned table. Briefs with `blocks_phase` all exist on disk, and none is "not yet written" (a grep of `.work` and docs found none).

| Brief | Blocks | Exists | Blocked item stage |
|---|---|---|---|
| `.research/briefs/cloudflare-deploy/parent.md` | epic-foundation-ci-deploy | Yes | done |
| `docs/briefs/board-control-web-bluetooth.md` | epic-board-control | Yes | done (archived) |
| `docs/briefs/board-rendering-and-filtering.md` | epic-climb-browser | Yes | done (archived) |
| `docs/briefs/catalog-sync-api.md` | epic-catalog-sync | Yes | drafting (epic says source refresh needed) |
| `docs/briefs/foundation-pwa-sqlite.md` | epic-foundation | Yes | implementing |
| `docs/briefs/recommendations-and-training.md` | epic-recommendations | Yes | backlog |
| `.research/briefs/kilter-grade-prediction/parent.md` | epic-grade-prediction | Yes | backlog |

## Completed-output verification

Every output checked exists on disk at HEAD. Items marked done cite no missing file, and I found no Critical or High gaps.

| Done item | Output verified |
|---|---|
| epic-foundation-scaffold, pwa-shell, ci-deploy, verify-worker-build | `web/package.json`, PWA config in `vite.config.ts`, `ci.yml`, `web/wrangler.jsonc`, `docs/DEPLOY.md`, `web/scripts/check-pwa-build.mjs` |
| epic-foundation-sqlite-readpath, catalog-bootstrap | `web/src/data/sqlite/*`, `web/src/data/catalog`, `web/public/catalog/manifest.json` (`.db.gz` gitignored), `web/e2e/catalog-bootstrap.spec.ts` |
| kilter-community-browser | `web/src/catalog/CatalogBrowser.tsx`, `web/e2e/catalog-browser.spec.ts` |
| climb-browser children, library-backup | `web/src/board-renderer`, `web/src/library-backup/*`, generated Fullride definition |
| ios-controller-bridge native-ble, backup-export | `prototypes/ios/src/native-ble-transport.ts`, `native-backup-delivery.ts` |
| native-library (implementing, not done) | `native-library.ts`, `open-native-library.ts`, Android project, manifest and rules |

Not done, correctly not claimed as shipped: portable-files, android-catalog, android-parity, private-vault, automatic-backup and the shared-library features.

## Frontmatter compliance

- **Docs checked:** 5 planning, 1 historical, 7 `docs/briefs`, 8 `.research/analysis`, 9 `.research/briefs` (30 index-covered docs).
- **Present with `description`, `type`, `updated`:** 30 of 30. No `updated` is older than 2026-06-13.
- **`research_method`:** missing on 5 briefs (L7, Low). The 2 landscapes are a different `type`.
- **Not indexable:** READMEs, `AGENTS.md` and `.research/reference/*/INDEX.md` have no frontmatter by design.

## Provenance summary (22 briefs)

| research_method | Briefs | Latest updated |
|---|---|---|
| /research-program | 0 | none |
| /deep-research | 8 | 2026-06-14 |
| /research | 2 | 2026-10-10 |
| /brief | 5 | 2026-06-14 |
| hand-written | 0 | none |
| migrated | 2 | 2026-08-02 |
| (missing) | 5 | none |

### Refresh candidates (informational, not findings)

The highest tier used is `/deep-research`, and its latest run is dated 2026-06-14. Lower-tier briefs older than that:

| Slug | research_method | Updated | Note |
|---|---|---|---|
| `docs/briefs/recommendations-and-training.md` | /brief | 2026-06-13 | overlaps the grade-prediction campaign topics |
| `docs/briefs/catalog-sync-api.md` | /brief | 2026-06-13 | `epic-catalog-sync` itself calls for a source refresh |
| `docs/briefs/board-control-web-bluetooth.md` | /brief | 2026-06-13 | |
| `docs/briefs/board-rendering-and-filtering.md` | /brief | 2026-06-13 | |

The 5 briefs without `research_method` cannot be tiered.

## Delivery state (distinguished from documentation)

- **Native storage:** committed. The core emulator proof exists, but the final-source empty restore is pending (native-library item).
- **OS backup config:** policy committed in `1de6550`. The merged manifest/rules check is pending.
- **Bridge logging:** `loggingBehavior: "none"` committed. Logcat/final-config proof is pending.
- **CI:** the committed catalog step at scoped commits lacked its script (M3). The repair landed in `03eb286`, outside scope, and green PR CI is unconfirmed.
- **Android portable save flow:** committed (`492ddf1`). Emulator proof is pending per the item; later hardening is uncommitted.
- **Android catalog:** the committed docs claim nothing. Bundling is outside the scoped range (`03eb286`), and packaged WebView proof remains pending.
- **Private account and automatic backup:** drafting, with no provider or billing selected.
- **Physical phone/Fullride and iPhone acceptance:** none claimed.

## Required fixes before the host's next review

None are required to reach C/H-clear. The recommended order is M1, M2, M3 (re-check against `03eb286`), then L1-L3 for wording precision. L4-L10 are housekeeping.

## Lead disposition

- M1 is valid documentation drift while the portable-files implementation is in progress. Its required completion documentation will distinguish iOS Share from Android SAF and record actual proof status.
- M2 is pre-existing README preset-list drift and is outside this preservation change; retained here, not silently treated as fixed.
- M3 was the known transient catalog CI-step integration issue. Commit `03eb286` supplied its scripts/package entry before the next push; Android compile passed in PR run `38072353092`. This audit alone did not verify CI.
- L1's merged-package check has subsequently passed in the catalog owner's APK7 inspection; physical OEM transfer behavior is still unproven. L2 remains a native acceptance follow-up until the separate final-source recovery proof. L3 belongs to the preservation completion wording.
- L7 is not a required repair: current Agentic Research analytical artifacts follow their own frontmatter contract; do not impose legacy brief fields solely for audit uniformity. Other low/informational observations remain report findings, not added scope.
- The knowledge index is regenerated from source frontmatter; two pre-existing decision-count warnings are informational. No product feature is marked complete by this documentation verdict.

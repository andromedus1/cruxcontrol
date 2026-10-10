# Documentation review — 2026-10-10

**Project:** CruxControl · **Date:** 2026-10-10 · **Snapshot:** committed HEAD `8e85ecd` (uncommitted tree not audited; untracked `docs/kilter_docs/` and `docs/set_boulders/` excluded)

**Documents reviewed:** 5 system docs (VISION, SPEC, ARCHITECTURE, PRINCIPLES, DEPLOY) + 0 module docs. Re-verified: the knowledge index lists 30 docs and matches disk (5 planning, 24 research, 1 historical), and every `updated` value matches frontmatter.

**Also checked:** `AGENTS.md`/`CLAUDE.md`, `.agents/rules`, `CONVENTIONS`, `README.md`, `prototypes/ios/README.md`, the active preservation items.

**Passes:** 1 system pass; no module passes.

**Issues found:** Critical 0 · High 0 · Medium 3 · Low 10 · Info 10


## Parent adjudication

Independent Claude Opus job `20261010T175954Z-98bdbac3` supplied the read-only
system audit below at committed snapshot `8e85ecd`. The parent consumed the
terminal result. No Critical or High finding requires a foundation fix loop.
This is documentation review, not acceptance of the separately reviewed portable
feature: that feature has required code/evidence fixes in progress.

- DM2 is corrected in the accompanying root README update using the verified
  catalog result; it does not claim phone/board or online-recovery acceptance.
- DM3 and DL1 are assigned to the portable feature's current review follow-up.
- The native import proof used actual SAF-exported bytes injected into the HTML
  file input by the harness; actual Android chooser import belongs to parity.
- DL3 belongs to the parity implementation. Remaining Medium/Low findings are
  recorded as non-blocking drift; no broad documentation cleanup is implied.
- The separate portable reviewer identified missing grade coverage in the original
  synthetic fixture. Existing exact-equality results establish preservation of
  that fixture, not native grade roundtrip. The portable follow-up must add this
  proof and correct overstated evidence claims.

### Pass 1: System-level

#### Critical (0) / High (0)

None. No foundation doc claims physical-phone, Fullride, cloud or online-recovery acceptance.

#### Medium (3)

**DM1. README preset list is stale** (carried from the prior report; still present)
- **Files:** `README.md:45-47` vs `LightEffectsPanel.tsx:63`, `SPEC.md:134-145`
- **What:** README lists Frogger and omits Fireflies, Shooting Stars, Jellyfish and Embers. The picker filters out Frogger.
- **Fix:** list the 14 pickable presets and note that Frogger is kept only for saved recipes.

**DM2. README says the Android catalog still needs its packaged proof**
- **Files:** `README.md:9` vs `SPEC.md:105-109`, `ARCHITECTURE.md:79-84`, `VISION.md:60-63`
- **What:** the foundation docs say the private APK passed isolated emulator catalog checks. README predates that proof.
- **Fix:** match the foundation wording (emulator-proven, private, not physical parity).

**DM3. Prototype README describes removed behaviour of `smoke-android.mjs`**
- **Files:** `prototypes/ios/README.md:80-89` vs `smoke-android.mjs` after `492ddf1`
- **What:** the README says the runner captures the cache export "before dismissing the native chooser" and leaves destination delivery to portable-files. Since `492ddf1`, the runner saves through the SAF picker into Downloads and reads the provider-written file. It also injects its import with `DataTransfer` (`:279`).
- **Fix:** describe the SAF save and readback, and state the injected import.

#### Low (10)

- **DL1. Portable-files item overclaims coverage.** `:164-170` and `:185-187` vs `runtime.ts` and Capacitor's restored-result routing. See feature finding F1. `SPEC.md:397-399` and `ARCHITECTURE.md:316-319` are accurate.
- **DL2. Restore wording doesn't name the injected import.** `SPEC.md:399-402`, `ARCHITECTURE.md:319-321`, `VISION.md:52-53`, the prototype README portable section and item `:194-198` say "restored offline" without saying the import used harness `DataTransfer` injection (`smoke-android-portable.mjs:478`). The wording is accurate but imprecise. The physical import picker belongs to parity.
- **DL3. Parity item names the wrong Android delivery path.** `epic-library-preservation-android-parity.md:95-97` says to reuse "the verified filesystem/share path from portable-files; retain its URI lifetime". On Android the verified path is the SAF `LibraryBackupFile` plugin, and Share-only delivery was rejected for Android (portable-files `:73-75`).
- **DL4. "Sync Engine" is not a module.** `ARCHITECTURE.md:186` names it, but the module map has none. The decision at `:38` ("separate incremental shared_syncs module") also sits awkwardly with `SPEC.md:204-215`, which treats `shared_syncs` as legacy reference material. (Carried over.)
- **DL5. Stale § numbers and tag claim in work items.** `epic-logbook.md:41,47`, `epic-catalog-sync.md:50`, `epic-foundation.md:87`, `epic-foundation-scaffold.md:44`, `epic-foundation-sqlite-readpath.md:44`, backlog `epic-grade-prediction.md:61`, `epic-recommendations.md:49`. (Carried over.)
- **DL6. 6 of 213 relative links are broken.** `.research/briefs/cloudflare-deploy/parent.md:33`; backlog `epic-grade-prediction.md:34,44`; `epic-recommendations.md:37` (one `../` too many); historical `north-star.md:162-163`. (Carried over.)
- **DL7. Stale stage text in the preservation epic.** `epic-library-preservation.md:131` says "remains at drafting" while frontmatter is `stage: implementing`. `native-backup-service-costs` is cited at `:194` but missing from `research_refs`. (Carried over.)
- **DL8. Dangling path in AGENTS.md.** `AGENTS.md:24` points to `.agents/skills/patterns/`, which does not exist. (Carried over.)
- **DL9. Wording that understates or quotes old copy.**
  - `README.md:23` says "Download" (web wording).
  - `README.md:124-126` says off-device recovery is not established; the portable proof now covers off-device file readback and isolated restore.
  - `prototypes/ios/README.md:361` quotes the pre-`492ddf1` iOS success copy.
- **DL10. Content in the wrong place or duplicated.**
  - The SPEC backup bullet (`:383-411`) repeats the catalog-APK statement from `:105-109`.
  - ARCHITECTURE's "Intended shared-library boundary" (`:276-332`) holds current native runtime, logging and backup-delivery facts.
  - Module 11 (`:206-218`) omits delivery.

#### Info (10)

1. There is no roadmap and there are no module docs; the roadmap checks were mapped onto `.work` items.
2. System docs use `type: planning`, which is outside the skill's example list but used consistently.
3. `research_method` is absent from 5 ARD analyses. That is their own schema, not a defect.
4. Landscapes are indexed as `research-analysis` (the generator normalises them). `campaign.md` is a `program-report` produced by `/deep-research`.
5. ARCHITECTURE and SPEC each carry 15 decisions, above the guidance of 12.
6. Key Dependencies omits Filesystem 8.1.4, Share 8.0.3 and the in-repo SAF plugin. This is an omission, not drift.
7. DEPLOY matches `ci.yml`: the `web` check, `needs: [web]`, and `ENABLE_DEPLOY`. The other lanes are not required checks.
8. HEAD moved to `8e85ecd` during the audit.
9. Root `MIGRATION_REPORT.md` and the prior report are historical context only.
10. CI and physical claims were not independently verified.

**Resolved since the prior report:**
- M1: ARCHITECTURE now separates iOS Share from Android SAF (`:311-325`).
- L1: merged-manifest inspection is now recorded (`:261-264`).
- L2: closed by the final-source native run; native-library is done.
- L3: the daily-use gate is now stated in all four foundation docs.
- M3: excluded, as instructed (fixed by `03eb286`).
- L7: reclassified as Info.
- L10: now DM3.

### Clean areas

- The five docs agree on Fullride-first scope, local authority, and the platform storage split.
- They agree that native storage is not independent recovery.
- They agree on the online gate before real authoring, with portable files as a second path.
- No backup provider is selected (matches the private-vault item).
- The catalog is described as an older snapshot.
- Code checks passed: 127/20 capacity, 180 ms debounce, 25-row pages, prompt-mode PWA settings, `loggingBehavior: "none"`, `ACTION_CREATE_DOCUMENT`, WAL/FULL.
- The work graph is clean: 145 items and 176 graph references, 0 unresolved; 10 `research_refs`, 0 unresolved.

### Blocking-brief status

| Brief | Blocks | Exists on disk | Blocked item stage |
|---|---|---|---|
| `.research/briefs/cloudflare-deploy/parent.md` | epic-foundation-ci-deploy | Yes | done |
| `docs/briefs/board-control-web-bluetooth.md` | epic-board-control | Yes | done |
| `docs/briefs/board-rendering-and-filtering.md` | epic-climb-browser | Yes | done |
| `docs/briefs/catalog-sync-api.md` | epic-catalog-sync | Yes | drafting |
| `docs/briefs/foundation-pwa-sqlite.md` | epic-foundation | Yes | implementing |
| `docs/briefs/recommendations-and-training.md` | epic-recommendations | Yes | drafting (backlog) |
| `.research/briefs/kilter-grade-prediction/parent.md` | epic-grade-prediction | Yes | drafting (backlog) |

### DONE output verification

All checked outputs exist. The 9 done items:
- **Foundation (6):** scaffold, pwa-shell, ci-deploy, verify-worker-build, sqlite-readpath, catalog-bootstrap.
- **iOS bridge (2):** native-ble, backup-export.
- **Preservation (1):** native-library.

Files checked include `web/package.json`, `vite.config.ts`, `ci.yml`, `wrangler.jsonc`, `check-pwa-build.mjs`, `web/src/data/{sqlite,catalog}`, `catalog/manifest.json`, `catalog-bootstrap.spec.ts`, `native-ble-transport.ts`, `native-backup-delivery.ts`, `native-library.ts`, `open-native-library.ts`, the Android manifest and backup XML, `smoke-android.mjs` and the fixture. Portable-files is at review and is not claimed as done.

### Provenance summary (22 docs: 21 briefs + 1 program report)

| research_method | Docs | Latest updated |
|---|---|---|
| /research-program | 0 | — |
| /deep-research | 8 | 2026-06-14 |
| /research | 2 | 2026-10-10 |
| /brief | 5 | 2026-06-14 |
| hand-written | 0 | — |
| migrated | 2 | 2026-08-02 |
| (missing; ARD analyses) | 5 | 2026-10-09 |

**Refresh candidates** (`/brief` docs dated before 2026-06-14, informational only): `docs/briefs/` board-control-web-bluetooth, board-rendering-and-filtering, catalog-sync-api, recommendations-and-training.

### Limitations

- This was a read-only, single-reviewer pass without sub-agents. There was no fix loop and no index regeneration.
- No broad lint of research content; attestation files were not link-checked.
- The private directories were excluded.
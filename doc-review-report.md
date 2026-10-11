# Documentation review — 2026-10-10

**Project:** CruxControl
**Snapshot:** HEAD `7646803` plus the explicitly reviewed working-tree updates to VISION and generated knowledge indexes. The audit also read the final SPEC, private-vault evidence and proof implementation now included in that HEAD. This is a working-tree audit, not clean-commit or release acceptance.
**Documents reviewed:** 5 system foundations + 0 module documents; additionally 3 READMEs and 2 project instruction files.
**Passes:** 1 independently delegated full system pass; dynamic discovery found no module planning sets.
**Issues found:** **Critical 0 · High 0 · Medium 1 · Low 4 · Info 2**.

## Scope and method

Read VISION, SPEC, ARCHITECTURE, PRINCIPLES, DEPLOY, root README, the iOS/Android prototype README, the Firebase-vault README, AGENTS/CLAUDE, project rules and conventions, the knowledge index, milestone priorities, and relevant preservation work. Checked source contracts and named output files proportionately. The current vault feature remains `stage: drafting`; proof completion is not feature completion.

Read the doc-review skill and its build-process reference. The five current foundations all have nonempty description, type and updated frontmatter: **5/5 compliant with the project's `type: planning` schema**. The historical north star is explicitly superseded and is not a module. No `docs/*/architecture/north-star-*.md` or module documentation sets were discovered. Research content and source attestations were not substantively re-audited.

Excluded unrelated untracked `docs/kilter_docs/` and `docs/set_boulders/`. No phone, authored library, cloud resource or account was changed by this review. No external research or live-provider rerun was performed. Report findings below are current observations, not a carry-forward of the previous report.

## Pass 1: System-level

### Critical (0) / High (0)

None. No reviewed production contract admits real authoring based only on the prototype. The automatic-protection and integrated clean-install recovery gate is consistent across the foundations and current work.

### Medium (1)

**M1. Screenshot-import persistence wording still assumes IndexedDB.**

**Files:** `docs/ARCHITECTURE.md:419–422`; compare its Data Layer and storage conventions, `web/src/screenshot-import/import-batch.ts:47–92`, and `prototypes/ios/src/native-library.ts`.

**What:** The image-minimizing-import convention ends with “only the confirmed climb aggregate reaches IndexedDB.” The importer actually writes through the injected `LocalDraftRepository`; Android persists those aggregates in native SQLite. The surrounding architecture correctly describes the platform split, so this is a stale implementation noun, not a disputed storage contract.

**Suggested fix:** Say the confirmed aggregate reaches the platform-local climb repository; qualify IndexedDB as the web/iOS implementation if useful.

### Low (4)

**L1. Root README's illustrative preset list obscures picker versus retained recipes.**

**Files:** `README.md:45–52`; `web/src/route-editor/LightEffectsPanel.tsx:63`; `docs/ARCHITECTURE.md` Route Editor.

**What:** The README includes Frogger but omits Fireflies, Shooting Stars, Jellyfish and Embers. Saving/editing existing Frogger recipes is supported, so its wording is not a false capability claim. It is nevertheless a poor guide to the current fourteen-choice picker, which excludes Frogger.

**Suggested fix:** Describe the current picker options and explicitly distinguish retained Frogger recipes.

**L2. Future provider sync has inconsistent naming and specificity.**

**Files:** `docs/ARCHITECTURE.md:38,185–186`; `docs/SPEC.md:204–215`.

**What:** Architecture calls sync a separate incremental `shared_syncs` module and references “Sync Engine,” without a corresponding named module-map entry. SPEC correctly treats those timestamps as legacy protocol reference until current provider access and semantics are established. The intended future capability is consistent; the architecture label implies a more settled mechanism than the contract supports.

**Suggested fix:** Name the future provider-sync boundary consistently and retain its conditional legacy-protocol status.

**L3. Native preservation details sit under shared-library flow and repeat catalog evidence.**

**Files:** `docs/ARCHITECTURE.md` “Intended shared-library boundary” and “Library Backup & Recovery”; `docs/SPEC.md` whole-library backup bullet versus Climb Browser.

**What:** Current native storage, logging and file-delivery details occupy the intended collaboration subsection despite private preservation being an independent boundary. SPEC repeats the Android catalog proof inside backup capability prose. The facts are compatible, but ownership makes later updates prone to drift.

**Suggested fix:** Group current native preservation facts with the preservation boundary and link to the catalog evidence rather than repeating it.

**L4. Project instruction files reference an absent patterns directory.**

**Files:** `AGENTS.md:24`, `CLAUDE.md:24`.

**What:** Both direct readers to `.agents/skills/patterns/`; that directory is absent. No task currently depends on it.

**Suggested fix:** Make the reference conditional on pattern-library existence or create it only when actual reusable patterns warrant it.

### Info (2)

1. The project deliberately owns delivery state in `.work/`, not a standalone roadmap. Phase/brief/DONE checks below therefore use the work substrate. Five system foundations and zero module documentation sets are the complete current planning inventory.
2. Five indexed ARD briefs omit `research_method`; they use their own analytical schema. This is provenance inventory, not a request to backfill or rewrite the research corpus. The existing index's two decision-count warnings are informational and do not invalidate the current contracts.

## Clean areas and supporting checks

- **Current proof versus product:** VISION and ARCHITECTURE summaries and body, SPEC, both prototype READMEs, and the private-vault current checkpoint distinguish bounded synthetic native upload/readback and operator-assisted recovery from automatic production backup, revision acknowledgement and integrated account/restore UI. The owning feature stays drafting and real authoring is not admitted.
- **Actual recovery boundary:** The vault feature's final live-evidence section records eight climbs/three playlists restored through actual Android DocumentsUI into a separate signed-in installation and matched again after cold restart. Operator transfer of downloaded cloud bytes is explicit. No claim of an integrated cloud restore UI follows from this evidence.
- **Large-download boundary:** `NativeAuthProofPlugin.java` streams successful GETs to a private cache file using bounded chunks, incremental SHA-256 and file sync; only metadata crosses the bridge. `android-auth-proof.mjs` extracts and validates that file. READMEs and the feature accurately distinguish the initial 25 MiB heap failure from SignedProof19's exact-byte pass, and identify ADB extraction as proof tooling. The padded fixture is not maximum-record-count restore acceptance.
- **Service boundary:** `gateway/index.mjs` verifies Firebase tokens with revocation checks; `handler.mjs` admits the configured owner; `gcs-store.mjs` uses generation-zero create, generation-pinned CRC-validated reads and readback before acknowledgement. `verify-live-storage.mjs` tests competing creates, denied overwrite/delete and another genuine identity, with cleanup of temporary identity/grant. Documentation separates the unresolved direct-Storage emulator race from the live authenticated-service proof.
- **Cost and deployment:** Firebase README identifies enabled billing and a $5 alert budget as notifications, not a cap; its illustrative cost is not measured spending. `gateway/settings.mjs` matches the stated runtime limits. DEPLOY matches `.github/workflows/ci.yml`: main-push, `ENABLE_DEPLOY`, and `needs: [web]`. This review does not independently establish current hosted deployment or billing state.
- **Local contracts:** `open-native-library.ts` requests WAL/FULL; native `readSnapshot` exists; web/iOS versus Android authority, missing-only restore, ordered memberships and manual portable recovery are consistently distinguished from independent automatic protection.
- **Existing app behavior:** Source checks confirm 127 static lights, 20 animated lights at 2 FPS and 20 ms pacing in `capacity-policy.ts`; 180 ms lighting debounce; 25-row catalog pages; and prompt-mode PWA configuration with injected registration disabled, `skipWaiting: false`, `clientsClaim: false`.
- **Knowledge and links:** All 30 indexed paths exist, and indexed updated dates match source frontmatter. The five foundations plus three READMEs and AGENTS/CLAUDE have no broken relative Markdown file targets. Inline-code directory references are separate; L4 records the missing patterns path. Excluded private directories were not traversed.

## Blocking briefs status

No missing NEXT-work blocking brief was found. Research selection and production design admission remain work-item decisions, not implied by file existence.

| Brief | Owning work | Exists | Current state |
|---|---|---|---|
| `.research/briefs/cloudflare-deploy/parent.md` | foundation CI deploy | Yes | Done |
| `docs/briefs/board-control-web-bluetooth.md` | board control | Yes | Archived completed scope |
| `docs/briefs/board-rendering-and-filtering.md` | climb browser | Yes | Archived completed scope |
| `docs/briefs/catalog-sync-api.md` | catalog sync | Yes | Drafting |
| `docs/briefs/foundation-pwa-sqlite.md` | foundation | Yes | Epic implementing; six features done |
| `docs/briefs/recommendations-and-training.md` | recommendations | Yes | Backlog |
| `.research/briefs/kilter-grade-prediction/parent.md` | grade prediction | Yes | Backlog |
| `.research/analysis/briefs/independent-library-preservation.md` | private preservation | Yes | Referenced by current vault work |
| `.research/analysis/briefs/native-backup-service-costs.md` | private vault | Yes | Referenced by current vault work |

## DONE output verification

`work-view --stage done` lists **11 current done features**. Named implementation and verification files exist; this is output-existence verification, not rerunning all historical acceptance tests.

| Scope | Done features | Representative outputs checked | Result |
|---|---:|---|---|
| Foundation | 6 | `web/package.json`, `web/vite.config.ts`, `.github/workflows/ci.yml`, `web/wrangler.jsonc`, `web/scripts/check-pwa-build.mjs`, `web/src/data/sqlite/catalog.worker.ts`, `web/src/data/catalog/bootstrap.ts`, `web/e2e/catalog-bootstrap.spec.ts` | Present |
| iOS bridge | 2 | `native-ble-transport.ts`, `native-backup-delivery.ts` and tests under `prototypes/ios/src/` | Present |
| Native library | 1 | `native-library.ts`, `open-native-library.ts`, tests and Android manifest/backup resources | Present |
| Portable files | 1 | `android-backup-delivery.ts`, native SAF plugin, `smoke-android-portable.mjs` | Present |
| Android catalog | 1 | Catalog packaging scripts, `smoke-android-catalog.mjs`, catalog integration | Present |

Android parity and private vault remain unfinished; neither is included in these done counts. Physical-board and phone acceptance remain separate.

## Provenance summary

The indexed corpus contains 30 documents: 5 planning, 24 research, 1 historical. The following inventory covers 21 briefs plus 1 program report; the two landscapes are excluded from this tool-tier calculation.

| research_method | Documents | Latest updated |
|---|---:|---|
| `/research-program` | 0 | — |
| `/deep-research` | 8 | 2026-06-14 |
| `/research` | 2 | 2026-10-10 |
| `/brief` | 5 | 2026-06-14 |
| `hand-written` | 0 | — |
| `migrated` | 2 | 2026-08-02 |
| Missing, ARD schema | 5 | 2026-10-09 |

### Refresh candidates

Highest recorded tool tier is `/deep-research`, latest 2026-06-14. Four lower-tier briefs predate that date: `board-control-web-bluetooth`, `board-rendering-and-filtering`, `catalog-sync-api`, and `recommendations-and-training`, all under `docs/briefs/`. This is the skill's date/tier heuristic, not evidence that new research would change a current decision.

## Review boundary

This delegated pass wrote only this report. No C/H fixes were needed or made during the pass. Source updates were completed by the driving agents before final assessment. No additional reviewer was spawned by this worker. The parent owns index regeneration, adjudication, commits and any required workflow exit audit. No application tests, live account access or physical-device checks were rerun merely for this documentation audit; runtime outcomes above are attributed to the durable feature evidence, with implementation support checked directly.

# Doc Review Report

**Project:** CruxControl
**Date:** 2026-10-18
**Scope:** Fresh independent `--system-only` audit after preservation documentation updates.
**Passes:** 1 system pass; 0 module passes (requested scope).
**Issues:** Critical **0**, High **0**, Medium **1**, Low **0**, Info **0**.
**Exit result:** The doc-review Critical/High exit condition is satisfied. This is not feature approval or permission to update the phone.

## Inventory and method

Reviewed the five current foundation/runbook documents (`docs/VISION.md`, `SPEC.md`, `ARCHITECTURE.md`, `PRINCIPLES.md`, `DEPLOY.md`), `AGENTS.md`, `CLAUDE.md`, `.agents/rules/agile-workflow.md`, `.work/CONVENTIONS.md`, `prototypes/ios/README.md`, and the relevant private-vault README overview. Used the knowledge indexes, saved roadmap priorities, preservation epic and owning Android parity/automatic-backup/catalog items as delivery context. Read the doc-review skill and its build-process reference.

The current index contains five planning documents, 24 research entries and one explicitly historical document. No separate module planning documents were discovered under `docs/*/architecture/` or `modules/*/docs/`; detailed module designs are intentionally owned by `.work/` bodies, as ARCHITECTURE states. This system-only request does not require creating module documents or auditing research contents.

All five current planning documents have nonempty description, type, and updated metadata. Their `type: planning` is the repository's established indexed schema; the generic skill's older type examples are not grounds to rewrite it. Rules and operational prototype READMEs are not indexable planning documents. All 30 indexed paths exist. Checked local Markdown link targets in the five foundation docs, AGENTS, CLAUDE and native prototype README: no missing file targets found. Anchor semantics and external URLs were not exhaustively validated.

## Findings

### Critical (0)

None.

### High (0)

None. No missing implementation output or missing decision-blocking research artifact was found.

### Medium (1): Current summary text still describes physical parity as pending

**Evidence:** `.work/active/epics/epic-library-preservation.md:396–399` says physical phone/Fullride acceptance remains open; its current-delivery paragraph at lines 436–438 still asks for remaining board-scenario results. `prototypes/firebase-vault/README.md:21` likewise says physical owner-phone/Fullride parity remains open. The owning parity item's later confirmation at `.work/active/features/epic-library-preservation-android-parity.md:613–620` records the six owner-confirmed remaining scenarios and advances to review. The updated system account is explicit in `docs/ARCHITECTURE.md:278–284` and `prototypes/ios/README.md:407–419`.

**Impact:** These summaries send a reader back to already completed broad physical acceptance. They do not claim premature completion or weaken the outstanding review/delivery gates, so this is stale status text rather than a release-blocking contradiction.

**Suggested correction:** Update only the current epic summary and vault overview to distinguish passed owner-observed scenarios from pending feature review/final delivery. Keep catalog-specific playlist lighting, Trash/restore and angle-change evidence limitations, and physical iPhone acceptance, explicit. Preserve dated earlier execution entries as evidence history. No changes made by this reviewer.

**Host disposition:** Corrected the current epic summaries in `c774a25` and the
vault README in `d764d8b`, retaining the listed evidence limits. This Medium finding
did not require another audit under the Critical/High loop policy. The fresh audit
above supplied the required zero Critical/High result; this disposition is not a
new independent pass.

## Clean areas

- Vision owns product intent, specification owns capabilities, architecture owns boundaries, principles own durable rules, deployment owns the operator runbook, and `.work/` owns decomposition and delivery state. No additional planning artifact is needed.
- Android SQLite and web/iOS IndexedDB responsibilities agree across docs and runtime composition. Native local storage is consistently distinguished from independent off-device recovery.
- Manual portable exports, atomic Android restore, web/iOS per-store outcomes, automatic foreground backup, immutable retained copies and recovery verification are described consistently. The preservation rule requiring a fresh outside-Git maintenance backup does not promise automatic portable files.
- Foundation docs and the native README preserve the exact distinction between owner observations, synthetic emulator proof and physical iPhone work. They do not invent catalog-specific playlist lighting, Trash/restore or angle-change physical evidence.
- Review and final delivery remain gates. The editor Back/autosave race is tracked separately; source verification here does not claim that its fix is present in the installed APK.
- Catalog freshness/current official coverage/public redistribution remain unproven. The current name/exact-grade/angle browser contract matches this worktree; filters being implemented on another branch were excluded.
- Invited collaboration, physical iPhone control, logbook and ML remain future or separately gated work. Independent private backup does not grant group access.
- DEPLOY's push-to-main, `ENABLE_DEPLOY`, `needs: [web]`, static Worker build and named web check match `.github/workflows/ci.yml`. No live hosting or account state was accessed or inferred.

## Blocking brief existence

There is no phase-numbered roadmap with a literal Blocking briefs list. Checked the decision-bearing references used by the current owning items instead.

| Artifact | Decision | Exists |
|---|---|---|
| `.research/analysis/briefs/independent-library-preservation.md` | Native storage and independent recovery boundary | Yes |
| `.research/analysis/briefs/native-backup-service-costs.md` | Private backup provider/cost selection | Yes |
| `.research/analysis/briefs/android-chrome-recovery-access.md` | Preservation/recovery constraints | Yes |
| `.research/analysis/briefs/ios-shared-client.md` | Shared native client proof | Yes |
| `.research/analysis/briefs/invited-offline-library.md` | Conditional invited-service boundary | Yes |
| `.research/analysis/landscapes/ios-board-client-prior-art.md` | iPhone controller prior art | Yes |
| `.research/briefs/cloudflare-deploy/parent.md` | Static deployment approach | Yes |

No NEXT-work blocker was represented as written while absent. Existing physical/review gates are evidence requirements, not missing research documents.

## Implemented-output verification

No numbered DONE phases occur in the system docs. Verified the principal implemented claims and relevant done features by source/output existence and selected code inspection; did not rerun acceptance or CI.

| Claimed implementation | Source/output present | Relevant verification sources present |
|---|---|---|
| Native SQLite library and recovery | `prototypes/ios/src/native-library.ts`, `open-native-library.ts`; WAL/FULL pragmas present | Native library/open-library tests |
| Portable whole-library recovery | `web/src/library-backup/{service,codec}.ts`; native Android/iOS delivery adapters | Backup service/codec/delivery tests; `web/e2e/library-backup.spec.ts` |
| Foreground automatic protection and recovery UI | `web/src/automatic-backup/{coordinator,state}.ts`, `BackupManageDialog.tsx`, `BackupStatusLine.tsx`; composed only on Android in native runtime | Coordinator/state/surface tests and Android synthetic smoke scripts |
| Backup scheduling contract | Coordinator constants are 30-second coalescing, 60-second maximum, 5/15/60-second retry | Coordinator tests |
| Native transport and platform lifecycle | Native BLE transport and `prototypes/ios/src/runtime.ts`; pause disconnect/foreground transitions and native entry present | Native BLE/runtime tests |
| Older installed catalog and worker query | Catalog install/receipt/worker/query modules and private package scripts | Catalog package contracts, catalog browser/bootstrap tests and Android smoke scripts |
| PWA update admission | `web/src/pwa/update-service.ts` | Unit tests and `web/e2e/pwa-update.spec.ts` |

The source tree includes the expected outputs. A passing source-existence check does not independently re-establish live deployment, physical acceptance or CI results; those remain attributable to the owning records.

## Provenance summary

Metadata-only inventory of frontmatter-declared brief/program/campaign documents; research content was not audited.

| research_method | Count | Latest updated |
|---|---:|---|
| `/deep-research` | 8 | 2026-06-14 |
| `/research` | 2 | 2026-10-10 |
| `/brief` | 5 | 2026-06-14 |
| `migrated` | 2 | 2026-08-02 |
| Missing literal field | 5 | 2026-10-09 |

Missing literal method fields occur in newer ARD briefs; ARD uses its own provenance/engagement schema, so this inventory does not assert absence of provenance. Highest literal tool tier is `/deep-research`. Four older `/brief` entries are mechanical refresh candidates (updated 2026-06-13): board-control-web-bluetooth, board-rendering-and-filtering, catalog-sync-api, recommendations-and-training. This is informational metadata ordering, not evidence that those briefs need refreshing for this delivery.

## Review boundary

Read-only source/doc inspection on `codex/library-preservation`; HEAD observed as `790915f` while the host continued its authorized fix work. The reviewed foundation changes include the Android evidence update originally reported as `53a4569`. Host-owned index and race-fix changes were present and were not edited. No device, cloud, secrets or private-library evidence was accessed, and no commands were run to publish, install or mutate operational state. This report is the only reviewer-written file. No commit was created.

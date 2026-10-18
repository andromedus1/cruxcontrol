# Doc Review Report

**Project:** CruxControl  
**Date:** 2026-10-18  
**Source:** `codex/kilter-catalog-filters`, HEAD `8d6f588` (documentation correction `225a78b` included); regenerated knowledge indexes present as working-tree changes.  
**Mode:** Fresh independently dispatched `research-pipeline:doc-review --system-only` audit.  
**Documents reviewed:** Five system foundations (`docs/SPEC.md`, `docs/ARCHITECTURE.md`, `docs/VISION.md`, `docs/PRINCIPLES.md`, `docs/DEPLOY.md`), `AGENTS.md` and its `CLAUDE.md` symlink; two supporting source READMEs (`prototypes/ios/README.md`, `prototypes/firebase-vault/README.md`). Nine named entry points, eight distinct files.  
**Passes run:** One system pass; no module audit requested.  
**Issues found:** **Critical 0 / High 0 / Medium 0 / Low 0 / Info 0.**

## Pass 1: System-Level

### Critical (0)

None.

### High (0)

None.

### Medium (0)

None.

### Low (0)

None.

### Info (0)

None. Evidence limitations and provenance observations below are audit context, not findings.

## Evidence and clean areas

- **Document ownership and priorities agree.** VISION owns product rationale; SPEC owns capabilities; ARCHITECTURE owns boundaries and flows; PRINCIPLES owns durable constraints; DEPLOY owns deployment and live-resource maintenance. Delivery decomposition stays in `.work/`. Catalog Android/web work remains independent of physical iPhone acceptance; invited-service implementation still requires the iPhone path. Future logbook, ML and collaboration are not claimed delivered.
- **Metadata and index agree.** All five system foundations have nonempty descriptions, `type: planning`, `kind: planning`, and current `updated` dates. This is the established project schema reflected by its schema-v2 index, rather than a reason to replace types with generic skill examples. All 30 indexed file targets exist. The two supporting READMEs and the agent instruction alias are not additional indexable foundations.
- **Cross-references resolve.** Checked local Markdown file targets across the eight distinct documents: no missing targets. The preservation epic and Android-parity references resolve to bodyless archive stubs. Their `git_ref: b612e3f` retains full evidence in Git; reading `git show b612e3f:.work/active/epics/epic-library-preservation.md` confirms the aggregate independent review, required-CI evidence, six completed child features and separately pending PR delivery. Bodyless retention is intentional under `.work/CONVENTIONS.md`.
- **Preservation readiness is qualified consistently.** SPEC, VISION, ARCHITECTURE and both native/vault READMEs distinguish synthetic emulator recovery from owner-observed Android/Fullride evidence. They preserve the physical iPhone gap and lack of scenario-specific physical evidence for catalog playlist lighting, Trash/restore and angle changes. Review completion and required-CI success describe reviewed implementation; merge/delivery remain separate. No source-completion statement proves the currently installed phone binary.
- **Live backup resources are protected by the runbooks.** DEPLOY's live-resource section and the vault README explicitly identify proof-named infrastructure as holding real `library-v1` backups, prohibit destructive prototype cleanup and require verified migration plus endpoint changes before retirement. The compiled endpoint in `prototypes/ios/android/app/src/main/java/io/github/andromedus1/cruxcontrol/prototype/NativeAccountSession.java:48` supports that warning. Both documents warn that ignored local signing/configuration directories are vulnerable to Git cleanup; owner exports and signing recovery material belong outside the checkout.
- **Catalog filtering matches source.** `web/src/data/catalog/kilter-catalog.ts` defines 25-row default pages, a 250-candidate bound, cursor v2, normalized combined filters, rounded display-grade ordering and stable UUID ties. `CatalogBrowser.tsx` and `CatalogFilterDialog.tsx` split committed and draft state. `web/src/catalog/CatalogBrowser.test.tsx:208` contains the native Back regression covering draft discard, preserved underlying selection and focus return. Freshness, public binary distribution and personal-history filter limits remain explicit.
- **Platform storage and recovery contracts match source.** Android uses a shared native SQLite library with a preserving v1-to-v2 migration and transactional snapshots (`prototypes/ios/src/native-library.ts`). PWA/iOS remain on separate IndexedDB repositories. `web/src/automatic-backup/coordinator.ts:29` defines 30-second coalescing, a 60-second maximum wait and 5/15/60-second retries. `prototypes/firebase-vault/gateway/contract.mjs` defines 512 application slots; bounded immutable retention and visible capacity pause are documented without promising pruning or background Android execution. AndroidManifest declares OS backup exclusions.
- **Static delivery and PWA admission agree with configuration.** `.github/workflows/ci.yml` gates Cloudflare deployment on successful `web`, main push and `ENABLE_DEPLOY=true`, matching DEPLOY. `web/vite.config.ts` disables injected registration, `skipWaiting` and `clientsClaim`, matching explicit waiting-worker admission. Static PWA deployment and Android private-backup infrastructure remain distinct.

## Blocking briefs status

The system foundations contain no numbered NEXT-phase roadmap or claim that an unwritten brief is complete. Delivery sequencing belongs to work items. Relevant established blocking-brief references are present:

| Brief | Work scope | Exists on disk? | Status |
|---|---|---|---|
| `docs/briefs/foundation-pwa-sqlite.md` | Foundation | Yes | Written research reference |
| `.research/briefs/cloudflare-deploy/parent.md` | Foundation CI/deploy | Yes | Written research reference |
| `docs/briefs/board-control-web-bluetooth.md` | Board control | Yes | Written research reference |
| `docs/briefs/board-rendering-and-filtering.md` | Climb browser | Yes | Written research reference |
| `.research/analysis/briefs/independent-library-preservation.md` | Library preservation | Yes | Locked research reference |
| `.research/analysis/briefs/ios-shared-client.md` | Shared iPhone client | Yes | Written research reference |

## DONE capability verification

No system foundation owns numbered delivery phases. Present-capability claims were checked against source and retained work evidence:

| Capability claim | Expected output | Evidence |
|---|---|---|
| Reviewed preservation implementation | Archived epic and six reviewed features, recoverable review evidence | Archive stubs exist with `git_ref: b612e3f`; full epic aggregate review inspected in Git |
| Android native persistence and recovery | Native library, backup/recovery coordinator and bridge | `prototypes/ios/src/native-library.ts`, `web/src/automatic-backup/coordinator.ts`, native vault plugin and gateway contracts exist |
| Catalog combined filtering and safe native Back | SQL adapter, filter sheet and regression coverage | `web/src/data/catalog/kilter-catalog.ts`, `web/src/catalog/CatalogFilterDialog.tsx`, `CatalogBrowser.test.tsx:208` exist and agree with prose |
| Safe PWA updates | Prompt-mode build configuration and app-owned admission | `web/vite.config.ts` and update implementation exist; documented settings match configuration |
| Owner physical acceptance | Qualified operator evidence, not simulated radio proof | Retained review and native README state observations and remaining scenario gaps; physical tests were not rerun by this audit |

## Provenance summary

Informational aggregation from the existing index, not a structural or semantic audit of research artifacts:

| research_method | Brief/report count | Latest updated |
|---|---:|---|
| `/deep-research` | 8 | 2026-06-14 |
| `/research` | 2 | 2026-10-10 |
| `/brief` | 5 | 2026-06-14 |
| `migrated` | 2 | 2026-08-02 |
| Not declared in index | 5 | 2026-10-09 |

The highest represented tier is `/deep-research`. Under the skill's mechanical date/tier heuristic, four `/brief` artifacts dated 2026-06-13 precede the latest deep-research artifact: board control, board rendering/filtering, catalog sync and recommendations/training. This is a refresh-candidate signal only; it does not establish topic overlap, research invalidity or an implementation blocker. Brief metadata corrections and citation review are outside this system-only pass.

## Audit boundary

This pass read repository documentation, configuration, selected source/tests and historical review evidence. It did not execute application tests, independently rerun CI, contact cloud resources, inspect private library contents or operate a phone. CI/review and physical results above are attributed to retained evidence and the driving agent's supplied status. The driving agent reports release31 installation after a fresh full backup; the exact post-update comparison was still in progress at dispatch. This report does **not** claim that comparison passed, nor does it claim PR #32 was merged or physical iPhone acceptance completed.

Only `doc-review-report.md` was written. Source docs, work items and derived indexes were not changed by this reviewer; untracked external-document directories were excluded.

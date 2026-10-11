# Doc Review Report

**Project:** CruxControl
**Date:** 2026-10-11
**Checkpoint:** `fca7fa8af42702ffae0ef4ebcd08b2b02aa8856b` (rolling documentation updates `50297c2`, `6ddcea6`, `fca7fa8`)
**Documents reviewed:** 5 system planning documents + README, two prototype READMEs, and CLAUDE.md supporting rules (9 files); 0 module planning documents across 0 module sets
**Passes run:** 1 fresh native system-level audit; module discovery found no separate planning sets
**Issues found:** Critical 0, High 0, Medium 2, Low 0, Info 0

## Inventory and review scope

The current `docs/knowledge-index.yaml` catalogs 30 documents: five planning,
24 research, and one explicitly superseded historical document. Its five current
planning entries are `docs/VISION.md`, `docs/SPEC.md`, `docs/ARCHITECTURE.md`,
`docs/PRINCIPLES.md`, and `docs/DEPLOY.md`. All five declare nonempty description,
type, kind, and updated fields: 5/5 comply with the project's indexed planning
schema. The project consistently uses `type: planning`; the skill's example
north-star/architecture/roadmap names do not supersede that project convention.
Research-method provenance is audited separately below, without backfilling it.

Module discovery checked the index and tracked documentation paths. There are no
additional current north-star entries, no `docs/*/architecture/` module planning
sets, and no `modules/` directory. `docs/architecture/history/north-star.md` is
superseded historical material, not a module contract. Prototype READMEs are
supporting implementation/operator documentation, not additional module planning
sets. Detailed designs remain owned by `.work/` item bodies.

Read AGENTS.md, `.agents/rules/*.md`, CLAUDE.md, the installed doc-review skill and
its build-process reference. Reviewed the five planning files and the three
READMEs against relevant implementation paths and current delivery evidence.
This fresh audit follows the prior report at `499012a`; it is documentation
alignment, not a repeated independent implementation review. No private evidence
files, cloud resources, owner phone, or unrelated untracked `docs/kilter_docs/`
and `docs/set_boulders/` contents were inspected.

## Pass 1: System-Level

### Critical (0)

None.

### High (0)

None.

### Medium (2)

#### Data-flow network boundary omits the implemented private vault

**Files:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#L421),
[prototypes/ios/src/runtime.ts](prototypes/ios/src/runtime.ts),
[prototypes/ios/src/native-private-vault.ts](prototypes/ios/src/native-private-vault.ts).

**What:** The data-flow conclusion says only provider adapters and controller
transports cross network/device boundaries. Android's implemented private-vault
adapter also crosses both boundaries through native account/file transport. The
preservation section correctly documents that service, but this general boundary
statement retains the earlier architecture and is technically incorrect.

**Fix:** Include private-backup/account adapters in this sentence. Preserve the
intended separation of domain/UI from network/device I/O.

#### Domain aggregate description remains browser-specific

**Files:** [docs/SPEC.md](docs/SPEC.md#L367),
[prototypes/ios/src/native-library.ts](prototypes/ios/src/native-library.ts).

**What:** The domain model describes `LocalClimbDraft` as a browser aggregate.
The same strict domain aggregate is now retained in Android native SQLite; the
nearby milestone and architecture correctly describe platform-local authoring.
The browser-specific definition conflicts with that implemented storage boundary.

**Fix:** Describe it as a platform-local aggregate while retaining its existing
identity, lifecycle, revision, and content contracts.

### Low (0)

None.

### Info (0)

None. Provenance refresh candidates below are informational inventory, not
additional findings.

## Clean Areas

- Vision, specification, architecture, README and prototype status agree that
  foreground automatic backup and integrated recovery are implemented and pass
  synthetic Android emulator acceptance. They retain physical owner-phone/Fullride
  acceptance as an explicit gate before real authored climbs are admitted.
- Earlier portable-file, account, catalog and transport proofs are bounded to the
  paths they exercised. Operator-assisted download/import and padded-byte proofs
  are not presented as integrated recovery or universal structured-memory proof.
- The automatic coordinator's constants match the documented 30-second coalescing,
  60-second maximum wait and 5/15/60-second foreground retry. Android runtime
  composition creates the coordinator and connects pause/resume/network hints;
  PWA and iOS do not acquire that Android account-backup path.
- Native SQLite includes the preserving v1-to-v2 migration, committed aggregate
  revisions, durable pending metadata, coherent capture, atomic missing-only restore
  and persisted verification barrier. The service and native adapter retain exact
  receipt identity; current protected status is tied to the saved revision.
- Capacity matches the private-vault contracts: 512 immutable application copies
  of at most 25 MiB, disjoint legacy 32-copy proof and four synthetic acceptance
  pools, capacity pause and no automatic pruning. GCS creation is conditional;
  readback precedes acknowledgment, and the service exposes no delete/overwrite API.
- Local saving remains available during account/network outages. Recovery conflict,
  cancellation and retained history semantics are consistent with missing-only
  restore, existing local extras and source-copy preservation.
- README and both prototype READMEs maintain the separation between local library
  storage, independent recovery, older offline catalog, future invited sharing,
  and unverified physical-device/iPhone capabilities.
- Deployment documentation matches `.github/workflows/ci.yml`: deploy depends on
  green web CI, push to main and explicit `ENABLE_DEPLOY=true`. Static Cloudflare
  delivery is distinct from the deployed Android vault. No cloud-state revalidation
  or claim of production-library proof was made by this audit.
- Checked all 30 relative Markdown file-link occurrences in the reviewed set;
  every file target exists. Cited research references are checked for path integrity,
  not independently re-researched or semantically reattested.
- The prior architecture ambiguity now explicitly names iPhone evidence and
  invited-sharing service implementation, distinguishing the deployed Android vault.

## Blocking Briefs Status

No roadmap document or NEXT-phase blocking-brief declaration exists in the five
system planning files. Their cited foundation and preservation briefs exist.
The knowledge index's blocking references are also present on disk:

| Brief | Indexed blocking item | Exists on disk? |
|---|---|---|
| `.research/briefs/cloudflare-deploy/parent.md` | `epic-foundation-ci-deploy` | Yes |
| `.research/briefs/kilter-grade-prediction/parent.md` | `epic-grade-prediction` | Yes |
| `docs/briefs/board-control-web-bluetooth.md` | `epic-board-control` | Yes |
| `docs/briefs/board-rendering-and-filtering.md` | `epic-climb-browser` | Yes |
| `docs/briefs/catalog-sync-api.md` | `epic-catalog-sync` | Yes |
| `docs/briefs/foundation-pwa-sqlite.md` | `epic-foundation` | Yes |
| `docs/briefs/recommendations-and-training.md` | `epic-recommendations` | Yes |

Existence is not a claim that older research is current or locked.

## DONE Phase Verification

There is no DONE/NEXT phase table with output declarations in the system planning
set. The following supporting delivery claims were checked against actual paths
and durable item evidence instead; done children do not imply their parent is done.

| Claim / item | Current stage | Output and evidence checked | Result |
|---|---|---|---|
| Native library | done | `prototypes/ios/src/native-library.ts`, `open-native-library.ts`, native tests and item evidence | Present |
| Portable-file recovery | done | `android-backup-delivery.ts`, library backup service, portable proof runner and item evidence | Present |
| Android catalog | done | private catalog packaging/smoke runners, catalog runtime and item evidence | Present; older snapshot/physical limits retained |
| Native private vault | done | native account/file adapter, Android plugins, gateway handler/store and reviewed/CI closure evidence | Present; scheduling/recovery belongs to dependent feature |
| Automatic durable-state child | done | native SQLite migration, revision/control state and atomic recovery implementation/tests | Present |
| Automatic coordinator child | done | `web/src/automatic-backup/coordinator.ts`, status/types/tests and Android composition | Present |
| Automatic surfaces/mobile-status children | done | `BackupStatusLine.tsx`, `BackupManageDialog.tsx`, CSS/tests and mobile acceptance record | Present |
| Integrated acceptance child | done | `.work/active/stories/epic-library-preservation-automatic-backup-acceptance.md`, `smoke-android-automatic.mjs` and `smoke-android-large-recovery.mjs` | Documented complete synthetic acceptance |
| Automatic backup parent | review | Feature's verified implementation section; one independent Claude review and PR CI remain separate closure gates | Correctly not marked done |
| Android parity | implementing | `.work/active/features/epic-library-preservation-android-parity.md` retains physical owner-phone/Fullride boundary | Correctly not marked done |

The integrated acceptance item records automatic edits and list order, offline
restart/reconnection, durable pending-upload process death, and separate
empty-install recovery through Manage. It also records normal UI conflict/cancel
preservation and a 26,178,915-byte final fixture with exactly 10,000 climbs, 1,000
lists and 100,000 memberships, matching canonical contents after relaunch. This
report checks those committed evidence claims and implementation paths; it does
not independently rerun acceptance or read private evidence. Emulator timing is
not physical-phone performance evidence. No owner-phone or real application-pool
operation is implied.

## Provenance Summary

Of 24 indexed research entries, 22 have the skill's eligible provenance types:
21 `brief` and one `program-report`. The two `research-analysis` landscapes are
excluded from these counts, rather than labeled missing research-method briefs.
Counts and dates were recomputed from source frontmatter; no brief was redated,
reclassified or assigned guessed provenance.

| research_method | Eligible artifacts | Latest updated |
|---|---:|---|
| /research-program | 0 | — |
| /deep-research | 8 | 2026-06-14 |
| /research | 2 | 2026-10-10 |
| /brief | 5 | 2026-06-14 |
| hand-written | 0 | — |
| migrated | 2 | 2026-08-02 |
| (missing) | 5 | 2026-10-09 |

The highest explicit tier used is `/deep-research`. The five missing-method
briefs are `android-chrome-recovery-access`, `independent-library-preservation`,
`invited-library-hosting-costs`, `invited-offline-library`, and `ios-shared-client`.
Their provenance is unknown, not inferred from topic or directory.

### Refresh Candidates

Apply both conditions per candidate: its explicit method is lower than the
corpus's highest tier, and its original update predates the latest artifact from
any explicitly higher tier. There are seven candidates. For `/brief` and
`migrated`, the latest higher-tier artifact is the `/research`
`native-backup-service-costs` brief (2026-10-10). This is a recency/tool-tier signal,
not proof that these seven topics need new research. Missing-method briefs cannot
be ranked. No topic-overlap signal or guessed priority is supplied.

| Candidate | research_method | Original updated |
|---|---|---|
| `board-control-web-bluetooth` | /brief | 2026-06-13 |
| `board-rendering-and-filtering` | /brief | 2026-06-13 |
| `catalog-sync-api` | /brief | 2026-06-13 |
| `recommendations-and-training` | /brief | 2026-06-13 |
| `foundation-pwa-sqlite` | /brief | 2026-06-14 |
| `data-model` | migrated | 2026-08-02 |
| `hardware-and-protocol` | migrated | 2026-08-02 |

The prior report's zero-candidate conclusion was incorrect: even comparing only
to the latest highest-tier date (2026-06-14), four `/brief` entries are dated
2026-06-13. Counting all 24 research entries as eligible also overstated missing
methods by two. This report replaces those inventory conclusions without altering
source research.

## Disposition

Critical and High findings are zero in this fresh full system audit. No C/H
fix loop was needed. The two Medium wording findings are reported to the driving
agent for adjudication. Per delegated scope, this pass changes only the report:
no foundation docs, code, work items or knowledge indexes were edited, and no
peer review was delegated. Existing index changes were left untouched. The report
does not close automatic implementation review, PR CI, or physical acceptance.

### Receiving-agent resolution

Both Medium findings are accepted and corrected in `1087d73`: the data-flow
statement now describes the adapter boundary including private vault and native
file delivery, and `LocalClimbDraft` is described as platform-local. Root verified
both narrow corrections against the report and source. No unresolved material
documentation finding remains. Provenance counts and original dates were also
independently checked against frontmatter; no research was redated or refreshed.
The index regeneration reports zero errors and the two existing advisory
decision-count warnings. No Critical/High finding requires a repeated audit.

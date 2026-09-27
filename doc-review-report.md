# Doc Review Report

**Project:** CruxControl

**Date:** 2026-09-27

**Scope:** Fresh `--system-only` documentation consistency audit of the isolated iOS prototype-shell change.

**Documents reviewed:** 10 distinct documents: 5 system planning documents and 5 supporting documents; `CLAUDE.md` resolves to the reviewed `AGENTS.md`.

**Passes run:** 1 fresh system pass; 0 module passes.

**Open issues:** Critical **0**, High **0**, Medium **0**, Low **0**, Info **0**.

**Resolved during review:** 1 Medium wording drift, corrected by the parent.

## Inventory and scope

System planning documents: `docs/VISION.md`, `docs/SPEC.md`,
`docs/ARCHITECTURE.md`, `docs/PRINCIPLES.md`, and `docs/DEPLOY.md`.
Supporting documents: `AGENTS.md`, `README.md`, `prototypes/ios/README.md`,
`.work/active/epics/epic-ios-controller-bridge.md`, and
`ios-prototype-shell` story (reviewed at
`.work/active/stories/ios-prototype-shell.md`, subsequently archived by the parent
at `.work/archive/ios-prototype-shell.md`; full body retained at
`51b6ee7:.work/active/stories/ios-prototype-shell.md`).

The knowledge index and directory discovery found no active module planning
documents. `docs/architecture/history/north-star.md` is explicitly superseded by
the current foundation documents, not an active module contract. All five system
planning documents have nonempty descriptions, the repository's `planning` type,
and current `updated` fields. The repository's current knowledge schema also
supports ARD analytical artifacts without the legacy `research_method` field.

This pass compares the documentation with the actual configuration, source,
fixture, and test files. It is not an independent implementation review, a rerun
of the test suite, or a new verification of the research corpus. Generated index
summaries awaiting the parent's regeneration are excluded from drift findings.

## Pass 1: System-level findings

### Critical (0)

None.

### High (0)

None.

### Medium (0 open; 1 resolved)

#### Epic bootstrap grounding still describes the pre-prototype state

**Files:** `.work/active/epics/epic-ios-controller-bridge.md`, “Code grounding and
next evidence”; `web/src/pwa/register-sw.ts`; `web/src/pwa/update-service.ts`.

**What:** The epic says `main.tsx` “always starts service-worker update admission”
and says packaged apps need an explicit bootstrap policy. The new prototype
already has that policy: `ios-prototype` supplies an update coordinator with
`container: null`; its `start()` returns with the unavailable state before worker
registration or browser admission. `main.tsx` still starts the coordinator, but
the unqualified description now obscures the implemented packaged exception.
The epic's new preparation checkpoint and the architecture otherwise describe
that exception correctly.

**Suggested change:** State that main starts the shared coordinator, ordinary
browser builds retain PWA admission, and the explicit prototype mode disables
registration/admission while native update preservation remains unverified.
The parent applied this correction during the audit; the current bullet now
states the implemented exception and retains binary-update preservation as
unverified. The corrected wording was read back against the same code branch.
No source document was changed by this audit agent.

### Low (0)

None.

### Info (0)

None. Pending native evidence below is an accurately documented limitation, not
a documentation defect.

## Clean areas and evidence

- The framework remains a prototype candidate across vision, specification,
  architecture, README, and the owning epic. No document claims delivered iPhone
  board control, production framework selection, proven native durability, or
  native authentication.
- The separate package, lockfile, and generated SPM manifest consistently pin
  Capacitor 8.4.3. The root workspace remains `web`; its Node 20 configuration and
  the prototype's Node 22 configuration match their setup instructions.
- `capacitor.config.json`, the Xcode project, and Info.plist agree on the separate
  bundle identifier and display name. Assets are local; there is no `server.url`
  or committed signing team. Generic generated signing settings are not personal
  signing credentials.
- Vite's explicit `ios-prototype` mode writes a separate output and disables PWA
  generation. `register-sw.ts` disables registration for that mode. Ordinary
  production behavior remains on the prior branch. The Chromium smoke checks
  registration attempts, missing manifest, restore, reload, and full exported
  authored records; its documentation does not label Chromium as Simulator.
- The fixture has four climbs: one active draft, two active finished climbs, and
  one trashed climb. It includes a version-2 spatial recipe, two lists, shared
  membership, ordered entries, and a missing-climb reference. The manual checklist
  matches those records and uses the existing restore/export interface.
- `create-runtime.ts` still constructs IndexedDB repositories and the existing
  backup store. `installations.ts` still chooses Web Bluetooth. No native BLE,
  native persistence adapter, or authentication implementation is claimed.
- CI separates the prototype asset/sync/Chromium lane from ordinary web checks;
  neither the workflow nor guide calls it native compilation. The deployment
  runbook's `needs: [web]` and explicit enablement still match deployment config.
- Local preflight reconfirmed macOS 26.3 and standalone Command Line Tools;
  `xcodebuild` cannot use that selection and `simctl` is unavailable. The setup
  guide correctly keeps native compilation and simulator operation pending.
- The documented compatibility guidance matches the current primary sources:
  Xcode 26.6 supports this macOS version, while Xcode 27 requires macOS 26.6 or
  later. [Apple's compatibility table](https://developer.apple.com/xcode/system-requirements/)
  and [Capacitor's setup guide](https://capacitorjs.com/docs/getting-started/environment-setup)
  were checked on the audit date. No OS upgrade is established as necessary for
  the compatible-toolchain path.
- All local Markdown link targets in the ten reviewed documents resolve. All 27
  entries in the current knowledge index point to existing files. Private source
  directories were not inspected or changed.

## Blocking briefs status

No numbered roadmap phase or “Blocking briefs” contract is introduced by this
change. These existing research references ground the bounded shell work and its
remaining acceptance gates; existence does not discharge those gates.

| Research path | Consumer | Exists on disk? | Status boundary |
| --- | --- | --- | --- |
| `.research/analysis/briefs/ios-shared-client.md` | Shell candidate and reuse boundaries | Yes | Comparison exists; not native acceptance |
| `.research/analysis/landscapes/ios-board-client-prior-art.md` | Candidate risks and decision gate | Yes | Prior-art review exists; not performance or board proof |
| `.research/analysis/landscapes/climbing-board-ecosystem.md` | Owning epic context | Yes | Existing landscape; not newly reverified here |
| `.research/analysis/briefs/invited-offline-library.md` | Deferred shared-library boundary | Yes | Shared implementation remains held for native auth proof |

## DONE-claim verification

There is no newly closed iPhone acceptance phase: the epic remains `drafting`
with `needs-research`. The shell story was at `review` when its body was audited;
the parent subsequently completed its bounded inline review and archived that
preparation story. This audit does not independently assert a PR CI result.
The following preparation outputs asserted in the docs exist:

| Claimed output or gate | Evidence | Verification boundary |
| --- | --- | --- |
| Isolated shell configuration | `prototypes/ios/package.json`, lockfile, config, `.nvmrc` | Files present and mutually consistent |
| Generated native project | `prototypes/ios/ios/App/App.xcodeproj/project.pbxproj`, `CapApp-SPM/Package.swift` | Present; not compiled in this audit |
| Synthetic library | `prototypes/ios/fixtures/synthetic-library.json` | Described records and memberships verified |
| Packaged startup/browser check | `web/playwright.ios-prototype.config.ts`, `web/prototype-tests/shell.spec.ts` | Present; browser-only contract inspected |
| Separate CI check | `.github/workflows/ci.yml` | Asset/sync/Chromium steps present; live run result not independently asserted |
| Native compile and Simulator | Guide and retained story body explicitly say pending | No false native DONE claim; archived story covers shell preparation only |
| Physical BLE, native durability/auth, framework acceptance | Epic and guide retain open gates | No false DONE claim |

## Provenance summary

Metadata inventory only; source attestations and semantic claims were not audited.

| research_method / schema | Briefs and program reports | Latest updated |
| --- | ---: | --- |
| `/deep-research` | 8 | 2026-06-14 |
| `/research` | 1 | 2026-06-14 |
| `/brief` | 5 | 2026-06-14 |
| `migrated` | 2 | 2026-08-02 |
| Current ARD analysis schema (not legacy `research_method`) | 3 | 2026-09-27 |

### Refresh candidates

The legacy metadata heuristic finds four `/brief` documents predating the most
recent `/deep-research` entry: `board-control-web-bluetooth`,
`board-rendering-and-filtering`, `catalog-sync-api`, and
`recommendations-and-training` (all 2026-06-13). These are informational candidates,
not evidence of errors or a prerequisite for this shell change. Their relevance
and source freshness were not re-evaluated by this bounded audit.

## Disposition

The fresh pass reports **0 Critical / 0 High**, with all severity counts now zero
after the parent corrected the single Medium wording drift. No Critical/High
auto-fix loop was triggered. Source edits and
knowledge-index regeneration remain with the parent agent. This report does not
grant native acceptance or substitute for the story's implementation review and
required CI checks.

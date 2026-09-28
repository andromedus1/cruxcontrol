# Doc Review Report

**Project:** CruxControl

**Date:** 2026-09-28

**Scope:** Fresh `--system-only` documentation consistency pass for the isolated native BLE preparation feature.

**Snapshot:** `codex/ios-native-ble`, HEAD `cfc9c858b742acd7a8508d9ea311c92a1d69a535`, with the parent's regenerated knowledge indexes.

**Documents reviewed:** 5 current system planning documents, with supporting project rules, README files, work items, and implementation evidence.

**Passes run:** 1 fresh system pass; 0 module passes. No active module planning documents were discovered.

**Issues found:** Critical **0**, High **0**, Medium **0**, Low **0**, Info **0**.

## Inventory and review boundary

The system set comprises `docs/VISION.md`, `docs/SPEC.md`,
`docs/ARCHITECTURE.md`, `docs/PRINCIPLES.md`, and `docs/DEPLOY.md`.
The principal supporting set comprises `AGENTS.md`, `README.md`,
`prototypes/ios/README.md`, `.work/active/epics/epic-ios-controller-bridge.md`,
and `.work/active/features/epic-ios-controller-bridge-native-ble.md`.
`CLAUDE.md` resolves to the same file as `AGENTS.md`. The pass also read
`.agents/rules/agile-workflow.md`, `.work/CONVENTIONS.md`, the archived shell
preparation reference, and the shared-library epic/access item's native design hold.

The knowledge index catalogs five planning documents. Directory discovery found
no active module north stars or module architecture sets; the old
`docs/architecture/history/north-star.md` declares `status: superseded`, points to
the current architecture, and explicitly transfers its roadmap to `.work/`.
All five current planning documents have nonempty descriptions, the repository's
`planning` type, and current `updated` dates. **Frontmatter compliance: 5/5.**
The local schema and build-process reference recognize ARD analytical provenance;
legacy `research_method` is not required on conformant `.research/analysis/` artifacts.

This independently delegated pass follows `research-pipeline:doc-review` and its
build-process reference. The inherited model was used because the requested
Sonnet worker was unavailable through this harness. The review checks present and
intended contracts against documents and actual files. It does not repeat the
implementation review, rerun tests, validate external research sources, or infer
native acceptance from browser or test-double results. Unimplemented future
capabilities and accurately recorded pending evidence are not drift findings.

## Pass 1: System-level findings

### Critical (0)

None.

### High (0)

None.

### Medium (0)

None.

### Low (0)

None.

### Info (0)

None. The outstanding native evidence is an explicit acceptance boundary, not a
documentation inconsistency.

## Clean areas and evidence

- **Product intent and delivery state agree.** Vision and specification require
  Android and iPhone board control but do not claim delivered iPhone support.
  Architecture describes the isolated adapter and retains native compilation,
  simulator behavior, radio delivery, durable storage, backup, and authentication
  as unverified (`docs/ARCHITECTURE.md:73`, `:217`). The iOS epic remains `drafting`
  with `needs-research`; the native BLE feature remains `review`. The shared-access
  feature's current design hold explicitly makes its retained web design a
  candidate requiring revision, rather than an implementation-ready native contract.
- **Native I/O uses the shared application boundary.**
  `prototypes/ios/src/runtime.ts:43` injects `NativeBleByteTransport` through the
  installation registry and `createCruxControlRuntime`; the shared runtime still
  opens the existing climb, playlist, and backup repositories. Browser inspection
  receives an unavailable native transport and does not select Web Bluetooth.
  `web/src/app/installations.ts` retains Web Bluetooth as the ordinary browser default.
- **The lifecycle description matches the implementation.** Runtime listeners map
  native `pause` and `resume` to `setForeground(false/true)` and guard disposed
  callbacks (`prototypes/ios/src/runtime.ts:12`). Backgrounding invalidates the
  connection; foreground return alone does not reconnect
  (`prototypes/ios/src/native-ble-transport.ts:90`). Selection remains explicit,
  remembered device identity is in memory, and library startup does not initialize
  Bluetooth. The guide does not promise that disconnect physically clears LEDs or
  that a native write already handed to the OS can be recalled.
- **Documented write contracts are present.** The adapter copies admitted buffers,
  serializes batches, checks generations, waits for prior writes/cleanup before
  reconnect, discovers the advertised write mode, and supplies 10-second connect
  and 5-second write timeouts (`prototypes/ios/src/native-ble-transport.ts:125`).
  These are application contracts, consistently described as requiring real-device
  validation rather than proof of radio timing or board delivery.
- **Bootstrap and update boundaries agree.** `web/vite.config.ts:10` selects the
  dedicated prototype entry, `:23` selects `dist-ios-prototype`, and `:29` disables
  PWA generation. `prototypes/ios/src/main.tsx` mounts the shared application with
  its native runtime without starting service-worker registration or the update
  coordinator. `web/src/main.tsx` retains ordinary PWA admission. The prior report's
  description of a prototype coordinator with a null container is superseded by
  this dedicated entry point.
- **Native configuration matches the guide and architecture.** The prototype
  package/lockfile and SPM references agree on Capacitor 8.4.3, BLE 8.3.0, and App
  8.1.1. `capacitor.config.json` uses the separate prototype app identity and bundled
  assets, with no remote `server.url`. `Info.plist:5` supplies the Bluetooth usage
  description and contains no background Bluetooth mode. Root Node 20 and prototype
  Node 22 settings match their separate setup instructions.
- **Tests and CI are described at the right level.** Native transport/runtime test
  files exercise doubles and shared controller packets; they do not execute
  CoreBluetooth. `web/prototype-tests/shell.spec.ts` checks packaged startup,
  unavailable control, no worker registration, synthetic restore/export, and full
  record preservation across Chromium reload. The separate CI lane runs adapter
  checks, asset build/sync, and Chromium smoke (`.github/workflows/ci.yml:58`), not
  Xcode compilation or Simulator. The feature records 26 adapter/runtime tests,
  664 web tests, static checks, builds/sync, and Chromium smoke as local evidence;
  independent code review and CI are explicitly pending. This pass inspected those
  evidence boundaries without claiming to rerun the checks.
- **Preservation remains explicit.** The prototype guide uses only the synthetic
  fixture and keeps WKWebView file handling, native durability, binary-update
  preservation, and sign-in open. AGENTS.md's whole-library backup and origin/profile
  requirements remain applicable to any later operated phone work. Nothing in the
  feature treats native preparation as permission to move or replace personal data.
- **Deployment remains consistent.** The runbook still matches the static Worker
  configuration and CI's `needs: [web]`, main-push condition, and `ENABLE_DEPLOY`
  opt-in (`.github/workflows/ci.yml:131`). The prototype lane does not constitute a
  native distribution path. No current document claims a shared service is deployed.
- **References and the knowledge index are coherent.** All 29 local Markdown links
  in the ten principal documents resolve. All 27 cataloged document paths exist;
  indexed `updated` dates match their source frontmatter, including architecture's
  2026-09-28 date after regeneration. The reviewed `related` and `superseded_by`
  path references resolve. Private source directories were not inspected or changed.

## Blocking briefs status

There is no active numbered roadmap with a newly introduced “Blocking briefs”
contract. Delivery dependencies belong to `.work/`. The relevant research artifacts
exist; their existence does not discharge the remaining device/storage/auth gates.

| Research path | Consumer | Exists on disk? | Status boundary |
| --- | --- | --- | --- |
| `.research/analysis/briefs/ios-shared-client.md` | iOS candidate and shared-code boundaries | Yes | Comparison, not native acceptance |
| `.research/analysis/landscapes/ios-board-client-prior-art.md` | Candidate risks and framework gate | Yes | Prior art, not radio/performance proof |
| `.research/analysis/landscapes/climbing-board-ecosystem.md` | iOS epic context | Yes | Existing landscape |
| `.research/analysis/briefs/invited-offline-library.md` | Intended shared service | Yes | Access design remains held for native proof |
| `.research/analysis/briefs/invited-library-hosting-costs.md` | Shared-service hosting choice | Yes | No provisioning or provider acceptance implied |
| `.research/briefs/cloudflare-deploy/parent.md` | Current deployment runbook | Yes | Configuration is distinct from enabled deployment |

## DONE-claim verification

No native acceptance phase is marked DONE. The archived `ios-prototype-shell`
reference is `done` and is the native feature's satisfied preparation dependency;
its bounded output files remain present. The iOS epic is not closed by that archive.

| Claimed output or gate | File evidence | Verification boundary |
| --- | --- | --- |
| Isolated shell and synthetic data | Prototype package/config/lockfile, Xcode project, `fixtures/synthetic-library.json` | Present; separate preparation output |
| Native adapter and lifecycle binding | `prototypes/ios/src/native-ble-transport.ts`, `runtime.ts`, `main.tsx` | Present; not hardware acceptance |
| Permission and plugin integration | `Info.plist`, `CapApp-SPM/Package.swift` | Present; not native compilation |
| Deterministic adapter/runtime checks | `native-ble-transport.test.ts`, `runtime.test.ts` | Present; fake native client |
| Packaged browser verification | `web/playwright.ios-prototype.config.ts`, `web/prototype-tests/shell.spec.ts` | Present; Chromium only |
| Required feature review and CI | Feature remains `review`; CI configuration exists | Pending at audit snapshot |
| Native compilation and Simulator | Guide and work items explicitly retain tooling gate | Not performed; full Xcode unavailable as recorded |
| Real iPhone/Fullride, durable storage, native backup/auth, distribution | Epic and guide retain acceptance gates | Not performed; test phone unavailable |

## Provenance summary

Metadata inventory only; neither source validity nor analytical support was audited.
The 21 research entries include the 19 briefs/program reports below and two ARD
landscapes. Both landscapes carry `provenance: agent-synthesis`; their latest update
is 2026-09-27.

| research_method / schema | Briefs and program reports | Latest updated |
| --- | ---: | --- |
| `/deep-research` | 8 | 2026-06-14 |
| `/research` | 1 | 2026-06-14 |
| `/brief` | 5 | 2026-06-14 |
| `migrated` | 2 | 2026-08-02 |
| Current ARD analysis schema (`provenance: agent-synthesis`) | 3 | 2026-09-27 |

### Refresh candidates

The legacy metadata heuristic identifies four `/brief` entries older than the
latest `/deep-research` entry. They are informational candidates, not defects or
prerequisites for native BLE preparation. Current ARD provenance is not assigned
an invented legacy tool tier.

| Slug | research_method | Updated | Note |
| --- | --- | --- | --- |
| `board-control-web-bluetooth` | `/brief` | 2026-06-13 | Related transport topic; no new source audit |
| `board-rendering-and-filtering` | `/brief` | 2026-06-13 | Metadata-only candidate |
| `catalog-sync-api` | `/brief` | 2026-06-13 | Metadata-only candidate |
| `recommendations-and-training` | `/brief` | 2026-06-13 | Metadata-only candidate |

## Disposition

The fresh full system pass reports **0 Critical / 0 High**, with all lower-severity
counts also zero. No fixes or Critical/High auto-fix loop are required by this pass.
Only this report was edited by the audit agent; index regeneration belongs to the
parent. This verdict establishes documentation consistency at the reviewed snapshot,
not feature completion, native support, production framework selection, or CI success.

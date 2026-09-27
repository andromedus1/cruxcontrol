---
id: ios-prototype-shell
kind: story
stage: done
tags: [infra]
parent: null
depends_on: []
release_binding: null
gate_origin: null
research_refs:
  - .research/analysis/briefs/ios-shared-client.md
  - .research/analysis/landscapes/ios-board-client-prior-art.md
created: 2026-09-27
updated: 2026-09-27
---

# Prepare the isolated iOS prototype shell

## Brief

Deliver the first executable preparation slice for
[the iOS proof](../epics/epic-ios-controller-bridge.md): a Capacitor iOS project
bundling the existing application, with reproducible commands and synthetic
library data. Andrew accepted preparation and simulator work ahead of a friend's
physical-device session. Full Xcode is not installed locally.

This is a bounded standalone preparation story, not production decomposition of
the research-gated epic. Native BLE, durable native storage, authentication,
distribution and framework acceptance remain owned by that epic. Simulator
execution is a separate evidence checkpoint once Xcode is available.

## Strategic decisions

- Use the researched Capacitor candidate in an isolated prototype package and
  bundle identifier. Keep its Node 22+ toolchain separate from web CI's Node 20.
- Reuse existing screens without UI changes; no new mockup is required.
- Use only synthetic data in this experiment. No installed app or personal
  library is read, migrated, backed up, replaced or updated by these commands.

## Design and acceptance

1. Add a pinned Capacitor package under `prototypes/ios`, a generated SPM iOS
   project and commands to build/copy assets and open/run it. Bundle local assets;
   no remote `server.url`, signing identity or credentials in Git.
2. Build the shared web source with an explicit `ios-prototype` Vite mode into
   separate output. Omit PWA generation and service-worker registration only in
   that mode; preserve ordinary browser admission/update behavior.
3. Supply an importable synthetic backup exercising Draft, Finished, Trash,
   effects and ordered shared playlist memberships. Validate it using the real
   restore/export path and check records survive a reload in an isolated browser
   context. This is preparation evidence, not WKWebView or durability acceptance.
4. Document Xcode prerequisites, exact preparation/run commands, simulator checks
   and physical evidence still needed. Mark unexecuted checks explicitly.
5. Verify browser regression checks and the prototype asset build in CI. Native
   compilation and simulator execution remain pending; do not report them passed.

## Simplification opportunity

Reuse the current app, repositories, backup codec and unavailable-update state.
Do not introduce a second UI, fake BLE success, alternate backup format or generic
platform abstraction. Keep all Capacitor dependencies outside the production PWA.

## Execution

Inline, current agent; direct reads answered the integration questions. Effective
review weight: standard from `.work/CONVENTIONS.md`, with the standalone-story
bounded inline review exception. No independent worker is needed.

## Implementation notes

- Added `prototypes/ios`: generated SPM Xcode project, pinned package/lockfile,
  distinct bundle ID, reproducible scripts, synthetic fixture and setup guide.
- Capacitor 8.4.3 is pinned consistently in npm and SPM. The latest 8.5.2 CLI
  introduced a development-only xcode → uuid advisory; selecting the preceding
  stable minor avoids that dependency. Prototype `npm audit` reports zero findings.
- `web/vite.config.ts` and `register-sw.ts` make only the explicit prototype mode
  use packaged updates. Reused the existing unavailable-update behavior, without
  a platform abstraction or production PWA dependency on Capacitor.
- One browser integration check loads the real packaged assets, rejects any
  service-worker registration, restores the fixture using the normal UI, reloads,
  exports and compares every authored record and ordered playlist entry.
- CI has a separate Node 22 prototype asset/sync/browser lane; ordinary web checks
  remain on Node 20. This lane is explicitly not a native compilation check.
- Existing renderer, transport, storage, backup and UI contracts are unchanged.
  No adjacent production bugs were found or silently repaired.

## Verification

- Local lint and typecheck passed; 85 test files / 664 tests passed.
- Ordinary production build generates its PWA manifest/worker; prototype build
  omits them and writes a different output directory. `cap add ios` and repeatable
  `npm --prefix prototypes/ios run sync` passed.
- Packaged browser smoke passed: 4 climbs / 2 lists retained, including Trash,
  recipes, shared membership, dangling reference and exact ordered entries.
- `plutil` validated generated Info.plist and project.pbxproj.
- Native compilation, simulator operation, BLE, durable storage and native auth
  are unverified. Full Xcode is absent. These are explicit later epic checkpoints,
  not acceptance criteria silently waived for this shell-preparation story.
- Local implementation verification is complete. Required PR CI is the merge
  gate; merge only after both web and prototype lanes pass on the submitted head.

## Review (2026-09-27)

**Verdict:** Approve for the bounded shell-preparation scope.

**Blockers:** none unresolved.
**Important:** none.
**Nits:** none.

Bounded inline review under the standalone-story exception; no independent code
reviewer ran. Checked packaged asset paths, pinned npm/SPM versions, generated
native metadata, isolated identity, browser update behavior and CI commands.
No new schema, transport, credentials, deployment or personal-data operation is
introduced. The test initially checked only successful registrations and a generic
error string; added an explicit attempt counter so caught failures cannot yield
a false pass. The corrected test and lint pass. Documentation review corrected
the old bootstrap wording; native acceptance remains visibly pending in the epic
and guide. No claim of compiled/simulator-tested iOS support is made.

---
id: ios-prototype-shell
kind: story
stage: implementing
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

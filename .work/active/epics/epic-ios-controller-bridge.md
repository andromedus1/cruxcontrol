---
id: epic-ios-controller-bridge
kind: epic
stage: drafting
tags: [ble, needs-research]
parent: null
depends_on: [epic-universal-board-platform, epic-board-control]
release_binding: null
gate_origin: null
research_refs:
  - .research/analysis/landscapes/climbing-board-ecosystem.md
  - .research/analysis/briefs/ios-shared-client.md
created: 2026-08-02
updated: 2026-09-27
---

# iOS Controller Bridge

## Brief

Enable iPhone board control, alongside browsing, saving and publishing climbs,
while sharing application behavior with Android. Establish the mobile architecture
before continuing shared-library implementation. Preserve the working web app,
local data ownership, board protocols, effects and backup semantics. Native iPhone
support is not delivered; responsive CSS or a simulator build cannot establish it.

## Research gate

The [focused comparison](../../../.research/analysis/briefs/ios-shared-client.md)
distinguishes Electron desktop delivery, React Native mobile views and a Capacitor
web-preserving shell. The agent recommendation is to test Capacitor and native BLE
first; Andrew has not selected a framework migration. Physical board operation,
durable storage, native sign-in and release/distribution remain unresolved. Retain
`needs-research` until those consequential contracts are grounded; this comparison
does not discharge the whole epic's research gate.

## Strategic decisions

- **Capability:** iPhones must connect to and control the board, as well as browse,
  save and publish — confirmed by Andrew on 2026-09-27.
- **Priority:** establish an iOS-capable path before further shared-library work.
  This supersedes the Android-only first-delivery assumption. Reopen access design
  for native origins, session handling and return paths; Android/PWA proof alone
  is insufficient. A successful mobile proof can unblock access redesign without
  waiting for every native distribution task to ship.
- **Shared code:** avoid separate product implementations for iOS and Android.
  Some platform integration, builds and device testing remain necessary.
- **Preservation:** follow AGENTS.md's backup/origin rules for any phone work.
  No reset, uninstall or storage replacement as a migration shortcut.
- **Scope:** foreground wall sessions with the existing animation policy. New
  boards, background animation and a UI redesign are not implied by this request.

## Simplification opportunity

Reuse `BoardByteTransport`, controller codecs, board definitions and existing
React screens. A proven shell could avoid a parallel native UI. React Native
remains an alternative sharing the domain core; do not build both production UIs
or a generic framework abstraction during the proof.

## Code grounding and next evidence

- `web/src/board-control/transport.ts` and `light-controller.ts` separate byte I/O
  from command encoding and effects. Preserve ordering, pacing, errors and lifecycle.
- `web/src/board-renderer/BoardRenderer.tsx` uses DOM/SVG refs, CSS and browser input
  events; React Native core components do not directly supply this renderer.
- `web/src/app/create-runtime.ts` instantiates IndexedDB repositories and a backup
  store over both databases. Native storage work includes backup integration.
- `web/src/main.tsx` always starts service-worker update admission. Packaged apps
  need an explicit bootstrap/update policy, not an assumed browser lifecycle.
- Prove light/clear, interruption/reconnect, permission denial and foreground/resume
  on a real iPhone and Fullride. Then test a synthetic climb and ordered playlist
  across relaunch/update, plus whole-library export/restore of IDs, order and recipes.
- Before resuming access, prove native sign-in and authenticated API calls; reconsider
  the auth provider if needed. Do not relax origin/CSRF checks to make requests pass.
- Confirm device/OS support, build/signing, and a suitable distribution path before
  calling iOS shippable. No native build, physical test or data migration has occurred.

## Research engagement registration

User seed: compare shared-code mobile approaches, including the suggested
Electron/React Native combination; direct iPhone control is confirmed. Reuse the
session's bounded research approach with agent judgment and standard independent
verification. This gap-fill consumes prior ecosystem work as framing, not as a
source. One inline synthesis and one independent adversarial reader suffice;
the existing epic owns the result and no implementation items are emitted.

```yaml
intent: terminate-in-position
output_kind: synthesis-brief
consumer: calibrated-work
scope_authority: in-engagement-judgment
verification_rigor: standard
temporal_contract: re-engage-on-trigger
primitives_extends: []
primitives_opts_out: []
decision_relevance: Choose the first mobile proof and identify access-design changes before shared-library implementation resumes.
```

## Anticipated child features

Decompose after shell/transport direction and proof scope are aligned. Existing
visual direction remains the starting point; new connection/recovery surfaces
must follow mockup-first. Do not treat a research recommendation as implementation
or approval of an unseen UI redesign.

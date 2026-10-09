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
  - .research/analysis/landscapes/ios-board-client-prior-art.md
created: 2026-08-02
updated: 2026-10-09
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

The [prior-art scout](../../../.research/analysis/landscapes/ios-board-client-prior-art.md)
adds a material counterexample: Boardsesh moved from Capacitor to React Native and
reports improved responsiveness. Grip Connect implements the proposed Capacitor
Aurora bridge, while Boardsesh retains custom native BLE. These findings support
an experiment with explicit acceptance criteria; they do not select a framework.

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

## Availability and proof sequence

Andrew accepted the prototype-first plan on 2026-09-27 and confirmed that no iPhone
is currently available for testing. Physical testing will depend on a friend's
availability; no date or device/OS version is known. This changes sequencing, not
the requirement for iPhone board control or the production framework decision.

- **Preparation without an iPhone:** ground the shell/bootstrap, native transport,
  persistence and identity boundaries; prepare synthetic library/backup fixtures
  and a repeatable physical-session checklist. Keep the experiment isolated from
  Andrew's installed app and personal library. A test double can check application
  state and command contracts, but cannot validate CoreBluetooth or real delivery.
- **Simulator once tooling is available:** exercise packaged startup, existing
  screens, navigation, local data operations and backup round trips where supported.
  Record native API gaps explicitly. Simulator results can uncover functional
  problems but cannot establish real-phone responsiveness, storage-pressure
  behavior, Bluetooth delivery or complete device lifecycle recovery. The
  [BLE plugin's iOS instructions](https://github.com/capacitor-community/bluetooth-le#ios)
  explicitly require a real device for Bluetooth.
- **Friend's iPhone plus the board:** run the framework admission checks below,
  including repeated light/clear, denied permissions, interruption/reconnect,
  real-device interaction, preservation across updates and native sign-in. Confirm
  phone/OS, installation method and test data before that session. Do not close the
  iPhone acceptance gate or make a production framework selection from simulator
  or Android results.

The laptop migration is complete. The verified host is macOS 26.6 arm64 with Xcode
27.0 (27A266a), iOS 27.0 simulator runtime (24A434), and an isolated iPhone 17
simulator. Node 20.20.2 and 22.23.3 are installed through nvm; the shell's global
Node and developer-directory selection remain unchanged. The owning
[`ios-simulator-build-smoke`](../../archive/ios-simulator-build-smoke.md) story records
tooling and startup evidence.

## Preparation checkpoint

The initial isolated shell preparation is tracked by
[`ios-prototype-shell`](../../archive/ios-prototype-shell.md). It packages the current
screens in `prototypes/ios`, with a separate bundle identity and synthetic backup
fixture. The package now builds, installs, and launches in the simulator. A
storyboard-backed scene delegate and manifest forward cold and warm URLs through the
existing Capacitor `ApplicationDelegateProxy`. The observed startup screenshot shows
the controls clear of the status bar, and startup does not request Bluetooth access.
The prototype guide owns repeatable setup commands and the remaining manual checklist.

[`epic-ios-controller-bridge-native-ble`](../features/epic-ios-controller-bridge-native-ble.md)
owns native adapter preparation, required review, CI, and merge. It adds a dedicated
prototype composition root with pinned BLE 8.3.0 and App 8.1.1 plugins, reusing the
shared UI, controller, codecs, and library. Device selection is explicit and retained
only in memory for the session. Native backgrounding disconnects; foreground return
requires explicit reconnect, with no automatic effect restart or background BLE mode.
Browser inspection exposes unsupported control instead of selecting Web Bluetooth.
The native simulator also reports unsupported on Connect. Deterministic adapter
tests and Chromium library checks cannot establish CoreBluetooth behavior.

The iPhone 17 / iOS 27 simulator has since exercised synthetic library operations:
fixture import through the native picker, create/save/relaunch of a V4 draft,
ordered-list inspection, and preservation of records and order after a native app
update. The Name and optional Grade fields use a 16px input size, and simulator
focus no longer causes horizontal page zoom. The scene's safe-area layout keeps
controls clear of the status bar.

The [backup export feature](../features/epic-ios-controller-bridge-backup-export.md)
adds Filesystem 8.1.4 and Share 8.0.3, with the native path writing the unchanged
UTF-8 backup JSON to app cache and passing its file URI to the iOS share sheet.
Cancellation returns to a usable dialog; the adapter retains its app-owned cache
copy until the next export preflight so a nested OS destination can finish.
Save to Files produced a destination file that the production codec decoded
and compared against the fixture: four fixture climbs plus the separately created
V4 draft, two ordered playlists, Trash and missing-reference membership, and the
effect recipe matched. The sheet completion was followed by cache cleanup. A second
empty iPhone 17 / iOS 27 simulator then reviewed and restored that actual file through
the normal picker, retained five climbs and two playlists after relaunch, and
re-exported a canonical snapshot matching every record and ordered membership from
the first export (ignoring the envelope export timestamp). Its cache copy was also
removed after OS share completion. This establishes the exercised simulator backup
round trip; it does not establish physical-device behavior or storage-pressure
durability.

These simulator checks do not establish physical iPhone/board acceptance, storage-
pressure durability, native authentication, or distribution. Physical testing still
depends on a test phone. Capacitor remains a proof candidate.

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
- `web/src/main.tsx` starts the update coordinator before the browser workspace.
  Explicit `ios-prototype` builds select `prototypes/ios/src/main.tsx` instead,
  inject the native runtime, and omit the service worker and update coordinator.
  Native binary-update preservation still needs interactive simulator/device evidence.
- Prove light/clear, interruption/reconnect, permission denial and foreground/resume
  on a real iPhone and Fullride. Then test a synthetic climb and ordered playlist
  across relaunch/update, plus whole-library export/restore of IDs, order and recipes.
- Before resuming access, prove native sign-in and authenticated API calls; reconsider
  the auth provider if needed. Do not relax origin/CSRF checks to make requests pass.
- Confirm device/OS support, build/signing, and a suitable distribution path before
  calling iOS shippable. Native build and simulator startup are verified; physical
  testing and data migration remain pending.

## Proposed framework decision gate

Retain Capacitor as the first proof candidate because it can exercise our existing
DOM/SVG screens and `BoardByteTransport` boundary. Preparation can start before the
test phone is available. Define representative synthetic library fixtures during
preparation and confirm the phone/OS before the physical acceptance session. Include selection,
scrolling, editing and foreground effects in the device walk-through; record visible
stalls, missed input and command delivery as well as connection success. Compare the
same tasks with the working Android experience, without treating unlike hardware
as a controlled framework benchmark.

Admission requires responsive interaction, observed correct lights/clear and recovery,
an explicit durable-storage strategy with backup/update preservation, and a native
sign-in/API proof. A few successful relaunches do not establish IndexedDB durability.
Document remaining native adapter and release work before choosing the production
path. If a significant blocker is attributable to the shell or renderer after
diagnosis, compare a narrow React Native slice performing the failing task before
authorizing a larger migration. A protocol error alone does not justify rewriting UI.
The Safari-extension path remains a secondary experiment if its extra installation
step is acceptable; its board and installed-PWA behavior are unverified.

This is a proposed gate for the user's framework decision, not authorization to
rewrite the UI or replace personal data. Shared-library access implementation stays
on hold under its existing native-origin/authentication design gate.

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

### Prior-art scout follow-up

Andrew requested a second review before framework commitment. Reuse the established
standard independent-verification depth and agent scope judgment. The scout is a
new, narrower landscape; the earlier ecosystem and mobile comparison remain lenses,
not source attestations or artifacts to silently rewrite.

```yaml
intent: prior-art-landscape
output_kind: breadth-survey-landscape
consumer: calibrated-work
scope_authority: in-engagement-judgment
verification_rigor: standard
temporal_contract: re-engage-on-trigger
primitives_extends: []
primitives_opts_out: []
analytical_artifact_type: landscape
decision_relevance: Identify prior implementations and failures that could change the first mobile proof candidate or its acceptance criteria before choosing a production framework.
```

Framing considered: framework-by-framework comparison (would repeat the first
brief); subsystem specialist lanes (would pull detailed implementation design into
a scout); or one inline survey of concrete projects across board apps, BLE adapters
and persistence/auth seams (chosen). The sample is not exhaustive; maintainer source
and release claims are not independent performance measurements. One independent
adversarial reader checks the resulting landscape. No child work items are emitted.

Engagement completed: 13 source attestations, 31 resolved citations, independent
review approved after two wording corrections, and lead semantic spot checks passed.
The native research gate remains open for the device, persistence, identity and
distribution evidence described above; the epic stays at drafting.

## Anticipated child features

The native BLE preparation feature above is the first active child. Decompose the
remaining native acceptance work as its evidence and proof scope are aligned. Existing
visual direction remains the starting point; new connection/recovery surfaces
must follow mockup-first. Do not treat a research recommendation as implementation
or approval of an unseen UI redesign.

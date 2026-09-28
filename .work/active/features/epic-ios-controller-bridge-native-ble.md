---
id: epic-ios-controller-bridge-native-ble
kind: feature
stage: done
tags: [ble]
parent: epic-ios-controller-bridge
depends_on: [ios-prototype-shell]
release_binding: null
gate_origin: null
research_refs:
  - .research/analysis/briefs/ios-shared-client.md
  - .research/analysis/landscapes/ios-board-client-prior-art.md
created: 2026-09-28
updated: 2026-09-28
---

# Native BLE transport for the isolated iOS prototype

## Brief

Continue the accepted Capacitor experiment with a native implementation of the
existing `BoardByteTransport` port and wire it into the isolated shell. Reuse
Fullride codecs, capacity/pacing policy, effects, existing connection controls and
local library. This feature delivers testable adapter preparation; compilation,
simulator behavior and real iPhone/board acceptance remain separate epic gates.
The parent retains its research gate for storage, authentication and distribution.

## Design decisions

Direction is inherited from Andrew's accepted prototype plan: foreground sessions,
existing screens, synthetic data, no production framework commitment. The scoped
question pass found no unresolved product choice requiring another confirmation.
Keep permission/discovery user initiated. Remember the selected board only for
the current app runtime; a new app session chooses again. On native backgrounding,
disconnect and require explicit reconnect after returning; do not automatically
resume effects. No background Bluetooth entitlement is added.

## Simplification opportunity

Use the existing byte-transport contract and runtime injection seam. Keep native
dependencies and bootstrap under `prototypes/ios`; avoid a second UI, browser API
emulation, a general transport framework, or changes to proven web transport code.

## Grounding and architectural choice

Direct reads of `transport.ts`, `web-bluetooth-transport.ts`, `light-controller.ts`,
`create-runtime.ts` and `installations.ts` establish the existing seam. No Explore
worker is needed. The completed mobile brief/scout grounds the candidate, while
the pinned plugin's shipped TypeScript and Swift source grounds these API details:

- [BLE plugin](https://github.com/capacitor-community/bluetooth-le), npm 8.3.0:
  native requestDevice filters by service; connect discovers services;
  getServices exposes write properties; write and writeWithoutResponse accept
  DataView and timeouts. iOS reports `BLE unsupported`, `BLE permission denied`
  and `requestDevice cancelled.` as message strings. Simulator BLE is unsupported.
- `BleClient` queues operations by default. Disable that queue in the dedicated
  native bootstrap: this adapter owns FIFO writes and must disconnect immediately
  even while a native write is pending. Await native completion before reconnecting.
- [Capacitor App](https://capacitorjs.com/docs/apis/app), npm 8.1.1: `pause` maps
  to iOS didEnterBackground; `resume` maps to willEnterForeground. Use those rather
  than `appStateChange`, whose willResignActive event can include system prompts.

Options considered: (1) a dedicated native adapter behind the existing port;
(2) emulate Web Bluetooth objects over the plugin to reuse its transport; (3)
extract a general GATT engine from the web implementation. Choose (1): the APIs
have different discovery, lifetime and asynchronous-disconnect semantics. The
other options expand the production regression surface before native acceptance.

## Implementation units and order

1. `prototypes/ios/src/native-ble-transport.ts` — hardest unit first.
   `NativeBleClient = Pick<BleClientInterface, 'initialize' | 'isEnabled' |
   'requestDevice' | 'connect' | 'disconnect' | 'getServices' | 'write' |
   'writeWithoutResponse'>`; `NativeBleByteTransport implements BoardByteTransport`,
   constructor `(client: NativeBleClient | null)`, plus
   `setForeground(active: boolean): void`.
   Serialize writes; copy caller bytes on admission; capture connection generation
   at admission, and verify before/after each native await. Prefer without-response
   when advertised, otherwise with-response; reject missing services/channels or
   unwritable characteristics. Preserve diagnostic trace/pacing/cancellation.
   Native connect/write timeouts are 10s/5s. Force disconnect invalidates pending
   selection/connect/write results synchronously and bypasses the write queue;
   subsequent connect waits for old native operations/cleanup to settle. Late
   connections get disconnected, never published. Old callbacks cannot tear down
   a newer session. Failed disconnect is surfaced; retry must clean up first.
2. `prototypes/ios/src/runtime.ts` and `main.tsx` — inject the native transport
   using `createAppInstallationRegistry({createTransport})` and
   `createCruxControlRuntime({getInstallation})`. Register/remove pause/resume
   listeners with runtime lifetime, and disconnect on close. Native permission
   failure must not prevent library startup. Browser inspection uses unsupported
   native capability, with no mock board success or Web Bluetooth fallback.
3. Prototype-only Vite entry selection, package checks, iOS usage description,
   generated SPM sync, and CI. No new screen or design-system change; existing
   controls and the plugin's system chooser are reused, so mocks are not needed.

## Acceptance and tests

- Deterministic native-client doubles prove explicit initialization, chooser
  cancellation/denial/disabled/unsupported handling, service/characteristic checks,
  write-mode selection, exact copied bytes, FIFO and pacing.
- Deferred promises prove force/remote disconnect during connect or final write
  cannot produce connected/applied success; queued stale bytes never cross into a
  new connection; failed writes do not poison future explicit recovery.
- Existing Fullride controller through this adapter sends real light/clear packets.
- Runtime lifecycle tests prove background disconnect, explicit foreground recovery,
  and listener cleanup. Build and packaged browser fixture still work without BLE.
- Typecheck, lint, tests, ordinary web regression CI, and prototype sync pass.
  No native compile, simulator or board test is asserted without actual execution.

## Risks and execution

The riskiest assumption is native delivery/lifecycle behavior: source and doubles
cannot establish radio timing or actual LEDs. A write already handed to the OS
cannot be recalled. Background suspension may delay cleanup; no physical clear
is guaranteed by a disconnect. Keep the current conservative capacity policy and
require a real iPhone/Fullride session before acceptance. No storage/auth redesign
or framework decision follows from this feature.

One cohesive inline implementation bundle; no child stories needed. Effective
review weight standard from project conventions: one fresh-context feature review
after verification, then adjudication and fixes. No design advisory fanout is
needed for the bounded adapter using the established port.

## Implementation and verification (2026-09-28)

Implemented the dedicated prototype composition root, native byte transport,
pause/resume lifetime binding, pinned plugin dependencies, Bluetooth usage text
and generated SPM plugin references. Normal PWA bootstrap remains separate.
Listener disposal guards late callbacks, including failed native removal.

Verified locally: 30 native transport/runtime tests; prototype lint/typecheck;
prototype asset build and Capacitor sync; Info.plist syntax; packaged Chromium
restore/export/reload smoke; ordinary web lint/typecheck, all 664 tests and
production PWA build. Dependency installation audit reports zero vulnerabilities
for the isolated prototype package. Independent review and fix verification are
complete. [PR 29](https://github.com/andromedus1/cruxcontrol/pull/29) CI passed on
implementation head `7852b44`: web lint/typecheck, 664 tests, production build and
all browser workflows; prototype checks, build/sync and packaged browser smoke;
and the ML stub lane. [Run 36463631543](https://github.com/andromedus1/cruxcontrol/actions/runs/36463631543)
records that result. Deployment was correctly skipped for the pull request.

Three additional regressions failed against the initial adapter and now pass:
unsupported capability remains unsupported across pause/disconnect; iOS cleanup
callbacks cannot hide a connection validation error; and a failed cleanup plus
late callback cannot poison an explicit retry. Failed attempts retire their
generation before cleanup, and the cleanup serialization barrier remains usable
while individual callers still receive failures. Packaged smoke also verifies
unavailable native control, proving the prototype composition root is selected.

The development Mac still selects Command Line Tools and has no full Xcode app.
Native compilation, iPhone simulator checks and real iPhone/Fullride acceptance
have not run. These checks remain epic gates, not evidence supplied by doubles
or the packaged Chromium smoke.

## Review (2026-09-28)

**Verdict:** Approve after receiver-confirmed fixes and green CI.

**Blockers:** None unresolved. The single independent pass requested changes for
reinitializing the native manager on every reconnect, and confirmed the cleanup
callback/retry and unsupported-state failures demonstrated by the receiver.
All are fixed: preserve the manager after its first successful initialization
(retry failed initialization), retire failed connection generations before native
cleanup, keep cleanup serialization usable, and preserve unsupported capability.
The initialization assertions failed before the fix and pass with the full
30-test adapter/runtime suite afterward; lint/typecheck and build/sync also pass.

**Important / nits / rejected proposals:** None.

**Notes:** Standard weight, exactly one balanced fresh-context pass using
GPT-5.6 Sol xhigh, same harness/model class. The preferred external Claude reviewer
could not authenticate because its OAuth session expired; no external review was
claimed. Required review fallback succeeded. Receiver verified the plugin's
non-idempotent initialize and disconnect callback ordering in its pinned Swift
source and adjudicated each finding. Standard closure uses verified fixes without
a second independent pass. The independent system documentation audit found zero
issues; `doc-review-report.md` records its snapshot and scope. No native compile,
simulator, physical BLE, durable storage, or native authentication claim follows.

The bounded adapter-preparation feature is done and remains under its active
parent. The parent epic stays drafting with needs-research: outstanding native
compilation, simulator, hardware, storage, authentication and distribution work
has not been accepted or fully decomposed. Do not roll up the whole epic from
this one preparatory feature.

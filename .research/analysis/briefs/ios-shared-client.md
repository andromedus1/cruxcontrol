---
description: Read when choosing an iOS/Android client path that preserves an existing React web application and supports board BLE control.
type: brief
kind: research
provenance: agent-synthesis
updated: 2026-09-27
summary: Test a Capacitor native shell and BLE transport before considering a React Native UI migration. Electron targets desktop; native storage, lifecycle, authentication and actual-device behavior remain proof obligations for either mobile path.
decisions_informed: [ios-client-direction, shared-library-access, native-library-preservation]
verification_status: complete
---

# One shared client with iPhone board control

## Question and position

How should an existing React/TypeScript web client gain iPhone and Android board
control while keeping product behavior shared? Compare the suggested Electron/React
Native direction with a web-preserving native shell. This is a bounded architecture
comparison, not a framework benchmark, implementation proof or store-policy review.
Sources were checked on 2026-09-27.

The companion [prior-art scout](../landscapes/ios-board-client-prior-art.md) examines
concrete projects and counterexamples. Read it alongside this framework comparison;
this brief alone is not the complete evidence for a production commitment.

{inferred: aggregate} **Test Capacitor plus a native BLE adapter first.** Its native
container accepts an existing web application, whereas React Native core components
create native platform views. For an existing DOM-based interface, retaining the web
renderer avoids that particular migration. This does not establish a lower total
maintenance cost or successful device operation. [ios-capacitor]{1} [ios-react-native]{2}

## Options

| Option | Source-supported capability | Consequence for this decision |
|---|---|---|
| Electron | JavaScript/HTML/CSS desktop applications on Windows, macOS and Linux. [ios-electron]{3} | `extends`: does not supply the proposed iOS/Android delivery path. It is separate from React Native. |
| React Native + a native BLE library | React drives native mobile views; BLE PLX documents discovery, connections and characteristic writes. [ios-react-native]{2} [ios-react-native-ble]{4} | {inferred: aggregate} A credible mobile alternative. Retain domain logic where independent of browser APIs; port UI and platform adapters. No automatic DOM/CSS or IndexedDB compatibility is established. |
| Capacitor + BLE plugin | Existing web code in a native container; the community BLE plugin documents iOS/Android discovery, connection and writes. [ios-capacitor]{1} [ios-capacitor-ble]{5} | {inferred: aggregate} A suitable first proof for preserving web UI and product logic. Its native bridge still needs contract tests and physical board acceptance. |

Safari's implementation-status entry remains unsupported for Web Bluetooth, with a
separate third-party extension bridge noted. Installing a web app does not establish
native Web Bluetooth support. [ios-web-bluetooth-status]{6}
`extends`: A custom Swift shell or third-party bridge is also possible; this comparison
does not show that Capacitor is the only path. An extension introduces its own user
installation and compatibility requirements, which have not been tested here.

## Reuse and proof boundaries

The existing `BoardByteTransport` interface already separates device I/O and state
from rendering, including reconnection and byte-batch writes. [ios-local-transport]{7}
`extends`: Keep protocol codecs, board definitions, climb/effect semantics and shared
library payloads above that boundary. A native implementation must preserve ordering,
disconnect behavior, pacing and errors, not merely expose a successful write method.

The current runtime instantiates IndexedDB repositories and a backup store over their
two databases. [ios-local-runtime]{8} Capacitor's storage guide warns about iOS
WebView storage reclamation and presents SQLite-backed alternatives.
[ios-capacitor-storage]{9} {inferred: qualifies} Reusing the UI is insufficient to
claim durable native-library support; persistence and backup need explicit verification
and possibly native repository/backup adapters. This is not a measured data-loss bug
in the existing application.

Capacitor's default iOS local origin uses the `capacitor` scheme and `localhost`.
Its external `server.url` option is documented for live reload, not production.
[ios-capacitor-config]{10} `extends`: A locally bundled shell must not inherit a
hosted same-origin login design by assumption. Prove API transport, authentication
return, session storage, allowed origins and revocation in the actual shell. Browser
cookie sharing is unverified. This can change the access-provider choice without
changing the rule that private libraries remain local.

The iOS runtime uses WKWebView and an Xcode project. [ios-capacitor-ios]{11}
`extends`: Shared application source still requires platform builds, permissions,
release/update handling and device testing. Existing service-worker update behavior,
file import/export, wake-lock behavior and app background/resume handling need a
native-platform assessment; unchanged browser code is not a portability guarantee.

## Disconfirming analysis

- Capacitor's own storage warning limits its reuse convenience. A thin shell could
  grow substantial native persistence work; compare that against React Native before
  committing. [ios-capacitor-storage]{9}
- React Native has a documented BLE ecosystem; reject neither its hardware access nor
  shared-code potential. The fetched BLE PLX compatibility table is limited and must
  not be generalized to all current framework versions. [ios-react-native-ble]{4}
- Native Safari Web Bluetooth absence is not absence of every iOS web bridge: the
  implementation-status page explicitly identifies an extension alternative.
  [ios-web-bluetooth-status]{6}
- The Capacitor BLE plugin requires actual iOS hardware for Bluetooth testing; its
  simulator path does not prove the connection. [ios-capacitor-ble]{5}
- `extends`: No supplied source measures this application's responsiveness, packet
  delivery, library survival, native sign-in, or distribution suitability. No rewrite
  percentage, delivery date, zero-native-code promise, or vendor lock-in comparison
  follows from the documentation.

## Contradictions

| Sources / relationship | Positions and consequence |
|---|---|
| [ios-capacitor]{1} / [ios-capacitor-storage]{9} — **qualifies** | General web-project reuse coexists with specific persistence caveats. Retain both; wrapping the app is not sufficient evidence of storage reliability. |

## Next decision evidence

`extends`: Before selecting a production shell, prove connection/light/clear,
disconnect/reconnect, permissions denial and foreground/background recovery on an
iPhone and the real board. Preserve the existing foreground-only animation policy.
Prove a synthetic local climb and ordered playlist across relaunch/update and a
whole-library export/restore. Preserve existing phone data and origin during any
migration. Then prove native shared sign-in/API access before resuming that feature's
implementation. Distribution and supported OS/device versions need their own concrete
checks; this brief does not promise App Store acceptance.

## Revisions

- 2026-09-27 — **Correction:** add navigation to the companion prior-art scout.
  The first-proof recommendation is unchanged; the scout informs its acceptance
  criteria and does not establish a production framework selection.
- Standard verification: independent adversarial review covered all eleven source
  attestations and reopened the external and local sources. Its focused second pass
  approved the corrections below. Lead spot checks covered the storage warning,
  native origin, BLE capabilities and rendering distinction. Final citation lint
  resolves 19 citations with no broken or thin sources; the negated exclusivity
  sentence is a comparative-superlative pattern false positive.
- 2026-09-27 — **Correction:** remove the rendering-model row from Contradictions;
  those are comparable alternatives, not incommensurable claims. Their distinction
  remains in Options. Extend the BLE PLX attestation with the Compatibility anchor
  and finite table entries that ground the version-coverage qualification. The
  Capacitor-first proof recommendation is unchanged.

## Sources

1. **ios-capacitor** — Capacitor overview. https://capacitorjs.com/docs
2. **ios-react-native** — Core Components and Native Components. https://reactnative.dev/docs/intro-react-native-components
3. **ios-electron** — Electron introduction. https://www.electronjs.org/docs/latest
4. **ios-react-native-ble** — React Native BLE PLX. https://github.com/dotintent/react-native-ble-plx
5. **ios-capacitor-ble** — Capacitor Community BLE plugin. https://github.com/capacitor-community/bluetooth-le
6. **ios-web-bluetooth-status** — Web Bluetooth implementation status. https://github.com/whatwg/bluetooth/blob/main/implementation-status.md
7. **ios-local-transport** — `web/src/board-control/transport.ts`, BoardByteTransport.
8. **ios-local-runtime** — `web/src/app/create-runtime.ts`, runtime composition.
9. **ios-capacitor-storage** — Capacitor storage guide. https://capacitorjs.com/docs/guides/storage
10. **ios-capacitor-config** — Capacitor configuration, server schema. https://capacitorjs.com/docs/config
11. **ios-capacitor-ios** — Capacitor iOS documentation. https://capacitorjs.com/docs/ios

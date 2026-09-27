---
description: Read before committing to a shared web and native climbing-board client; compares concrete Capacitor, React Native and Safari-extension prior art and the evidence each leaves unresolved.
type: landscape
kind: research
provenance: agent-synthesis
updated: 2026-09-27
summary: Grip Connect provides a Capacitor Aurora BLE implementation and a React Native alternative. Boardsesh moved from Capacitor to React Native and reports responsiveness improvements, but retains custom iOS BLE and distinct storage/auth paths. These examples justify a broader device proof, not a framework commitment.
key_findings:
  - Boardsesh's native rewrite is counterevidence to assuming that web UI reuse guarantees satisfactory mobile responsiveness; its release notes are not a controlled framework benchmark.
  - Grip Connect implements Aurora writes with the proposed Capacitor BLE plugin, while also supplying a React Native adapter; source availability does not prove Fullride acceptance.
  - Bluetooth write semantics, persistence, credentials and native releases remain explicit platform work in concrete prior art.
  - A Safari extension offers another path to investigate, with installation and compatibility obligations that remain untested for this application.
verification_status: complete
---

# Shared mobile board clients: prior-art scout

## Scope and evidence limits

This scout maps examples relevant to adding iPhone and Android BLE control to an
existing React web application. It covers climbing-board products, reusable BLE
adapters, and the storage/authentication seams around them. It does not select a
framework. Sources were fetched on 2026-09-27; repository observations are pinned
where possible. No external application was built, benchmarked or tested on a board.

## Representative prior art

| Project | Observed evidence | Transferable lesson and limit |
|---|---|---|
| Boardsesh | Its contributor guide describes Next.js web, React Native/Expo mobile and shared packages. Its 2.0 release notes describe a native rewrite with improved scrolling/search; a repair PR identifies the earlier Capacitor app. [scout-boardsesh-architecture]{1} [scout-boardsesh-release]{2} [scout-boardsesh-write-regression]{4} | {inferred: aggregate} A domain-matched reason to test responsiveness before retaining a web renderer. The developer's release claims do not isolate framework effects from changes in UI, data access or other code. |
| Grip Connect | The Capacitor Aurora adapter extends its core board class and uses `@capacitor-community/bluetooth-le` for connection and without-response writes. It also publishes a React Native adapter using BLE PLX. [scout-grip-capacitor]{5} [scout-grip-react-native]{7} | {inferred: aggregate} A concrete example of sharing board logic across native transports. Neither source demonstrates this application's board, effects policy or library-preservation guarantees. |
| Beacio / iOSWebBLE | The current SDK documents a Safari extension, user-enabled installation, and a without-response write option. The older repository URL redirects to Beacio. [scout-webble-core]{8} | `extends`: An alternative experiment for a small invited group willing to install an extension. Safari-tab behavior, installed-PWA compatibility, board writes and ongoing dependency suitability require checking before adoption. |

Grip Connect's Capacitor demo is a Vite-based device connection/streaming example;
the documented picker focuses on force/training devices. The Aurora adapter is
separate code evidence, not an end-to-end Fullride demonstration in that example.
[scout-grip-examples]{6} [scout-grip-capacitor]{5}

## What the implementations reveal

### Native UI does not remove native integration work

Boardsesh's factory selects a custom Swift-backed iOS adapter, with a comment
explaining its Live Activity needs; Android uses its BLE PLX adapter. Capability
checks guard newer native behavior. [scout-boardsesh-native-ble]{3}
`extends`: This is evidence that native modules remain part of a shared-code app,
not evidence that foreground-only board control requires Boardsesh's lock-screen
architecture. Copying that larger design would import requirements outside this
scout's question.

### A connection is weaker evidence than correctly delivered commands

Boardsesh PR #3228 reports an Aurora regression where the phone connected but
acknowledgment-dependent writes stalled. Its fix restored Aurora's without-response
path, distinguishing another board's needs. The PR test plan still marked physical
confirmation pending; it also required a new native binary. [scout-boardsesh-write-regression]{4}
`extends`: Hardware acceptance should observe the actual holds, repeated sends,
clear, interruption and recovery. Successful promise resolution or an illuminated
controller status LED is insufficient. Do not infer one write policy for every board.

In Grip Connect's Aurora adapter, the disconnect callback logs the identifier,
and an absent device makes `write` return without sending.
[scout-grip-capacitor]{5} `extends`: Learn from the bridge shape; importing the
complete library would still require reconciling error, connection and delivery
semantics. Source inspection is not a reason to replace working protocol code.

Boardsesh also supplies an ESP32 board emulator with connection/send instructions.
[scout-boardsesh-architecture]{1} `extends`: An emulator can help exercise the
mobile bridge during development; it cannot establish real controller timing or
visible-hold correctness.

### Offline data and sign-in need their own platform boundaries

Boardsesh's mobile package has a native database hook that uses Expo SQLite and
handles replacement database connections; its Expo-web variant documents a shim
without offline SQLite. These files do not establish the separate Next.js app's
database behavior.
[scout-boardsesh-offline]{9} [scout-boardsesh-web-database]{10}
Its native credential store uses secure-store helpers, while the mobile package's
Expo-web variant uses an HttpOnly session cookie and an in-memory backend token.
[scout-boardsesh-auth]{11} [scout-boardsesh-web-auth]{12}
`extends`: Shared product logic can coexist with different persistence and auth
adapters. These examples do not establish equivalent offline guarantees across
platforms or validate a different service's sign-in flow.

Capacitor's storage guide warns that WebView storage, including IndexedDB on iOS,
can be reclaimed and identifies SQLite options. [ios-capacitor-storage]{13}
`extends`: Treat durable authored data and whole-library recovery as admission
requirements for a native client. A successful ordinary relaunch test alone cannot
disprove storage eviction risk.

## Disconfirming analysis

- **Against a simple Capacitor endorsement:** Boardsesh's developer reports a native
  rebuild addressing prior lag; its former Capacitor implementation is explicitly
  identified in a repair PR. This warrants UI performance testing but does not prove
  a Capacitor limitation for another application's screens. [scout-boardsesh-release]{2}
  [scout-boardsesh-write-regression]{4}
- **Against an immediate React Native rewrite:** Grip Connect implements the proposed
  Capacitor BLE path, and Boardsesh's repair describes functioning native BLE in its
  earlier Capacitor app. Bluetooth capability alone does not distinguish these
  choices. [scout-grip-capacitor]{5} [scout-boardsesh-write-regression]{4}
- **Against treating React Native as a reliability guarantee:** Boardsesh's native
  releases still report board-write and UI fixes. Its platform factory includes
  custom iOS integration. [scout-boardsesh-release]{2} [scout-boardsesh-native-ble]{3}
- **Against framing a packaged shell as mandatory:** the Safari extension documents
  another bridge. Its install requirement remains, and no board/PWA acceptance
  evidence was obtained here. [scout-webble-core]{8}
- **Against equating source examples with product proof:** the documented Grip
  demo is narrower than an offline climb library, and Boardsesh's native/Expo-web
  database variants differ. [scout-grip-examples]{6} [scout-boardsesh-offline]{9}
  [scout-boardsesh-web-database]{10}

## Contradictions

| Sources / relationship | Positions held separately |
|---|---|
| [scout-boardsesh-release]{2} / [scout-grip-capacitor]{5} — **qualifies** | A shipped project's developer reports benefits from a native rebuild; another project implements board BLE with a Capacitor adapter. The latter supports implementation feasibility, not adequate UI responsiveness. The former does not establish universal failure of the adapter's framework. |
| [scout-boardsesh-offline]{9} / [scout-boardsesh-web-database]{10} — **qualifies** | Native SQLite recovery exists; the mobile package's Expo-web variant explicitly has no offline SQLite. Do not merge them into a claim of identical offline behavior or generalize these files to the separate Next.js app. |

## Research questions before commitment

`extends`: The landscape suggests a device comparison driven by observable product
behavior, not a larger framework feature matrix:

1. Can the existing renderer and library screens remain responsive on the intended
   iPhone during selection, scrolling, editing and foreground board effects?
2. Can a native adapter preserve command ordering, write mode, pacing, cancellation
   and reconnect behavior on the actual controller, including permission denial?
3. What native persistence strategy protects authored climbs and ordered playlists,
   and can backups preserve IDs, memberships and recipes across app updates?
4. Can the chosen identity flow return to the app, authenticate requests and revoke
   access without inheriting browser-cookie assumptions?
5. Can the intended friends install and update signed builds through a sustainable
   distribution path? This scout does not resolve signing or App Store requirements.

No source here provides a controlled Capacitor/React Native comparison for those
requirements. Physical evidence and an explicit acceptance threshold remain missing.
No inaccessible source blocked the claims retained above. Further reading can start
with the linked source repositories and their adapter/recovery tests; no additional
work items or acquisition queue are emitted by this scout.

## Verification

Standard verification completed: citation lint resolves 31 citations across 13
source attestations with no broken chains, thin attestations or omitted confidence
metadata. An independent adversarial reader checked jobs a–h and approved the
corrections below. Lead spot checks covered the source-pinned adapter behavior,
platform scope, developer release claims, pending hardware test and storage warning.
The version-number and named-feature lint flags have source support; neither is an
uncited claim. Verification establishes research grounding, not device acceptance.

## Revisions

- 2026-09-27 — **Correction:** distinguish the mobile package's Expo-web database
  and credential variants from Boardsesh's separate Next.js app. The inspected
  files support platform-boundary observations, not a claim about every web client
  in that repository. Source attestations carry the same scope clarification.
- 2026-09-27 — **Correction:** replace an undefined lifecycle comparison with the
  observed callback/write behavior. Add the attested ESP32 emulator as a development
  testing reference while preserving physical-board acceptance as a separate need.

## Sources

1. **scout-boardsesh-architecture** — Boardsesh contributor guide, pinned `ab9a998`. https://github.com/boardsesh/boardsesh/blob/ab9a998efde3559869a6ab9884b36e804ce5f932/CONTRIBUTING.md
2. **scout-boardsesh-release** — Boardsesh App Store version history. https://apps.apple.com/us/app/boardsesh/id6761350784
3. **scout-boardsesh-native-ble** — Platform factory, pinned `ab9a998`. https://github.com/boardsesh/boardsesh/blob/ab9a998efde3559869a6ab9884b36e804ce5f932/packages/mobile/src/lib/ble/adapter-factory.ts
4. **scout-boardsesh-write-regression** — Boardsesh PR #3228. https://github.com/boardsesh/boardsesh/pull/3228
5. **scout-grip-capacitor** — Aurora adapter, pinned `c41f516`. https://github.com/Stevie-Ray/hangtime-grip-connect/blob/c41f516cbc656f95cd8800737a499d1c942e9a23/packages/capacitor/src/models/device/aurora.model.ts
6. **scout-grip-examples** — Capacitor example documentation. https://stevie-ray.github.io/hangtime-grip-connect/examples/capacitor
7. **scout-grip-react-native** — React Native platform documentation. https://stevie-ray.github.io/hangtime-grip-connect/platforms/react-native
8. **scout-webble-core** — Beacio core README. https://raw.githubusercontent.com/wklm/beacio-sdk/main/packages/core/README.md
9. **scout-boardsesh-offline** — Native database hook, pinned `ab9a998`. https://github.com/boardsesh/boardsesh/blob/ab9a998efde3559869a6ab9884b36e804ce5f932/packages/mobile/src/db/use-offline-database.ts
10. **scout-boardsesh-web-database** — Web database hook, pinned `ab9a998`. https://github.com/boardsesh/boardsesh/blob/ab9a998efde3559869a6ab9884b36e804ce5f932/packages/mobile/src/db/use-offline-database.web.ts
11. **scout-boardsesh-auth** — Native credential store, pinned `ab9a998`. https://github.com/boardsesh/boardsesh/blob/ab9a998efde3559869a6ab9884b36e804ce5f932/packages/mobile/src/lib/auth-store.ts
12. **scout-boardsesh-web-auth** — Web credential store, pinned `ab9a998`. https://github.com/boardsesh/boardsesh/blob/ab9a998efde3559869a6ab9884b36e804ce5f932/packages/mobile/src/lib/auth-store.web.ts
13. **ios-capacitor-storage** — Capacitor storage guide, re-fetched in this engagement. https://capacitorjs.com/docs/guides/storage

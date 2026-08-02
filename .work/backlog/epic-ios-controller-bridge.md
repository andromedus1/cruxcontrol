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
created: 2026-08-02
updated: 2026-08-02
---

# iOS Controller Bridge

## Brief

Enable direct board control from iPhone/iPad despite WebKit's lack of Web Bluetooth,
without forking CruxControl's domain, catalog, or product behavior. The likely shape
is a narrow native CoreBluetooth transport bridge around the shared controller
profile contract; the exact shell and web/native integration require research.

The PWA remains fully useful for browsing, editing, playlists, and logbook use on iOS
without this epic. This work becomes release-critical only when native iPhone board
control is explicitly prioritized.

## Research gate

Before decomposition, compare a minimal native shell, Capacitor-style bridge, and
other maintainable WebView/CoreBluetooth integration paths. Verify App Store,
lifecycle, secure-origin, offline storage, and shared-code implications.

## Design decisions

- **Delivery status**: deferred. Andrew is an Android user; iPhone friends do not make
  iOS browse support or native board control part of the first milestone. Preserve the
  transport seam, but do not research or implement this epic during the first autopilot
  run. — confirmed 2026-08-02.

## Anticipated child features

Deferred until the research gate is complete and iPhone control is prioritized.

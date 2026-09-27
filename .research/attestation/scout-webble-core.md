---
source_handle: scout-webble-core
fetched: 2026-09-27
source_url: https://raw.githubusercontent.com/wklm/beacio-sdk/main/packages/core/README.md
provenance: source-direct
substrate_confidence: source-direct
---

# Beacio Web Bluetooth Safari bridge

## Anchored observations (paraphrased)

### Safari iOS setup checklist / iOS Safari note

The current package is named `@beacio/core`. Its setup requires installing and
enabling a Safari extension and calling device selection from a user gesture.
The old `wklm/ioswebble-sdk` repository URL redirects to `wklm/beacio-sdk`.

### Writes and MTU-aware chunking / Connection lifecycle

The documented write API defaults to with-response and allows an explicit
without-response mode. The guide describes connection cleanup and retry helpers.
The fetched documentation establishes a third-party Safari bridge proposal; it
does not supply a climbing-board hardware test or a guarantee for installed PWA
execution. Broad portability slogans are not treated as measured compatibility.

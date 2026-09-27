---
source_handle: scout-boardsesh-architecture
fetched: 2026-09-27
source_url: https://github.com/boardsesh/boardsesh/blob/ab9a998efde3559869a6ab9884b36e804ce5f932/CONTRIBUTING.md
provenance: source-direct
substrate_confidence: source-direct
---

# Boardsesh architecture

## Anchored observations (paraphrased)

### Introduction

The contributor guide describes a Next.js web app, React Native/Expo mobile app,
and GraphQL-WS backend in one monorepo, with shared packages under `packages/shared/`.
It identifies mobile as the main area of active development.

### Testing BLE end-to-end with an ESP32

The repository supplies firmware to emulate climbing-board BLE devices. The guide
instructs a tester to pair from a phone/browser, queue a climb and send it; it also
notes iOS/macOS scan caching. These are testing instructions, not a published
physical acceptance result for every supported board.

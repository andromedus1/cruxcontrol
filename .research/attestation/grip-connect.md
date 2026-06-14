---
source_handle: grip-connect
fetched: 2026-06-13
source_url: https://github.com/Stevie-Ray/hangtime-grip-connect
provenance: source-direct
---

# Stevie-Ray/hangtime-grip-connect — Web Bluetooth client for climbing hardware

## Summary

A TypeScript Web Bluetooth client for force-sensing and LED climbing hardware,
including Aurora Climbing LED-system boards (the Kilter Board). It offers a
unified connect/notify/stream API across devices and targets four platforms:
Web (Web Bluetooth API core), Capacitor (hybrid mobile), React Native (native
mobile), and a Node/Bun/Deno runtime adapter. The canonical reference
implementation for driving a Kilter board over Web Bluetooth from TypeScript.

## Key passages

- Kilter support: "And LED system boards with a controller box from Aurora Climbing like the Kilter Board."
- Platforms: Web — "The core package for web applications using the Web Bluetooth API"; Capacitor — "For hybrid mobile apps using Capacitor"; React Native — "For native mobile apps using React Native"; Runtime — "Adapter for Node.js, Bun, and Deno."
- Unified API: "All devices provide some default features such as connect, isConnected, and disconnect."

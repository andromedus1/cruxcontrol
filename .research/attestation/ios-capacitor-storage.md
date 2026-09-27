---
source_handle: ios-capacitor-storage
fetched: 2026-09-27
source_url: https://capacitorjs.com/docs/guides/storage
provenance: source-direct
substrate_confidence: source-direct
---

# Capacitor — Storage

## Anchored observations (paraphrased)

### Why can't I just use LocalStorage or IndexedDB? / Large data or high performance storage options

Web storage is available in the WebView, but the guide warns that the operating system may reclaim local storage and applies that warning to IndexedDB on iOS. It presents SQLite-backed options for larger or more demanding storage. It does not demonstrate a particular application's persistence, migration, or recovery guarantees.

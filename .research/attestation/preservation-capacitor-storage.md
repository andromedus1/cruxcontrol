---
source_handle: preservation-capacitor-storage
fetched: 2026-10-09
source_url: https://capacitorjs.com/docs/guides/storage
provenance: source-direct
substrate_confidence: source-direct
---

# Capacitor v8 storage guidance

## Anchored observations

**Why not LocalStorage or IndexedDB / large data:** The guide warns that WebView LocalStorage can be reclaimed under low-storage pressure and extends the IndexedDB warning to at least iOS. It explicitly distinguishes Android, where the persisted storage API can mark IndexedDB as persisted. It describes native Preferences for small data and SQLite options for larger or higher-performance storage.

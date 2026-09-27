---
source_handle: scout-boardsesh-web-database
fetched: 2026-09-27
source_url: https://github.com/boardsesh/boardsesh/blob/ab9a998efde3559869a6ab9884b36e804ce5f932/packages/mobile/src/db/use-offline-database.web.ts
provenance: source-direct
substrate_confidence: source-direct
---

# Boardsesh web database variant

## Anchored observations (paraphrased)

### useOfflineDatabase / Expo-web fork comment

The Expo-web variant of the mobile package returns the SQLite context. Its comment
says Expo SQLite is aliased to a web shim, the browser has no offline SQLite and no native replacement handle is
published. The existence of the native SQLite path therefore does not establish
equivalent offline behavior in this web variant. This file does not describe the
separate Next.js application's database implementation.

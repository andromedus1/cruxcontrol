---
id: epic-catalog-sync-device-update-native
kind: story
stage: implementing
tags: [data, security]
parent: epic-catalog-sync-device-update
depends_on: []
release_binding: null
gate_origin: null
created: 2026-10-20
updated: 2026-10-20
---

# Native private catalog plugin and same-origin serving

## Brief
Android `PrivateCatalog` plugin (check/prepare with the native Firebase session,
verified private storage) and `CatalogAssetWebViewClient` serving
`/catalog/private/...`, with JVM tests.

## Implementation
Parent feature, Unit 1.

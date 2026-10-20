---
id: epic-catalog-sync-device-update-service
kind: story
stage: done
tags: [data]
parent: epic-catalog-sync-device-update
depends_on: [epic-catalog-sync-device-update-native]
release_binding: null
gate_origin: null
created: 2026-10-20
updated: 2026-10-20
---

# Catalog service update flow

## Brief
`CatalogUpdateSource` contract, bootstrap base path, service update state machine with
cadence, dismissal, downgrade/layout refusal, native adapter and runtime wiring.

## Implementation
Parent feature, Unit 2.

## Evidence
- `web/src/catalog/update-source.ts` (contract, `noCatalogUpdates`, bounded
  `CatalogUpdateError`, local-storage preferences), bootstrap base path
  (`/catalog/` | `/catalog/private/`), service `update` state with
  `checkForUpdate({ force })`, `installUpdate()`, `dismissUpdate()`, remote-first
  first install; `prototypes/ios/src/native-private-catalog.ts`, Android runtime wiring
  and foreground-resume check; web runtime defaults to `noCatalogUpdates`.
- Tests: service 33/33 (14 new update cases), bootstrap 11/11 (2 new), update-source
  3/3, native adapter 3/3, prototype runtime 9/9; web + prototype lint and typecheck clean.
- Stale fixtures updated (type-only): catalog service fakes in
  `CatalogBrowser`/`CatalogManageDialog`/`CruxControlWorkspace`/`create-runtime` tests
  gained the `update` snapshot field and the three new methods.

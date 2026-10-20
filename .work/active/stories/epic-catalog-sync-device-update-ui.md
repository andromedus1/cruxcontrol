---
id: epic-catalog-sync-device-update-ui
kind: story
stage: done
tags: [ui]
parent: epic-catalog-sync-device-update
depends_on: [epic-catalog-sync-device-update-service]
release_binding: null
gate_origin: null
created: 2026-10-20
updated: 2026-10-20
---

# Update banner and Manage controls

## Brief
Catalog banner and Manage dialog states for available, installing, failed, up to date,
signed out and unconfigured, with component tests.

## Implementation
Parent feature, Unit 3.

## Evidence
- `CatalogBrowser.tsx`: update banner ("New catalog: 1,261 new climbs · 23 removed ·
  Later · Install"), polite status text (silent during progress, which the shared status
  line announces), progress bar, failure with Retry; hidden after Later until a newer
  version; catalog open runs the cadence-gated check.
- `CatalogManageDialog.tsx`: "Catalog updates" region with installed vs available
  version and build dates, counts and size, Install version N / Retry update, Check now,
  last checked, up to date, checking, check error, signed-out hint; hidden when
  unconfigured (web/PWA). Download progress names the offered version and its size.
- `presentation.ts`: `catalogUpdateSummary`; `catalog.css` banner and section styles
  (no mockup: composes the existing catalog row, consent and alert patterns, per the
  epic's mockup plan).
- Tests: CatalogBrowser 17/17 (4 new), CatalogManageDialog 9/9 (4 new), presentation
  6/6 (1 new); lint and typecheck clean.

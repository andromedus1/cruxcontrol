---
id: story-phone-animation-adoption
kind: story
stage: implementing
tags: [data, ble]
parent: null
depends_on: [epic-build-effects-hardening]
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
---

# Upgrade Andrew's saved background animations before dogfooding

## Brief and authorization

Andrew explicitly authorized upgrading all his existing climbs with background
animations after the software work completes and before dogfooding, conditional on
the new versions keeping the same light cost and preserving his chosen colors.
The connected phone uses CruxControl at http://localhost:4173/. A read-only snapshot
found 27 climb/draft records and 4 playlists; a validated complete backup is saved
outside Git in Andrew's Downloads. Do not commit library contents or device identifiers.

## Execution and acceptance

After the reviewed software arc is complete, take and validate a fresh complete
backup before any mutation. Inspect the actual recipes and use upgradeSpatialPreset
for supported v1 spatial groups, preserving palette, footprint, IDs, assignments,
seed, recipe controls, target masks, intensity, memberships and lifecycle metadata.
Only recipeVersion and the helper's longer period may change. Preserve all records,
including Trash and other installations. Already-v2 and assignment effects are no-ops.
Confirm the same saved footprint and 20-light/2-FPS profile before applying; do not
increase capacity or silently reduce climb holds. Validate a dry-run full-library
diff and write only matching original records in one existing-store transaction,
with fresh-state conflict checks. Verify stored results and a post-migration backup.
Reload/reconcile the app only at a safe idle boundary so an old in-memory recipe
cannot overwrite the upgrade. Report actual changed climb/effect counts and recovery
file locations, without claiming physical board dogfooding.

## Simplification opportunity

Use the existing pure upgrade helper and IndexedDB schema; no new permanent bulk
migration feature, storage replacement, or UI is needed for this authorized operation.
Standalone story receives bounded inline verification/review. This operational
follow-through depends on the software epic and does not reopen its feature reviews.

---
id: story-phone-animation-adoption
kind: story
stage: done
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

## Dry-run evidence

The captured library contains 18 v1 spatial effects across 18 of 27 climbs, using
Beach Ball, Bird Flock, Snake, Matrix, Pentagram and Pac-Man. Running the actual
upgradeSpatialPreset helper on an isolated copy preserves every palette and footprint
exactly; reversing only version and period reproduces the complete original JSON.
All four playlists are byte-equivalent as objects. Both backup payloads validate.
An isolated Chromium IndexedDB rehearsal applies all 18 records in one transaction,
verifies the complete result, rejects a stale snapshot without writes, and rejects an
unapproved field change before mutation. Phone records remain unchanged at this stage.

## Device availability boundary

The phone entered Dozing and Chrome USB debugging stopped responding reliably;
waking the screen briefly restored the endpoint but exposed no CruxControl target.
Andrew has been asked to unlock the phone, open CruxControl and leave it visible.
No live library mutation, worker activation or navigation has been performed.
Do not mark this operation complete from the dry run. Resume from a fresh backup
and verified idle app state once the device is available. The software correction
is verified at ecb3093 with green CI 34004335389; this external device prerequisite
does not reopen its completed reviews or block the software merge.

## Completed phone adoption and bounded inline review

Device availability returned with CruxControl visible. The software shipped in
merged PR13 (b26dcd4); main CI 34004896618 passes all checks. The new worker installed
and subsequently activated after an initial activation wait timed out; no recipe
writes occurred until the reviewed module index-B5CO5u5U.js was verified running.
The phone's native screen wake lock was held during maintenance, scoped to those
page lifetimes. No persistent device power setting was changed.

The fresh library had 17 v1 spatial effects and one already upgraded effect. After
leaving a saved, disconnected editor through Back, a fresh validated backup was saved.
The script-free same-origin maintenance page disposed app state. A fresh-state guarded
transaction upgraded those 17 records using upgradeSpatialPreset. All 27 climb IDs remain present. Assignments, authored colors, light footprints
and all four playlists exactly match the fresh pre-write snapshot; all 18 spatial
effects are now v2. One preset had already been replaced before the batch, so the
earlier exploratory backup is not used to overwrite that newer authored choice. Comparing the complete result against the
fresh pre-write snapshot allows only the intended version and period changes.
Already-current effects were left alone. Every other raw field remained unchanged.

Native Chrome online reload, offline reload and return-online reload all open the
reviewed app at http://localhost:4173/ with an activated controller, no waiting worker,
and exact persisted library contents. Keep screen awake is present; the temporary
maintenance wake lock ends on navigation. Physical BLE board dogfooding remains the
user's next acceptance activity, not a claimed automated result.

Bounded inline standalone-story review: approve. The actual helper dry run, native
IndexedDB rehearsal (including stale-snapshot abort), fresh before/after backup decode,
full raw-record comparison and real phone offline reload verify the operational
contract. No independent story reviewer or new application code was needed. The earlier
device availability prerequisite is resolved; no blocker remains.

Recovery artifacts are user-local and excluded from Git:

- Before: `/Users/andrewclark/Downloads/cruxcontrol-phone-before-animation-upgrade-20260906T020435079Z.json`
- After: `/Users/andrewclark/Downloads/cruxcontrol-phone-after-animation-upgrade-20260906T020435249Z.json`

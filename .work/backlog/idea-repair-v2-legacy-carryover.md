---
id: idea-repair-v2-legacy-carryover
created: 2026-10-20
updated: 2026-10-20
tags: [data]
---

Published catalog v2 (2026-10-20) was built before the epic-review fixes in
`epic-catalog-sync` (archived; full record at `77a4a72`). Measured against a fixed
rebuild of the same reconciliation: 46 stat rows of the 23 climbs carried from the
legacy v1 catalog keep Aurora 1–3 ratings inside the 0–5 artifact, and 3 previously
usable (climb, angle) stats pairs were not preserved. Later builds reconcile against v2
and would keep both forever. No current user impact: Andrew's playlists reference no
catalog climbs yet.

Proposed one-time repair (from the session that found it): the publisher also downloads
v1 (already in the private bucket) as a legacy baseline; reconciliation rescales ×5/3
only carried or kept rows whose values still exactly equal the unscaled v1 values, and
restores v1 pairs missing for app-visible climbs. Idempotent after one run; the
corrected version reaches the phone through the normal update prompt. Do this before
catalog climbs are added to playlists.

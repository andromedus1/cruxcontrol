---
source_handle: kcs-boardsesh-docs-legacy
fetched: 2026-10-19
source_url: https://github.com/boardsesh/boardsesh/blob/3340422a27c42e576207ada906c34a5c0c5ab4be/docs/kilter-sync.md
provenance: source-direct
substrate_confidence: source-direct
---

# Boardsesh project docs on the Aurora/Kilter split (third-party maintainer documentation, repo marcodejongh/boardsesh -> boardsesh/boardsesh)

## docs/kilter-sync.md
- Intro: "The @boardsesh/kilter-sync package is a separate top-level package from @boardsesh/aurora-sync because Kilter Grips split from Aurora Climbing's backend and the two transports have nothing in common at the wire level". Comparison table: Aurora (Kilter pre-split, Tension) = username/password login -> opaque session token, REST /sync long-poll with _complete pagination, catalog bundled in /sync; Kilter Grips = Keycloak OAuth2 (PKCE), PowerSync /sync/stream NDJSON, catalog via separate streams / REST.
- "aurora-sync wrote its circuits keyed on aurora_id until it was switched off for Kilter on 2026-03-30".
- "(`board_shared_syncs` shows placements last synced 2024-06-22)" for the legacy snapshot of placements; three Grips climbs use holes (ids 4488-4556) whose placements postdate that legacy snapshot (Grips layout 30), remap fails -> "unplaceable_hole" (tracked boardsesh issue 5505).
- Layout mapping: "Grips ships finer layout granularity than the legacy catalog, so many Grips layouts collapse onto one board_layouts row (six 'Kilter Board Original' variants -> layout_id=1)".
- "Grips inherited Aurora's climb UUIDs, so ~80% of climbs already exist as their own canonical" (UUID-first dedup).
- Historical: two upstream count columns, "aurora_ (from the pre-split kilterboardapp.com) and kilter_ (from kiltergrips.com), holding the same logs Kilter migrated between the two backends".
(New-app catalog endpoints GET /api/climbs/all/{productLayoutUuid}, /api/climb-stat/all/{...}, /api/climbs/delteduuids are described there; they belong to the sibling facet.)

## docs/aurora-sync.md
- "The Aurora API sync no longer syncs the Kilter board (Kilter syncs only via Kilter Grips); it serves Tension and the other direct-Aurora boards."
- "Since the Kilter backend has been shut down, API-based sync is no longer available for Kilter users. As an alternative, users can import their data from Aurora's JSON export file."
- "this daemon syncs every Aurora board except Kilter".
- "Aurora only re-sends rows it changed" (cursored stats).

## docs/board-snapshots.md and manifest
- Snapshots: one SQLite artifact per (boardType, layoutId); nightly export 07:15 UTC; "kilter:1 as published on 2026-10-10 (387,101 climbs, 372,669 stats, 356,680 grades)"; build/upload logs carry `deletionsReplayFrom` (corrected 2026-10-19: not a manifest-entry field; the saved v1-gzip manifest entries contain no such key).

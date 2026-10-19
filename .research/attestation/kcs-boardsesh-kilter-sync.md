---
source_handle: kcs-boardsesh-kilter-sync
fetched: 2026-10-19
source_url: https://github.com/boardsesh/boardsesh/blob/3340422a27c42e576207ada906c34a5c0c5ab4be/docs/kilter-sync.md
provenance: source-direct
substrate_confidence: source-direct
---

# Boardsesh docs/kilter-sync.md at commit 3340422a27c42e576207ada906c34a5c0c5ab4be (repo HEAD fetched 2026-10-19; commit authored 2026-10-19T14:29:53Z)

## Key passages (paraphrase/quotes)
- Kilter Grips runs its own backend (Keycloak OAuth2 + PowerSync + REST) separate from Aurora; Boardsesh has separate packages kilter-sync and aurora-sync.
- Catalog sync (Flow A): reference pull over PowerSync global + global_gyms (products, product_layouts, holds, difficulty_grades); each Grips productLayoutUuid ("a small int-string like \"27\"") resolved to integer board_layouts.id by product name; "many Grips layouts collapse onto one board_layouts row (six 'Kilter Board Original' variants -> layout_id=1)".
- Catalog REST: `GET /api/climbs/all/{productLayoutUuid}` (full per-layout array, no pagination) and `GET /api/climb-stat/all/{productLayoutUuid}`; stats shape {climbUuid, angle, ascentCount, currentDifficultyId, difficultyAverage, qualityAverage, faUsername, faAt}; deletions `GET /api/climbs/delteduuids` returns string[] (mixed casing). Wire JSON camelCase. The climbdetails/{productName}/edges route 404s. Across 19 listed layouts catalog ~424k climbs; ~80% already existed in board_climbs by UUID (case-insensitive).
- ID mapping: Grips climb_concat format `h{holeId}p{code}[s{start}][e{end}]` rewritten to legacy Aurora frames format `p{placementId}r{code}` using board_placements(layout_id, hole_id)->id; "verified 366/366 in Phase 0" byte-identical board_climb_holds/hold_fingerprint; multi-frame: 141/141 semantic parity on multi-frame climbs (78 byte-identical) over 86,054 climbs compared (2026-07-25). Delta frames start with a quote char; absolute frames do not; Boardsesh emits pure delta.
- Dedup: UUID-first ("Grips inherited Aurora's climb UUIDs"); a new UUID whose (layout_id, hold_fingerprint) matches an existing canonical becomes an alias in board_climb_aliases rather than a new board_climbs row. Stats from aliases are summed onto the canonical.
- Skips: climbs that cannot be mapped go to board_climb_ingest_skips (reasons unplaceable_hole, unparsable_concat, frame_out_of_range); known gap: post-2024 hold-set placements (Grips layout 30, holes 4488-4556) lack legacy placement rows (3 climbs; issue #5505). Mis-tagged-layout reroute fallback (8 live climbs on 2026-09-15).
- Deletions: deletion pass via delteduuids, report-only by default/gated; on 2026-09-15 /climbs/all still returned 124 climbs that the same run's deletion pass unlisted; unlisting is a flag (is_listed), not row removal. ~24 climbs carry 2026-07-07 Aurora migration baseline as updated_at.
- Cadence: kilter-catalog-sync job every 6 hours at :23; full catalog pull takes ~43 minutes; cooldown 50 min; REST client honours Retry-After up to 5 min, else fails as rate_limited. The sync uses a refresh-grant token from the most recently successful active linked Kilter credential (a donor user's) else a test account; OAuth handshake is a user-linking flow (PKCE, scope openid offline_access) gated by a PostHog flag.
- Stats: Boardsesh stores upstream_ascensionist_count (from Kilter) separately from boardsesh_ascensionist_count; materialized ascensionist_count is their sum. Historical: separate aurora_ and kilter_ upstream counts folded by GREATEST (Aurora->Kilter log migration). Quality scale normalized to 1-5.
- Counting: Kilter's app count looks like (climb, angle) pairs, ~2x distinct climbs (Homewall 8x12: 18,335 climbs vs 36,000 stat rows, measured 2026-09-15; layout_id 8).
- Push-back to Kilter not wired.


## Additional verbatim passages (docs/kilter-sync.md at 3340422a, re-fetched raw 2026-10-19)

- Deletions: "Deletion reconciliation (`sync/deletions.ts`) via `GET /api/climbs/delteduuids` — gated, report-only by default. The deletion list is fetched once per run … A failed or empty fetch leaves it null, which disables both … — an absent list is not evidence that nothing was deleted."
- Quality scale: "Kilter Grips reports `quality_average` on a 1–5 scale (MoonBoard too), but Aurora reports 1–3. … every writer stores 1–5: aurora-sync normalises its writes via `normalizeQualityTo5` (`×5/3`, continuous …); Kilter Grips and Boardsesh-tick quality are already 1–5 and stored as-is." A migration scales Aurora-sourced 1–3 rows ×5/3, excluding Grips-touched rows and Boardsesh-owned climbs.
- Counts: historically the materialized total "took `GREATEST(kilter_, aurora_)`"; `repair-stats` "re-fetches every listed Grips layout, dedupes stats … and overwrites `upstream_ascensionist_count` from the deduped value".
- Schedule table: "`kilter-catalog-sync` | `routine-provider` | Hourly at :23: the catalog, the weekly stats repair and history snapshot". (Elsewhere the same document describes a 6-hourly catalog sync.)

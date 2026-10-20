---
provenance: agent-synthesis
updated: 2026-10-19
facet: third-party-clients
campaign: kilter-current-catalog-sources
---

# Third-party Kilter clients and public datasets

Repo state examined: `boardsesh/boardsesh`, `main`, commit `3340422a27c42e576207ada906c34a5c0c5ab4be` (authored 2026-10-19T14:29:53Z; repo license Apache-2.0 per GitHub API metadata). Docs read at that SHA. No accounts, tokens, or authenticated calls were used; one GET each of the docs page, the legal page, and two public manifests; no snapshot artifact was downloaded.

## 1. Boardsesh: where its Kilter data comes from

- Boardsesh's current Kilter catalog comes from Kilter's first-party backend (Kilter Grips: Keycloak + REST + PowerSync), not the legacy Aurora sync. Its docs describe a separate `kilter-sync` package because the transports differ [kcs-boardsesh-kilter-sync]{3}. Catalog is pulled over REST `GET /api/climbs/all/{productLayoutUuid}` (full per-layout array, no pagination), `GET /api/climb-stat/all/{productLayoutUuid}`, and deletions via `GET /api/climbs/delteduuids` [kcs-boardsesh-kilter-sync]{3}[kcs-boardsesh-kilter-http-spec]{6}. So climbs created in the current official app are covered, subject to the dedup caveat in section 3.
- The pull is authenticated: it uses a Keycloak refresh-grant token borrowed from a user-linked Kilter credential (else a test account) [kcs-boardsesh-kilter-sync]{3}. Boardsesh therefore obtains Kilter data with account credentials, not anonymously. The terms exposure of that route belongs to the first-party-terms sibling facet; this brief only records that the route is authenticated.
- Boardsesh's own description of the Kilter endpoints is reverse-engineered from the Android app and self-labelled "not an authoritative server contract"; per-layout reads are the only routes it reports as live-checked, on 2026-06-02 [kcs-boardsesh-kilter-http-spec]{6}.
- Cadence: a `kilter-catalog-sync` job every 6 hours; a full pull takes ~43 minutes; the job waits out a `Retry-After` up to 5 minutes else fails as `rate_limited` [kcs-boardsesh-kilter-sync]{3}. Pulls are full-array snapshots per layout, not incremental; Boardsesh's own writer skips unchanged rows [kcs-boardsesh-kilter-sync]{3}.

## 2. Boardsesh public outputs

### 2a. Public API (boardsesh.com/docs)
- REST base `/api/v1/`; session-cookie auth via `/api/auth/...`; GraphQL over WebSocket (`/api/graphql`, graphql-ws) with a JWT from `GET /api/internal/ws-auth` [kcs-boardsesh-api-docs]{1}. The docs page does not give a full endpoint list, request/response shapes, pagination parameters, or numeric rate limits ("Public read endpoints have generous limits"; headers returned) [kcs-boardsesh-api-docs]{1}. The repo tree contains `api/v1/[board_name]/...` route files (climb by layout/size/sets/angle/uuid, climb-stats, grades, angles, slugs) {tree listing, not separately attested; treat as `{confidence: path-names only}`}.
- Terms: the API "is for integrations"; publishing an app using Boardsesh as its service needs written permission "which we do not currently grant" [kcs-boardsesh-api-docs]{1}[kcs-boardsesh-legal]{2}.

### 2b. Nightly public SQLite snapshots (the practical bulk source)
- Manifest `https://snapshots.boardsesh.com/board-snapshots/v1-gzip/manifest.json`; anonymous, no key; one artifact per (board type, layout), all wall sizes inside, filter by `compatible_size_ids`; gzip content-encoding; URLs rotate nightly, superseded pruned after 14 days, so resolve via manifest every time; fetch each artifact at most once per day [kcs-boardsesh-snapshots-dataset]{4}[kcs-boardsesh-snapshots-dataset]{4}.
- Live observation 2026-10-19 (manifest `generatedAt` 19:24Z): Kilter layout 1: 385,214 climbs, 82.5 MB wire, built 18:38Z; layout 8: 34,070 climbs, 7.9 MB; layouts 2,3,5,6,7: 162/2/637/6/12 climbs with watermarks July-August 2026 [kcs-boardsesh-snapshot-manifests]{5}. The docs say exports run nightly at 07:15 UTC, yet the Kilter artifacts were built 18:38Z the same day, so builds are more frequent than the doc states for at least some layouts [kcs-boardsesh-snapshots-dataset]{4}[kcs-boardsesh-snapshot-manifests]{5} (see Contradictions).
- Snapshots are full-state per artifact, not incremental; the manifest carries `watermarkUpdatedAt`/`watermarkSyncSeq` per table, which the doc calls app-internal [kcs-boardsesh-snapshots-dataset]{4}. The `board_climbs` table carries `updated_at`, `sync_seq`, `revision_number`, `holds_revision_number` columns that allow a consumer to diff two snapshots locally [kcs-boardsesh-snapshots-dataset]{4}.
- Schema: `board_climbs` (32 columns incl. `uuid`, `layout_id`, `frames`, `edge_*`, `angle`, `frames_count`, `frames_pace`, `is_listed`, `is_hidden`, `compatible_size_ids`, `hold_fingerprint`, setter fields), `board_climb_stats` per (climb, angle) with `display_difficulty` in the board's native scale, `quality_average` (0-5), `ascensionist_count`, `fa_username`, `fa_at`; grades in a sibling file (Boardsesh-computed universal grades) [kcs-boardsesh-snapshots-dataset]{4}. Drafts and Boardsesh-authored climbs are excluded; `is_draft` is always false/NULL [kcs-boardsesh-snapshots-dataset]{4}. Other docs say `quality_average` is normalized to 1-5 on Boardsesh's side [kcs-boardsesh-kilter-sync]{3}; the dataset doc says 0-5 [kcs-boardsesh-snapshots-dataset]{4}.
- Hardware/reference tables (holes, placements, LEDs, sets, product sizes, layouts, grade scales) are a separate public artifact at `board-snapshots/v1-catalog/manifest.json` (14 tables; 21,198 placements, 19,043 holes, 125 product sizes, 104 layouts in the 2026-10-19 manifest) [kcs-boardsesh-snapshots-dataset]{4}[kcs-boardsesh-snapshot-manifests]{5}. The catalog artifact also holds `board_climb_aliases` (1,030,613 rows) [kcs-boardsesh-snapshot-manifests]{5}.
- Authentication: none. Rate limit: no numeric limit; the only stated guidance is "at most once per day" per artifact [kcs-boardsesh-snapshots-dataset]{4}.
- License/terms of the snapshot data: the dataset doc states no explicit data license; it says "you are welcome to use them" (LEGAL.md) and "If you redistribute or build on this data, you are responsible for how you use it — attribute setters where you surface individual climbs, and don't present the dataset as officially sourced from any board manufacturer" [kcs-boardsesh-legal]{2}[kcs-boardsesh-snapshots-dataset]{4}. Boardsesh's position is that climbs are factual/functional and community-created; this is the publisher's own legal stance, not a third-party-verified conclusion [kcs-boardsesh-legal]{2}. Code is Apache-2.0; the hosted service/data is expressly outside that licence [kcs-boardsesh-legal]{2}.

## 3. ID and identity compatibility with legacy Aurora-era data

- Climb UUIDs: preserved. "Grips inherited Aurora's climb UUIDs"; ~80% of the ~424k climbs on 19 Grips layouts already existed by UUID (case-insensitive) in Boardsesh's legacy-sourced data [kcs-boardsesh-kilter-sync]{3}. Deleted-UUID list has mixed casing, so comparison must be case-insensitive [kcs-boardsesh-kilter-sync]{3}.
- Layout IDs: Boardsesh uses the legacy integer `board_layouts.id` (Kilter Original = 1, Homewall = 8 in its measurements). Grips `productLayoutUuid` values are small int-strings that Boardsesh maps to these integers by product name; several Grips layouts collapse into one (six "Kilter Board Original" variants -> layout 1) [kcs-boardsesh-kilter-sync]{3}. So the snapshot does NOT expose Grips layout identifiers; native Aurora-era layout IDs are what is exposed.
- Placement IDs / frames: Grips `climb_concat` uses `h{holeId}p{code}[s..][e..]`; Boardsesh rewrites to the legacy Aurora frames string `p{placementId}r{code}` via `board_placements(layout_id, hole_id)` [kcs-boardsesh-kilter-sync]{3}. Snapshot `frames` is therefore Aurora-format with legacy placement ids [kcs-boardsesh-kilter-sync]{3}[kcs-boardsesh-snapshots-dataset]{4}. Parity evidence from the publisher: 366/366 byte-identical in an early check; 141/141 semantic parity on multi-frame climbs with 78 byte-identical, 86,054 compared (2026-07-25); one divergence attributed to an upstream edit [kcs-boardsesh-kilter-sync]{3}. Multi-frame output is always pure-delta frames (leading `"` per frame), whereas legacy data can mix delta and absolute frames; byte comparison against legacy `frames` can differ even when semantically equal [kcs-boardsesh-kilter-sync]{3}.
- Gaps: climbs that cannot be mapped (unplaceable hole, unparsable concat, frame out of range) are held in a skip backlog and are absent from the catalog; the documented known gap is Grips layout 30 (holes 4488-4556, 3 climbs; placements postdate the legacy snapshot of 2024-06-22) [kcs-boardsesh-kilter-sync]{3}. A further 8 climbs were mis-tagged to the wrong layout on 2026-09-15 and rerouted by fallback [kcs-boardsesh-kilter-sync]{3}.
- Dedup folding: a new-UUID climb with the same (layout, hold fingerprint) as an existing canonical becomes an alias in `board_climb_aliases` instead of a `board_climbs` row; its stats are summed onto the canonical [kcs-boardsesh-kilter-sync]{3}. Consequence for coverage: a climb created in the current app can be absent from `board_climbs` by its own UUID if its holds duplicate another climb's; it appears only in the aliases table (shipped in the v1-catalog artifact) [kcs-boardsesh-kilter-sync]{3}[kcs-boardsesh-snapshot-manifests]{5}. The `board_climbs` `uuid` is the canonical's, not necessarily the one the first-party app shows. `{inferred: convergence of dedup rule and catalog alias table}`

## 4. Deletions, edits, stat differences

- Deletions: first-party deletion list is `delteduuids`; Boardsesh applies it as unlisting (`is_listed = false`) rather than row removal, behind a gate that is report-only by default [kcs-boardsesh-kilter-sync]{3}. On 2026-09-15 the first-party `/climbs/all` still returned 124 climbs that the deletion pass unlisted, so "present in the catalog array" does not imply "not deleted" [kcs-boardsesh-kilter-sync]{3}. The snapshot keeps `is_listed` as-is, so a consumer should filter on it [kcs-boardsesh-snapshots-dataset]{4}.
- Edits: `updated_at`, `revision_number`, `holds_revision_number` exist in the snapshot [kcs-boardsesh-snapshots-dataset]{4}. About 24 climbs carry the 2026-07-07 Aurora migration baseline as `updated_at` [kcs-boardsesh-kilter-sync]{3}.
- Stats: Boardsesh's materialized `ascensionist_count` is `upstream_ascensionist_count` plus a Boardsesh-native `boardsesh_ascensionist_count` [kcs-boardsesh-kilter-sync]{3}. The snapshot description lists `ascensionist_count` without stating whether the Boardsesh-native term is included; it excludes ticks/logbooks as rows [kcs-boardsesh-snapshots-dataset]{4}. `{ambiguous: snapshot ascensionist_count may include Boardsesh-native ticks}`. Upstream counts historically merged two sources via `GREATEST(aurora_, kilter_)`, with neither dominating (90,262 vs 36,710 rows) [kcs-boardsesh-kilter-sync]{3}. Kilter's in-app climb counts appear to count (climb, angle) pairs, roughly double distinct climbs (Homewall 8x12: 18,335 climbs vs 36,000 stat rows) [kcs-boardsesh-kilter-sync]{3}.
- Grades: Kilter grade in snapshot is `display_difficulty` in the board's native difficulty scale; Boardsesh adds computed universal grades in a sibling file [kcs-boardsesh-snapshots-dataset]{4}.

## 5. Other sources

- Hugging Face datasets (MIT licensed): `Vilin97/KilterBoard` (2025-07-15), `Ken1m/KilterBoard` (2026-10-02, same README text as Vilin97's, evidently a re-upload), `stfamod/Kilter-Board-Dataset` (2025-07-24). These are filtered ML splits (e.g. layout 1, size 10, sets {1,20}; ascensionist_count>0; 3-50 holds) sourced from BoardLib plus the Kilter app; no snapshot date or original-vs-new-app coverage statement in the cards. They therefore cannot be treated as a complete or current catalog [kcs-hf-kilter-datasets-2026]{7}. BoardLib (MIT, last push 2026-03-17) is the sibling facet's [kcs-boardlib-repo]{8}. Other kilter-named HF datasets (`kvxb/kilter` 2026-10-04 with a `kilter.db`, no README) were not inspected.
- No Kaggle dataset was found with a Kilter climb catalog in the search results; this is absence of search hits, not proof of absence.
- Other open-source clients: only Boardsesh (and its MCP server per search snippet) surfaced; not examined further.

## Disconfirming analysis

- Claim "Boardsesh has current-app climbs": sought contradicting evidence (e.g. that Kilter sync still uses Aurora). The docs say the Kilter backend split from Aurora and the legacy `aurora_ascensionist_count` was folded away [kcs-boardsesh-kilter-sync]{3}; manifest watermarks for layouts 1 and 8 were minutes old on 2026-10-19 [kcs-boardsesh-snapshot-manifests]{5}. No contradicting evidence found. However no climb-level check (e.g. a known new-app UUID present) was done; no artifact was downloaded.
- Claim "ID-preserving": the 141/141 parity result is publisher-reported, covers climbs in both catalogs only, and the skip backlog shows non-zero unmappable climbs [kcs-boardsesh-kilter-sync]{3}.
- Claim "snapshots are anonymous": no auth requirement stated [kcs-boardsesh-snapshots-dataset]{4}; verified only that the manifest GET succeeded anonymously [kcs-boardsesh-snapshot-manifests]{5}.

## Contradictions

- Snapshot cadence: doc says nightly at 07:15 UTC [kcs-boardsesh-snapshots-dataset]{4}; manifest shows Kilter layouts 1 and 8 built 2026-10-19T18:38Z while other boards were built 07:19Z [kcs-boardsesh-snapshot-manifests]{5}. Doc also allows "occasional manual runs" [kcs-boardsesh-snapshots-dataset]{4}. Unresolved; both stand.
- Quality scale: dataset doc says `quality_average` is "0-5 star scale" [kcs-boardsesh-snapshots-dataset]{4}; kilter-sync doc says every board is normalized to 1-5 [kcs-boardsesh-kilter-sync]{3}. Unresolved.
- Rate limit wording: API docs say public read endpoints have "generous limits" [kcs-boardsesh-api-docs]{1}; snapshot doc gives a once-per-day guideline per artifact [kcs-boardsesh-snapshots-dataset]{4}. Different surfaces; not necessarily conflicting.

## Revisit if

- Boardsesh publishes explicit data licence terms or changes the "written permission" policy.
- Kilter changes the Grips REST/PowerSync catalog endpoints or Boardsesh changes snapshot manifest `formatVersion`/prefix (`v1-gzip`).
- A snapshot artifact is downloaded and inspected (verifies schema, alias coverage, and presence of known current-app UUIDs).
- New third-party Kilter datasets with dated post-2026-03 snapshots appear.

## Implementation-relevant notes

- A personal offline updater can read the public manifest anonymously, pick the `kilter` layout 1 (and 8) entries, download the gzip SQLite, verify `bytes` and `PRAGMA quick_check`, and diff by `uuid`/`updated_at`/`revision_number` [kcs-boardsesh-snapshots-dataset]{4}. Resolve the URL from the manifest each time; do not store artifact URLs [kcs-boardsesh-snapshots-dataset]{4}.
- Join to hardware via the `v1-catalog` artifact; `frames` use legacy placement ids so they join to `board_placements` [kcs-boardsesh-kilter-sync]{3}[kcs-boardsesh-snapshots-dataset]{4}.
- Treat `is_listed=false` and `is_hidden` as removals/hides; do not interpret missing UUIDs as deletions without checking aliases [kcs-boardsesh-kilter-sync]{3}[kcs-boardsesh-snapshots-dataset]{4}.
- Redistribution: publisher asks for setter attribution and no claim of official manufacturer sourcing; no explicit licence; first-party Kilter terms are not addressed by Boardsesh's snapshot doc beyond its own legal stance [kcs-boardsesh-legal]{2}[kcs-boardsesh-snapshots-dataset]{4}. Personal-use fetch of public snapshots is invited; bulk re-publication is the less settled case.
- Do not use Boardsesh's hosted API as a backend for a distributed app (written permission needed, not granted) [kcs-boardsesh-api-docs]{1}[kcs-boardsesh-legal]{2}.

## Gaps

- No snapshot artifact downloaded; actual column set, alias semantics, and presence of newest climbs unverified.
- Exact `/api/v1` endpoint request/response shapes and numeric rate limits unpublished on the docs page; the docs page was read through a summarizing fetch, not verbatim.
- Whether the Fullride 7x10 configuration maps to a specific Boardsesh `layout_id`/`size_id` is not established by any fetched source; the HF cards' "layout 1, size 10, sets {1,20}" is not shown to be 7x10.
- Whether snapshot `ascensionist_count` includes Boardsesh-native ticks.
- Aurora/Kilter terms of service on third-party redistribution (sibling facets).

## Bibliography

1. kcs-boardsesh-api-docs
2. kcs-boardsesh-legal
3. kcs-boardsesh-kilter-sync
4. kcs-boardsesh-snapshots-dataset
5. kcs-boardsesh-snapshot-manifests
6. kcs-boardsesh-kilter-http-spec
7. kcs-hf-kilter-datasets-2026
8. kcs-boardlib-repo


---
source_handle: kcs-boardsesh-kilter8-artifact
fetched: 2026-10-19
source_url: https://snapshots.boardsesh.com/board-snapshots/v1-gzip/kilter/8/2026-10-19T18-38-11-515Z.db
provenance: source-direct
substrate_confidence: source-direct
related_urls:
  - https://snapshots.boardsesh.com/board-snapshots/v1-gzip/manifest.json
  - https://snapshots.boardsesh.com/board-snapshots/v1-catalog/manifest.json
  - https://snapshots.boardsesh.com/board-snapshots/v1-catalog/2026-10-19T07-29-53-235Z.db
comparison_baseline: CruxControl bundled catalog `web/public/catalog/kilter-7x10.v1.db.gz` (gzip SHA-256 68d6d86aad984aca5cf9967d24c818d5bdf2984631b1fe9b9fa1fd30c0edbbbf), an Aurora-era Kilter SQLite extract holding all 23,156 layout-8 climbs it contains (not filtered to 7x10), created 2020-10-05 to 2026-01-31, read locally
---

# Boardsesh Kilter Homewall (layout 8) snapshot and v1-catalog artifact — direct inspection

Both artifacts were downloaded once, anonymously, on 2026-10-19 and inspected with
`sqlite3`/Python. Counts below are direct query results. The comparison baseline is
an Aurora-era Kilter SQLite subset (Homewall layout 8, product size 17 "7x10",
sets 26/27), 23,156 climbs, newest `created_at` 2026-01-31 01:15:48.

## Manifest entries (v1-gzip, `generatedAt` 2026-10-19T19:24:13Z, `formatVersion` 2)

- `kilter` layout 8: `bytes` 7,945,023; `uncompressedBytes` 20,779,008;
  `contentEncoding` "gzip"; `builtAt` 2026-10-19T18:38:11.515Z; `schemaVersion` 13;
  `board_climbs` rowCount 34,070 (watermark 2026-10-19T18:31:55Z);
  `board_climb_stats` rowCount 51,874. No content hash field is present in the entry.
- v1-catalog manifest (`formatVersion` 1): one artifact, `bytes` 39,438,811,
  `uncompressedBytes` 194,351,104, built 2026-10-19T07:29:53Z, `schemaVersion` 1,
  14 tables including `board_climb_aliases` (1,030,613 rows).

## Transport observations

- GET of the layout-8 URL returned HTTP/2 200, `content-type: application/x-sqlite3`,
  `server: cloudflare`, weak `etag`, `cache-control: public, max-age=31536000, immutable`,
  and **no `content-encoding` header**. Body was 20,779,008 bytes of plain SQLite
  (equal to `uncompressedBytes`), with `Accept-Encoding: identity` and with
  `Accept-Encoding: gzip` alike (identical SHA-256
  `102382b60d53038d4463b4fc3e709913c6ea44e52f47a417daab3c86a58f9dc8`).
- CORS: manifest and artifact responses carry `access-control-allow-origin: *`;
  preflight `OPTIONS` returned 204 with `access-control-allow-methods: GET, HEAD`.
  Manifest `cache-control: public, max-age=300`.

## Artifact tables

- Layout-8 artifact: `board_climbs`, `board_climb_stats`, `snapshot_meta`.
  `board_climbs` columns include `uuid, board_type, layout_id, setter_id,
  setter_username, name, description, hsm, edge_left/right/bottom/top, angle,
  frames_count, frames_pace, frames, is_draft, is_listed, created_at, published_at,
  user_id, required_set_ids (JSON), compatible_size_ids (JSON), hold_fingerprint,
  updated_at, sync_seq, characteristics, is_hidden, missing_hold_count,
  revision_number, holds_revision_number, retired_by_reset`.
  `board_climb_stats` key `(board_type, climb_uuid, angle)` with `display_difficulty,
  benchmark_difficulty, ascensionist_count, difficulty_average, quality_average,
  fa_username, fa_at, updated_at, sync_seq`. `snapshot_meta` rows for `board_climbs`,
  `board_climb_stats`, and `sync_deletions` (row_count 0).
- Catalog artifact tables prefixed `board_` (products, layouts, product_sizes, sets,
  placement_roles, holes, placements, leds, product_sizes_layouts_sets, kits,
  difficulty_grades, attempts, climb_aliases, beta_links), each with a `board_type` column.

## Hardware identity versus the Aurora-era baseline

- `board_layouts` kilter id 8 = "Kilter Board Homewall", product 7.
  `board_product_sizes` kilter id 17 = "7x10", edges -44/44/24/144 — identical to baseline.
  `board_product_sizes_layouts_sets` ids 55 (set 26) and 56 (set 27) for size 17 /
  layout 8 — identical to baseline, including image filenames.
- Placements, layout 8: catalog 499, baseline 472; all 472 baseline placements match
  on `(id, layout_id, hole_id, set_id)`. The 27 catalog-only placements are set 28
  "Mainline Kickboard" (13) and set 29 "Auxiliary Kickboard" (14).
- LEDs, size 17: 305 in both; all 305 identical on `(id, hole_id, position)`.
- Holes: all 3,294 baseline holes identical on `(id, x, y)`.
- Placement roles: kilter 12–15 (product 1: start/middle/finish/foot) and 42–45
  (product 7: start/middle/finish/foot) with the same names.
- Difficulty grades: all 39 baseline rows identical on `(difficulty, boulder_name)`.

## Climb rows

- 34,070 rows; 29,053 `is_listed=1`; 0 drafts; `created_at` range 2020-10-05 to
  2026-10-19T14:23:52Z. Listed-row counts by `created_at` month include 2026-04: 707,
  2026-07: 443, 2026-09: 347, 2026-10 (partial): 230.
- Role codes by era (listed rows, frames parsed as `p{placement}r{role}`): created
  before 2026-03-26 — 24,069 use only roles 42–45, 1,962 only 12–15; created on/after
  2026-03-26 — 3,019 use only roles 12–15, 3 only 42–45.
- UUID format among lightable post-2026-03-26 rows: 1,148 lowercase dashed
  (8-4-4-4-12), 1 32-hex. Baseline UUIDs are 32-hex uppercase.
- Lightability on size 17 (every placement maps to a size-17 LED through sets 26/27
  and every role is a product-7 role): 11,465 listed rows with roles as stored; 13,347
  when roles 12–15 are mapped by name to 42–45. 13,347 also equals the count of listed
  rows whose `compatible_size_ids` contains 17. Of the 13,347: 1,149 created on/after
  2026-03-26; 2,278 have UUIDs absent (case-insensitive) from the baseline.
- 87 rows have `frames` that are not a single `p..r..` run (multi-frame strings with
  `,"` separators); 37 of the 13,347 role-normalized lightable rows are multi-frame (27 of the 11,465 lightable with roles as stored).
- Baseline overlap: 23,147 of 23,156 baseline UUIDs present (case-insensitive);
  23,053 listed, 94 `is_listed=0`; 3 of the 9 absent baseline UUIDs appear as
  `alias_uuid` in `board_climb_aliases`. 22,656 shared rows have byte-identical `frames`;
  all 491 shared rows with differing `frames` have the same placement sequence and differ
  only by role code (baseline 42–45 → snapshot 12–15).
- `board_climb_aliases` sources: `backfill` 353,405; `kilter` 74,691.
- No listed rows with `is_hidden=1`, `retired_by_reset=1`, or `missing_hold_count>0`.

## Stats

- `board_climb_stats`: 51,874 rows; max `updated_at` 2026-10-19T18:32:56Z;
  `quality_average` range 0.25–5.0; 740 rows with null `display_difficulty`.
- Baseline `climb_stats`: 43,740 rows; `quality_average` range 1.0–3.0.
- 43,724 (climb, angle) rows shared; `ascensionist_count` equal in 9,366, higher in the
  snapshot in 18,459, lower in the snapshot in 15,899.
- Restricting to shared rows with equal `ascensionist_count`, baseline quality groups
  (baseline value rounded to one decimal; groups with n>50)
  map to wide snapshot ranges (e.g. baseline 3.0 → snapshot 1.0–5.0, mean 3.83, n=6,444;
  baseline 2.0 → 1.0–5.0, mean 2.70, n=676). No fixed linear rescaling is evident.

## Additional measurements (second pass, 2026-10-19)

- `board_climbs` by `is_listed`: 29,053 listed, 5,017 unlisted (sums to 34,070). No listed
  row mixes roles from 12–15 with roles from 42–45.
- Of the 2,278 lightable listed rows absent from the baseline: 1,149 have `created_at` on
  or after 2026-03-26; 412 between 2026-01-31 and 2026-03-25; 717 on or before
  2026-01-31. Of those 717: 523 have lowercase dashed UUIDs and roles 12–15 (with
  `created_at` spread 2020–2026), and 194 have 32-hex UUIDs and roles 42–45.
  `updated_at` of the 717 ranges 2026-07-07 to 2026-10-13.
- `quality_average` below 1.0: 13 rows; equal to 0: none.
- Stat angles: 0–70 in steps of 5 in both the snapshot and the baseline.
- Manifest entry keys observed: `boardType`, `layoutId`, `key`, `url`, `bytes`,
  `uncompressedBytes`, `contentEncoding`, `builtAt`, `schemaVersion`, `privacyVersion`,
  `artifactShape`, `tables` (per table `rowCount`, `watermarkUpdatedAt`,
  `watermarkSyncSeq`), and for most layouts `grades`. Top level: `formatVersion`,
  `generatedAt`, `entries`.

## Revisions
- 2026-10-19 (correction): multi-frame count restated for both lightable definitions; added role-only frame differences and lower-count stat rows after independent re-run.

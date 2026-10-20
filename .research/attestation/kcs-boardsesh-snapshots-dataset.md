---
source_handle: kcs-boardsesh-snapshots-dataset
fetched: 2026-10-19
source_url: https://github.com/boardsesh/boardsesh/blob/3340422a27c42e576207ada906c34a5c0c5ab4be/docs/board-snapshots-dataset.md
provenance: source-direct
substrate_confidence: source-direct
---

# Boardsesh nightly board snapshots dataset doc at commit 3340422a27c42e576207ada906c34a5c0c5ab4be

## Key passages (paraphrase + quotes)
- Stable manifest URL: `https://snapshots.boardsesh.com/board-snapshots/v1-gzip/manifest.json`. Artifacts gzipped, served with Content-Encoding gzip (check first bytes 1f 8b). "Never hardcode artifact URLs": nightly run mints new timestamped artifacts; superseded pruned after 14-day grace.
- One artifact per (board type, layout) pair; contains full catalog for that layout across all wall sizes; filter by `compatible_size_ids` (JSON array).
- Manifest formatVersion 2; entry fields: boardType, layoutId, url, key, bytes, uncompressedBytes, contentEncoding, builtAt, privacyVersion (must be 1), schemaVersion, artifactShape (2 today), tables.<name>.rowCount, watermarkUpdatedAt/watermarkSyncSeq, optional grades sibling artifact. Schema changes additive; breaking changes ship under new v2* prefix.
- Tables: board_climbs (32 cols incl. uuid PK, board_type, layout_id, setter_id, setter_username, name, description, hsm, edge_left/right/bottom/top, angle, frames_count, frames_pace, frames ("the hold sequence as the board's native frame string"), is_draft, is_listed, is_hidden, created_at, published_at, user_id, required_set_ids/compatible_size_ids/characteristics JSON, hold_fingerprint, revision_number, holds_revision_number, updated_at, sync_seq); board_climb_stats per (climb, angle): ascensionist_count, difficulty_average, display_difficulty (native scale), benchmark_difficulty, quality_average (0-5), fa_username, fa_at; snapshot_meta. Grades in sibling file board_climb_grades (Boardsesh-computed universal grades).
- Distribution filter: "Only published imported climbs without a linked Boardsesh author are distributed: a draft is left out"; `is_draft` always false/NULL; `is_listed` keeps source value (filter on it for public-only).
- Hardware (holes, placements, LEDs, hold sets, product sizes, layouts, grade scales) is a third artifact at `board-snapshots/v1-catalog/manifest.json`.
- Not included: accounts, ticks/logbooks, personal data beyond setter/first-ascent usernames.
- Freshness: exports nightly at 07:15 UTC plus occasional manual runs; manifest Cache-Control max-age=300; "climbs published on a board minutes ago may not appear until the next nightly run".
- Consumer guidance: download an artifact at most once per day; Kilter artifact 110 MB (shape 1) / 82 MB wire, 207 MB decoded (shape 2); verify bytes and PRAGMA quick_check. Shape-2 tables are WITHOUT ROWID with no secondary indexes; PKs: board_climbs.uuid; (board_type, climb_uuid, angle) on stats.
- Provenance statement (quote): "If you redistribute or build on this data, you are responsible for how you use it — attribute setters where you surface individual climbs, and don't present the dataset as officially sourced from any board manufacturer." No explicit data license is stated in this doc.


## Additional verbatim passages (docs/board-snapshots-dataset.md at 3340422a, re-fetched raw 2026-10-19)

- Distribution scope: "Only published imported climbs without a linked Boardsesh author are distributed: a draft is left out, with its stats, grades, beta links and aliases." … "`is_listed` keeps its source value, so filter on it for a public-only browse. There is no size filter either: a layout's artifact spans every wall size, so filter with `compatible_size_ids`."
- Stats: "`difficulty_average` and `display_difficulty` (in the board's native difficulty scale), `benchmark_difficulty` where the community designates benchmarks, `quality_average` (0–5 star" scale).
- Fetch guidance includes: "please don't re-fetch it hourly."

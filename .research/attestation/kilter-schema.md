---
source_handle: kilter-schema
fetched: 2026-06-13
source_url: https://github.com/Declan-Stockdale/kilterboard_climbs
provenance: source-direct
---

# Kilter Board database schema (via kilterboard_climbs / BoardLib / Kilter-Board-Dataset)

The Kilter app ships a SQLite database (extractable via BoardLib's `boardlib database`). Relevant tables and fields for evaluation/target design, corroborated across search snippets and the HuggingFace dataset card.

## Verbatim key passages

- Schema / query shape (from kilterboard_climbs snippet): "SELECT climb_uuid, name, display_difficulty, benchmark_difficulty, ascensionist_count, quality_average FROM climb_stats INNER JOIN climbs ON climb_stats.climb_uuid = climbs.uuid WHERE angle = 40 and display_difficulty > 18 and ascensionist_count >=5 and frames_count =1".
- Fields: `angle` is the wall angle (0–70 degrees); `display_difficulty` is the displayed grade; `ascensionist_count` is number of people who completed the climb; per the SQLite structure these statistics live in `climb_stats` keyed by `climb_uuid` AND angle, while `climbs` holds the static layout (`frames`).
- Dataset-card filtering (stfamod/Kilter-Board-Dataset): "Minimum Ascensionists: 5" and "Quality Rating: Greater than 2.6".

## Summary

Critical structural fact for leakage: `climb_stats` is keyed by (climb_uuid, angle) — the SAME climb (same uuid, same hold layout/frames) appears as multiple rows at different angles, each with its own `difficulty_average`/`display_difficulty`, `benchmark_difficulty`, and `ascensionist_count`. `display_difficulty`/`difficulty_average` is the community-consensus aggregate; `benchmark_difficulty` is the setter/curated benchmark grade. A common community filter is `ascensionist_count >= 5` and quality > ~2.6 to drop noisy, sparsely-repeated climbs. Per-angle rows of the same uuid are correlated samples that must not be split across train/test.

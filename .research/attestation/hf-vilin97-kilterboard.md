---
source_handle: hf-vilin97-kilterboard
fetched: 2026-06-13
source_url: https://huggingface.co/datasets/Vilin97/KilterBoard/blob/main/README.md
provenance: source-direct
---

# Vilin97/KilterBoard (HuggingFace dataset)

## Summary
A Kilter Board dataset packaged as a SQLite database (`kilter_splits.sqlite`) with
pre-computed train/val/test splits. Sourced from the BoardLib repo plus the Kilter app.
Filtered to a single board configuration (layout 1, size 10, sets {1, 20}). MIT licensed.
Approximate size band reported as 100K–1M rows. Rows keyed by `(uuid, angle)` — i.e. one
row per problem per board angle, which makes angle an explicit modeling axis.

## Verbatim key passages
- "layout 1, size 10, sets {1, 20}"
- Tables: "kilter_train, kilter_val, kilter_test" (filtered climbs) plus reference tables
  "difficulty_grades, placements, placement_roles, holes"
- "keyed by (uuid, angle)"
- Splits: "80 / 10 / 10 %" division based on UUIDs (problems do not overlap across splits)
- Filters: "ascensionist_count > 0", "difficulty_numeric ≤ 30.5" (~V13),
  "num_holds ≥ 3" and "≤ 50"
- Source: "BoardLib repo + Kilter app"
- License: MIT

## Notes for downstream use
- UUID-disjoint splits are the right design to avoid leakage across angles of the same problem.
- The reference tables (placements, placement_roles, holes) give the hold-position-and-role
  metadata needed for feature engineering — sibling facet.
- Dataset viewer reportedly cannot auto-detect data files (SQLite, not parquet/csv) — must be
  loaded manually rather than via the HF datasets viewer/auto-loader.

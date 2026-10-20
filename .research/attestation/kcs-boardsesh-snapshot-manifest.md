---
source_handle: kcs-boardsesh-snapshot-manifest
fetched: 2026-10-19
source_url: https://boardsesh-board-snapshots.t3.tigrisfiles.io/board-snapshots/v1/manifest.json
provenance: source-direct
substrate_confidence: summarized-fetch
---

# Boardsesh snapshot manifest (public CDN JSON, fetched 2026-10-19 via summarizing fetch)
- Manifest generated 2026-10-03T07:20:35Z. Entry fields: boardType, layoutId, key, url, bytes, uncompressedBytes, contentEncoding, builtAt, schemaVersion, tables{board_climbs, board_climb_stats with row counts + sync metadata}.
- Kilter layout 1: 281,866,240 bytes, board_climbs rowCount 385746, board_climb_stats rowCount 369737, watermarkUpdatedAt 2026-10-03T07:15:02.394089Z. Layout 8: 35022 climbs, updated 2026-10-03. Layout 2: 162 climbs, watermark 2026-08-25.
- Not interpretable as legacy-Aurora freshness: Boardsesh docs say Kilter is fed from the Grips backend since 2026-03-30 (see kcs-boardsesh-docs-legacy). Manifest is later than the one Boardsesh doc cites (2026-10-10), indicating the manifest URL fetched may be an older (Tigris) publisher after an R2 migration - not verified.

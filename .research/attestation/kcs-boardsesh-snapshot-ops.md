---
source_handle: kcs-boardsesh-snapshot-ops
fetched: 2026-10-19
source_url: https://github.com/boardsesh/boardsesh/blob/3340422a27c42e576207ada906c34a5c0c5ab4be/docs/board-snapshots.md
provenance: source-direct
substrate_confidence: source-direct
---

# Boardsesh board-snapshots operations document

Operator documentation for building and publishing board snapshots.

- `sync_deletions`: the build "captures a conservative tombstone boundary into a metadata-only `sync_deletions` row" (around line 115); newly built whole-layout artifacts carry an additive `sync_deletions` metadata row with `row_count = 0` (around line 409).
- Logs: "Every `[export-snapshots] uploaded` line must carry a `deletionsReplayFrom`" (around line 319); the build/upload log carries `deletionsReplayFrom` and `deletionsReplayFallbackReason` (around line 133).

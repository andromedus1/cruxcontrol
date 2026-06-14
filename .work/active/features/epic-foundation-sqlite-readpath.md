---
id: epic-foundation-sqlite-readpath
kind: feature
stage: drafting
tags: [data]
parent: epic-foundation
depends_on: [epic-foundation-scaffold]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
---

# In-Browser SQLite Read Path (wa-sqlite Worker)

## Brief

Implement the catalog read path: wa-sqlite running on `OPFSCoopSyncVFS` inside a dedicated
Web Worker, with the main thread issuing async queries over a thin RPC (Comlink or
hand-rolled postMessage). This is the trickiest, most load-bearing feature in the epic —
everything that reads climbs/holds/stats goes through it.

Covers: the Worker host for wa-sqlite, OPFS sync-access-handle setup, the data-layer port
implementation (`query(sql, params)` → rows) from the scaffold's interface, OPFS
support-detection with an `IDBBatchAtomicVFS` fallback for older browsers, and tests
against a small fixture DB. Does NOT cover fetching the real catalog (catalog-bootstrap) or
any UI.

## Epic context
- Parent epic: `epic-foundation`
- Position: critical-path feature — catalog-bootstrap depends on it; sibling epics' read
  paths all sit on top of this port.

## Inherited design decisions
- wa-sqlite `OPFSCoopSyncVFS` in a Web Worker (avoids the COOP/COEP headers the official
  build forces); `IDBBatchAtomicVFS` fallback on older browsers.
- SQLite runs in a Worker; UI thread is async-only against the port.

## Research briefs
- [foundation-pwa-sqlite.md](../../../docs/briefs/foundation-pwa-sqlite.md) — §1 (in-browser SQLite), Implementation Notes (port, Worker+RPC, VFS fallback).
- [data-model.md](../../../docs/briefs/data-model.md) — catalog schema the queries target.

## Foundation references
- `docs/ARCHITECTURE.md` — Module Map §1 (Data Layer); Conventions (single source of truth).

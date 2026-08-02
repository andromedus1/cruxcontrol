---
id: epic-foundation-sqlite-idb-fallback
kind: feature
stage: drafting
tags: [data]
parent: epic-foundation
depends_on: [epic-foundation-sqlite-readpath]
release_binding: null
gate_origin: null
created: 2026-06-14
updated: 2026-08-02
---

# In-Browser SQLite — IndexedDB Fallback VFS

## Backlog status

Deferred from the first Android/desktop Chromium milestone by user decision on
2026-08-02. Promote through `/agile-workflow:scope` when browse-only Safari/Firefox
support becomes a delivery priority.

## Brief

Split out of `epic-foundation-sqlite-readpath` during feature-design (2026-06-14).
Adds wa-sqlite's `IDBBatchAtomicVFS` as a fallback catalog read path for browsers
without OPFS sync-access-handle support, plus runtime VFS selection so the
`CatalogPort` works on browse-only Safari/Firefox.

The read-path feature ships the OPFS path + capability detection + a graceful
`UnsupportedEnvironmentError`. This feature replaces that hard failure, at the
`SqliteCatalogPort.create()` seam, with a branch that selects `IDBBatchAtomicVFS`
when OPFS sync access is unavailable.

## Why deferred

Board control requires Chromium (Web Bluetooth), where OPFS sync-access-handles are
universal — so the fallback's only beneficiaries are browse-only users on
Safari/Firefox, and no product surface consumes that path yet. Prioritize into a
release when browse-on-non-Chromium is wanted (likely alongside `epic-climb-browser`).

## Scope notes

- Reuse the Worker-agnostic `CatalogDb` engine and the `VfsBinding` seam from the
  read-path feature — this should be a new VFS binding + a selection branch, not a
  second engine.
- `IDBBatchAtomicVFS` "performance degrades with larger databases (100MB+)"
  (`foundation-pwa-sqlite.md` §1) — acceptable for the read-only Kilter catalog.

## Foundation references
- `docs/briefs/foundation-pwa-sqlite.md` — §1 (VFS options, fallback).
- `epic-foundation-sqlite-readpath` — the engine + port seam this extends.

---
source_handle: powersync-sqlite-web
fetched: 2026-06-13
source_url: https://powersync.com/blog/sqlite-persistence-on-the-web
provenance: source-direct
---

# PowerSync — The Current State of SQLite Persistence on the Web (May 2026 update)

## Summary

A maintained survey of in-browser SQLite persistence approaches. sql.js is the
oldest (since 2014) and is in-memory only — it has no persistence beyond
importing/exporting the whole database file at once. wa-sqlite offers several
virtual file systems (VFS): OPFSCoopSyncVFS uses synchronous access handles,
supports multiple concurrent connections, has file-system transparency, and keeps
performing well even for databases over 1GB; IDBBatchAtomicVFS persists versioned
blocks to IndexedDB with good write performance but degrades past ~100MB and has
shown errors on Safari. The official @sqlite.org build's OPFS VFS uses a
SharedArrayBuffer + Atomics workaround to make OPFS synchronous, which requires
COOP/COEP headers, and allows only one read or write transaction open at a time.
For general use the article recommends wa-sqlite's OPFSCoopSyncVFS; for read-heavy
parallel-read workloads it points at the newer OPFSWriteAheadVFS.

## Key passages

- sql.js "only supports in-memory databases, and does not support persistence other than importing or exporting the entire database file at a time."
- "OPFSCoopSyncVFS … uses synchronous access handles, but it supports multiple concurrent connections, and has file system transparency."
- "OPFSCoopSyncVFS keeps performing well even for databases over 1GB in size."
- "IDBBatchAtomicVFS works well for small databases, but performance degrades with larger databases (100MB+)."
- "wa-sqlite's OPFSCoopSyncVFS is a good general-purpose VFS that has excellent performance, even with large databases."
- Official build: "the SharedArrayBuffer + Atomics workaround is used to make the operation synchronous. This means COOP and COEP headers are required." and "only a single read or write transaction can be open at a time."
- "For read-heavy workloads that benefit from parallel reads, the design of OPFSWriteAheadVFS is an excellent fit" (added April 2026).

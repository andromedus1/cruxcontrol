---
id: idea-library-backup-early-count-bounds
created: 2026-09-05
updated: 2026-09-05
tags: [data]
---

The library backup export codec must apply climb, playlist, and reference count limits before walking or encoding individual rows. An oversized malformed snapshot currently reaches row encoding first and reports a row error instead of the supported file-size boundary. The export must fail without serializing or offering a partial backup.

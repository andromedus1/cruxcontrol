---
id: idea-library-backup-future-schema-dispatch
created: 2026-09-05
updated: 2026-09-05
tags: [data]
---

The library backup codec must reject a stored draft or playlist that declares an unsupported future schema even when `updatedOrder` is missing. The current raw-versus-domain dispatch can encode such a value as the current schema and silently reinterpret it. Preserve the rule that production raw backup records are decoded according to their declared schema before any model encoding.

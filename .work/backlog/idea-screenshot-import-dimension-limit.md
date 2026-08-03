---
id: idea-screenshot-import-dimension-limit
created: 2026-08-02
updated: 2026-08-02
tags: [security, perf, data]
---

Add an explicit maximum pixel/dimension bound to Kilter screenshot import before canvas
allocation and detector typed-array work. The importer currently rejects wrong aspect
ratios and browser canvas limits fail safely, but a locally selected, correctly
proportioned enormous PNG could still create avoidable memory pressure before rejection.

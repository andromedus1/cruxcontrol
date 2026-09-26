---
id: idea-screenshot-import-dimension-limit
kind: story
stage: implementing
tags: [security, data]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-09-26
---

# Screenshot import dimension limit

## Brief
Add an explicit maximum pixel/dimension bound to Kilter screenshot import before canvas
allocation and detector typed-array work. The importer currently rejects wrong aspect
ratios and browser canvas limits fail safely, but a locally selected, correctly
proportioned enormous PNG could still create avoidable memory pressure before rejection.

## Delivery scope
Authorized in the everyday-reliability cleanup. Preserve stored library data and existing visual structure. Add focused regression evidence and complete the applicable review lane.

## Simplification opportunity
Repair the existing path directly; no new subsystem.

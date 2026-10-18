---
id: idea-backup-capture-cost
created: 2026-10-11
updated: 2026-10-11
tags: [perf]
---

Automatic-backup review (`20261011T172817Z-7aa47a5e`, finding 7) notes repeated
coherent full-library captures in one foreground run. These hold the native SQLite
queue and may delay saves near 10,000 climbs. The current-cycle stale-signout fix
replaces the final revision-only capture with a small record read; the initial
emptiness/discovery capture and upload capture still have distinct timing roles.
Profile actual save latency and capture cost before changing those contracts.
Existing structured restore proves memory/content correctness, not interactive
latency under simultaneous editing. This is below the first small-library dogfood
blocker bar; do not trade coherent snapshots or empty-library admission for speed.

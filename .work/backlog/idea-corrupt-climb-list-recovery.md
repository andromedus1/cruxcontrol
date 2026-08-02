---
id: idea-corrupt-climb-list-recovery
created: 2026-08-02
updated: 2026-08-02
tags: [data]
---

A single undecodable local climb row currently rejects the entire repository list,
hiding otherwise healthy climbs and recoverable Trash entries behind an error. Make
listing corruption-tolerant by preserving the bad row as recovery evidence while
returning healthy rows and surfacing a targeted warning. The lifecycle feature's
automatic Trash purge already skips corrupt and unknown-version rows safely; listing
should eventually provide comparable recovery behavior without silently deleting data.

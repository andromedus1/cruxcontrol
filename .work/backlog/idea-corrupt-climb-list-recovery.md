---
id: idea-corrupt-climb-list-recovery
created: 2026-08-02
updated: 2026-09-12
tags: [data]
---

A single undecodable local climb row currently rejects the entire repository list,
hiding otherwise healthy climbs and recoverable Trash entries behind an error. Make
listing corruption-tolerant by preserving the bad row as recovery evidence while
returning healthy rows and surfacing a targeted warning. Preserve corrupt and
unknown-version records without silently deleting data. Trash remains until explicit
permanent deletion; library backups do not yet provide raw corrupt-row salvage.

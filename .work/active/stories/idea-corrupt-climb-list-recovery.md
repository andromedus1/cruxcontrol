---
id: idea-corrupt-climb-list-recovery
kind: story
stage: implementing
tags: [data]
parent: feature-library-read-resilience
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-09-26
---

# Corrupt climb list recovery

## Brief
A single undecodable local climb row currently rejects the entire repository list,
hiding otherwise healthy climbs and recoverable Trash entries behind an error. Make
listing corruption-tolerant by preserving the bad row as recovery evidence while
returning healthy rows and surfacing a targeted warning. Preserve corrupt and
unknown-version records without silently deleting data. Trash remains until explicit
permanent deletion; library backups do not yet provide raw corrupt-row salvage.

## Delivery scope
Authorized in the everyday-reliability cleanup. Preserve stored library data and existing visual structure. Add focused regression evidence and complete the applicable review lane.

## Simplification opportunity
Repair the existing path directly; no new subsystem.

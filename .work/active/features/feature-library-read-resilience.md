---
id: feature-library-read-resilience
kind: feature
stage: drafting
tags: [ui, data]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-26
updated: 2026-09-26
---

# Keep healthy library records accessible

## Brief
Deliver the authorized corrupt-climb recovery and playlist read-failure isolation backlog ideas. Healthy Drafts, Finished climbs, and Trash remain usable when a stored climb cannot decode or playlist reads fail. Preserve every unreadable record unchanged and show a targeted warning; do not migrate, delete, or overwrite authored data.

## Strategic decisions
The user approved these two reliability fixes before shared-library/catalog work. This is a local read-path repair using existing warning/retry UI, with no new recovery editor or raw-record export. Preserve strict reads for imports/backup and writes. No unresolved strategic questions, new research, or mockup needed; existing recovery notice and error/retry patterns apply.

## Simplification opportunity
Separate climb and playlist refresh outcomes instead of one all-or-nothing workspace refresh. Retain independent repositories and existing validation.

---
id: idea-backup-retention-capacity
created: 2026-10-18
updated: 2026-10-18
tags: [data]
---

# Keep automatic protection useful beyond the retained-copy limit

The preservation epic's aggregate review identified a follow-up for the private
vault's 512 immutable-copy limit. At capacity, automatic backup safely pauses and
keeps existing copies, but new edits remain local until capacity is available.
The existing design does not promise indefinite automatic protection.

Track a retention/capacity policy before normal usage reaches that boundary.
Revisit when fewer than roughly 128 copies remain; this is a review trigger, not
an authorized deletion policy. Preserve prior recovery points and explicit owner
control. Consider whether the full-capacity status should retain the portable-file
backup hint and state plainly that new edits have no verified online copy.

Grounding: preservation epic review F1 (2026-10-18),
`web/src/private-vault/contract.ts`, `web/src/automatic-backup/coordinator.ts`,
and the private-vault and automatic-backup feature records. No cloud deletion,
quota change, retention change, or billing action is authorized by this capture.

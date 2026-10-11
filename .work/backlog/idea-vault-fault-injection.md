---
id: idea-vault-fault-injection
created: 2026-10-11
updated: 2026-10-11
tags: [security, data]
---

The private-vault standard implementation review (`20261011T162201Z-d5498093`)
identified useful follow-up coverage around native transport failure boundaries:
the exact first-401 → forced token refresh → one retry sequence has not been
fault-injected, although native renewal and authenticated operations pass live.
The deadline tests exercise cancellation and worker reuse through a callback;
they do not emulate every Android socket failure. Keep those evidence limits
explicit rather than claiming all native transport branches are tested.

The same review noted that interrupted partial staging can remain until process
restart and that rename durability does not include a directory fsync. Startup
cleanup, preserved SQLite data and missing-stage reconciliation bound the current
impact; neither state acknowledges an online backup without verified readback.
These are follow-up resilience and coverage concerns, below the current release's
material fixes. Revisit with representative filesystem/power-loss and network
fault evidence; do not weaken immutable history or delete uncertain sealed files
to simplify cleanup.

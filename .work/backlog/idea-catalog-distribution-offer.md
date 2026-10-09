---
id: idea-catalog-distribution-offer
created: 2026-10-09
updated: 2026-10-09
tags: [data, infra]
---

# Pair a shipped catalog offer with an approved available artifact

The final resumption review (`20261009T192218Z-bf3edf1e`) identified a lower-risk
follow-up for the existing distribution milestone: clean CI builds include the
tracked legacy manifest while its database binary is intentionally ignored. Manage
can therefore present an offer, then report HTTP/size failure after explicit
consent. Local authored work remains available; this does not block the private
local catalog slice or enable deployment.

Before public or native distribution, make the offered source match the authorized,
available artifact (or withhold the offer when no artifact is provided). Native
prototype builds copy web/public, so a locally present private snapshot is packaged
there too. Preserve the current no-public-distribution gate and account for both
clean CI and privately provisioned builds. Decide the packaging/offer policy with
that milestone rather than adding a download bypass or committing the binary now.

---
id: idea-share-domain-validation-invariants
created: 2026-08-02
updated: 2026-09-12
tags: [data, refactor]
---

Extract shared domain constants or validators for appearance roles, effect kinds,
palette size, intensity bounds, and spatial recipe validation still repeated by
draft-storage and portable-playlist codecs. Period bounds and recipe-version
requirements already use shared domain definitions. Keep both schemas independent
and fail-closed while preventing future domain-invariant drift that could make a
locally valid climb unshareable. Preserve current validation behavior; this remains
the maintenance follow-up accepted during the portable-sharing review.

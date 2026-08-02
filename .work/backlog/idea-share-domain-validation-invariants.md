---
id: idea-share-domain-validation-invariants
created: 2026-08-02
updated: 2026-08-02
tags: [data, refactor]
---

Extract shared domain constants or validators for appearance roles, effect kinds,
palette size, period, and intensity bounds currently repeated by draft-storage and
portable-playlist codecs. Keep both schemas independent and fail-closed while preventing
future domain-invariant drift that could make a locally valid climb unshareable. This
maintainability follow-up was accepted during the standard portable-sharing review;
the current bounds were verified byte-for-byte equivalent.

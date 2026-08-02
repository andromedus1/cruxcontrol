---
id: idea-fullride-artwork-metadata-authority
created: 2026-08-02
updated: 2026-08-02
tags: [ui, refactor]
---

Single-source the private Fullride artwork width, height, and SHA-256 metadata. Those
immutable values currently appear in the resolver type, resolver value, and reference
test. The real-file test protects the source asset, but one authority would remove the
possibility of resolver-only metadata drift.

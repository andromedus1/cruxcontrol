---
id: idea-catalog-preview-gzip
kind: story
stage: implementing
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-10-09
updated: 2026-10-09
tags: [data, infra]
---

# Real catalog fails installation through Vite preview

Root's isolated production-browser check on port 4178 clicked the real manifest's
Download 5.1 MB action. It fails with `Catalog response exceeded its declared size
limit`. The gzip artifact matches the manifest size (5,122,102 bytes), but Vite
preview sends `Content-Encoding: gzip`; browser Fetch transparently decodes it to
12,410,880 raw bytes before the bootstrap's compressed-size guard/decompressor.
Synthetic route.fulfill coverage did not exercise actual static-file serving.
Evidence outside Git: `/tmp/cruxcontrol-real-catalog-run.log` and failure screenshot.
No authored/personal data involved. Resolve the actual serving/download boundary
without weakening byte/hash limits or publicly distributing the private snapshot.

## Scope and fix design

Small standalone correction to the actual local static-serving path, authorized by
completion of the catalog feature. Root owns implementation and bounded inline
review; no independent story review. Vite's bundled sirv treats literal `.gz` paths
as HTTP Content-Encoding gzip. Its send function preserves middleware-set headers.
Add one narrow Vite middleware for `/catalog/<basename>.db.gz` that marks the file
as `application/gzip` with identity HTTP encoding, in both dev and preview. Reuse
Vite's static serving; do not add a file reader/server, weaken bootstrap checks,
rename the artifact contract, or change deployment. The same raw-byte requirement
must be explicit in the hosting documentation.

Regression coverage starts actual isolated Vite dev and preview servers with a tiny
synthetic gzip file. Fetch must receive the exact gzip bytes and MIME type while
normal assets keep their usual handling. Tests need no real snapshot. Verify red
before the fix, green after, then repeat the original real-snapshot browser flow.

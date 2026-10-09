---
id: idea-catalog-preview-gzip
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

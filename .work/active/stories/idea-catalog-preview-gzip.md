---
id: idea-catalog-preview-gzip
kind: story
stage: review
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

## Verification and implementation notes

- Root (quality-first, bounded infrastructure correction) implemented only a narrow
  pre-static-serving header middleware in `web/vite.config.ts`, reused by dev and
  preview; no application installer or byte/hash validation changed.
- `web/src/pwa/catalog-static-serving.test.ts` starts isolated real Vite servers
  with a tiny synthetic gzip. Both tests failed before the fix because Fetch
  received decoded raw bytes; both pass after it and ordinary-file behavior remains
  unchanged. Red/green logs: `/tmp/cruxcontrol-catalog-serving-{red,green}.log`.
- Web lint, typecheck, and the full unit suite pass (96 files, 798 tests).
- Original production reproduction now passes against the privately restored real
  snapshot on isolated port 4178: explicit manifest/download consent, 25 visible
  first-page compatible climbs, detail rendering, name/native-grade filtering, and
  reopening through the service worker offline without another catalog request.
  No page errors. Scratch result `/tmp/cruxcontrol-real-catalog-result.json`; real
  catalog contents/screenshots and test browser data remain outside Git.
- One scratch verification selector was corrected from exact `Grade`/`V4` to the
  rendered grade control and native label `6b+/V4`; this was test harness debt,
  not a product defect. No production assertions were weakened.
- README records the HTTP representation contract. No public deployment, catalog
  binary commit, phone update, or personal-library access occurred.

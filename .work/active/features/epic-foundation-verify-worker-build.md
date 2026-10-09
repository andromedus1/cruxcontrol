---
id: epic-foundation-verify-worker-build
kind: feature
stage: drafting
tags: [infra]
parent: epic-foundation
depends_on: [kilter-community-browser]
release_binding: null
gate_origin: review
created: 2026-06-14
updated: 2026-10-09
---

# Verify Worker + WASM Bundling Under Production Build

## Brief

Filed from the deep review of `epic-foundation-sqlite-readpath` (2026-06-14,
Approve-with-comments). The SQLite read path ships `worker: { format: 'es' }` in
`web/vite.config.ts` and a `new Worker(new URL('./catalog.worker.ts', import.meta.url),
{type:'module'})` spawn, but **nothing imports `SqliteCatalogPort` from the app entry
yet**, so the worker chunk + the `wa-sqlite-*.wasm` asset are not in the `vite build`
graph. The config is therefore prepared but UNEXERCISED — the implementation note's
"verified via a throwaway entry" is not reproducible in CI and will silently rot.

`kilter-community-browser` wires the lazy catalog service into the application runtime
and becomes the first production consumer. Bootstrap owns nonvisual storage and its
focused worker tests. This item verifies the real application graph, so it waits for
the browser integration and makes worker/WASM emission explicit rather than incidental.

## Acceptance criteria
- [ ] After community-browser integration, `npm run build -w @cruxcontrol/web` emits the
      `catalog.worker-*.js` chunk and the hashed `wa-sqlite-*.wasm` asset into `dist/`.
- [ ] A CI-checkable assertion (or smoke test) confirms those artifacts are emitted, so
      the worker/WASM bundling can't silently regress.
- [ ] If `vite build` reveals worker/WASM bundling issues (the design's flagged risk),
      they are fixed and the fix noted.

## Notes
- Cheapest form: a post-build assertion that greps `dist/assets/` for the worker + wasm.
- A full browser e2e of the real OPFS `AccessHandlePoolVFS` path is broader than this
  item — that remains the deferred manual/e2e coverage from the readpath decision.

## Foundation references
- `epic-foundation-sqlite-readpath` — the read path whose build graph this verifies.
- `epic-foundation-catalog-bootstrap` — first real consumer of the worker.

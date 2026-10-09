---
id: epic-foundation-verify-worker-build
kind: feature
stage: implementing
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

The production build needs a durable assertion that the application includes the
catalog worker and its referenced SQLite WASM. A standalone test entry can exercise
the worker while leaving the application import missing. `kilter-community-browser`
wires the lazy catalog service into the real application runtime; this feature checks
that resulting production graph through the existing PWA artifact checker.

Design is complete; implementation is pending the unmet `kilter-community-browser`
dependency. No production artifact verification is claimed by this design pass.

## Acceptance criteria
- [ ] The normal production build emits a catalog worker reachable from the application
      entry and the hashed `wa-sqlite-*.wasm` referenced by that worker's module graph.
- [ ] The existing PWA checker fails on missing or unreferenced worker/WASM assets,
      even if matching orphan files from a test harness exist in the output directory.
- [ ] The catalog worker and referenced WASM are precached as app code; catalog database
      exclusion, private artwork, manifest, and icon checks remain effective.
- [ ] CI runs the checker unconditionally after its normal production build. Unit tests
      use isolated filesystem fixtures and never reuse or implicitly build shared `dist/`.
- [ ] Verification needs no legacy catalog snapshot, new test entry, separate build
      harness, public data commit, or deployment.

## Design decisions

Resolved under the active autopilot on 2026-10-09:

- Extend `web/scripts/check-pwa-build.mjs` rather than create a second build checker.
  Its current companion test may accept an old `dist/sw.js` or build the app before
  CI builds it again; replace that arrangement with fixture tests plus a post-build
  CI invocation against the fresh output.
- Keep `web/package.json`'s build command unchanged. The PWA generation fixtures in
  `web/e2e/support/pwa-builds.ts` forward `--outDir` through `npm run build`; adding
  another command to that shell chain would redirect those arguments incorrectly.
- This is a build-artifact guarantee, not execution proof. Bootstrap owns real-worker
  synthetic-browser storage tests; community-browser owns consented installation and
  offline reopening through the real application. Do not duplicate those harnesses.
- No UI is introduced, so mocks are unnecessary. Standard feature review applies;
  this bounded build-tool change does not warrant design advisory delegation.

## Architectural choice

A filename glob is cheap but can pass for orphan test-harness assets. A new build
manifest/plugin or dedicated smoke-build entry adds another mechanism and can miss
the real application dependency. Extend the existing checker with a narrow traversal
of emitted module references, starting at the production HTML entry. It verifies the
relationship between app, worker, and WASM using the actual build output.

## Implementation units

### 1. Follow the production application references

Files: `web/scripts/check-pwa-build.mjs` and
`web/scripts/check-pwa-build.d.mts`. Preserve the existing exported entry point and
add the two verified, slash-separated paths relative to `distDir` to its result:

```typescript
export function checkPwaBuild(distDir?: string): {
  iconCount: number;
  precacheReferencesDb: boolean;
  precacheReferencesPrivateArtwork: boolean;
  catalogWorkerAsset: string;
  catalogWasmAsset: string;
};
```

This is the trickiest unit. First inspect the dependency's actual normal production
output, then implement only the generated forms needed by this Vite build:

1. Read `index.html`'s local module script entry URLs. Follow their emitted static and
   literal dynamic JS imports, using a visited set. Resolve relative references against
   the importing file and root-relative references against the build root; strip query
   and fragment suffixes. Never traverse outside `distDir` or fetch remote resources.
2. In those reachable app modules, identify Vite's emitted `new Worker(new URL(...))`
   reference to `catalog.worker-<hash>.js`. Require one existing, nonempty worker file;
   accept variable hash lengths rather than a pinned hash or exact current filename.
3. Starting at that worker, follow emitted JS imports to its SQLite glue and the
   literal WASM URL it references. Require one existing, nonempty hashed
   `wa-sqlite-<hash>.wasm` with the WASM magic header `00 61 73 6d`. Do not substitute
   an unrelated matching file when a referenced target is missing.
4. Require the resolved worker and WASM paths in the generated SW precache alongside
   the existing artwork check. Preserve catalog `.db`/`.db.gz` exclusion and existing
   manifest/icon validation. Compare normalized full paths, not just basenames.

Keep reference extraction local to this script and limited to emitted import/Worker/
WASM URL forms. Do not traverse all quoted filenames: following the registration URL
into `sw.js` would make its precache list incorrectly admit orphan worker assets. No
recursive directory scan, new parser dependency, source-file assertion, or build
manifest is needed. This is a static emission check, not a JavaScript execution parser.

Use the existing throw-on-first-failure convention, with errors naming the missing
entry, reference, target, or precache path. The CLI reports the two verified paths and
exits nonzero on failure. Update stale comments about return values and unit tests.

### 2. Check the fresh normal CI build

File: `.github/workflows/ci.yml`. Immediately after the web job's existing Build step,
before browser tests, add:

```yaml
- name: Verify PWA and catalog build artifacts
  run: node web/scripts/check-pwa-build.mjs
```

Do not change build argument forwarding, add another Vite build, run this PWA-specific
checker against `dist-ios-prototype`, or enable deployment. A bundling defect exposed
by this check must be corrected at its real import/configuration boundary and recorded
here; do not add a test entry to force asset emission.

## Implementation order

After `kilter-community-browser` satisfies its dependency, implement the reference
check and isolated tests, then add the CI step and verify the fresh normal build. One
owner can complete this in one stride; no child stories are needed.

## Testing

`web/src/pwa/check-pwa-build.test.ts` becomes a Node-environment contract test using
per-test temporary build directories, cleaned after each test. Remove `beforeAll`'s
implicit Vite build and shared `dist/` reuse. Fixtures contain tiny synthetic files:
valid manifest/icons, index/module references, worker/glue references, a WASM header,
and generated-SW-shaped precache entries. No catalog records or real DB are necessary.

- A valid app entry → lazy module → worker → SQLite glue → WASM chain passes with
  normalized returned paths; cover relative and root-relative emitted references.
- Matching orphan worker/WASM files and their SW precache entries cannot satisfy a
  missing application-to-worker reference. Include a normal SW registration URL so
  accidental traversal into the precache list is caught.
- Missing referenced worker, missing glue, missing WASM, invalid WASM header, and
  missing worker/WASM precache entries fail with the relevant path in the diagnostic.
- Preserve meaningful negative coverage for missing manifest/icon/SW, catalog DB
  precaching, and missing private artwork; retain one positive PWA prerequisite case.

Run the focused Vitest file, applicable lint/typecheck, then the normal production
build followed by `node web/scripts/check-pwa-build.mjs`. CI runs that same sequence
against its fresh build and keeps the existing browser suites. Unit fixtures prove
checker behavior; the CI invocation proves actual application emission. Do not claim
runtime, OPFS, physical-device, source coverage, or download-consent proof from this item.

## Risks

- **Generated syntax changes:** Vite may emit a different reference shape. Fail closed
  with a useful diagnostic; update the bounded extractor and its fixture to the actual
  production output. The first implementation step inspects that output, rather than
  inventing an emitted string format. Reconsider a build metadata hook only if a real
  output change makes the small checker insufficient.
- **False confidence from stale or orphan output:** the explicit post-build CI step
  and app-rooted traversal are required together. Shared-dist tests, directory globs,
  and precache-list traversal would weaken this guarantee.
- **Emission is narrower than execution:** valid files and references can still fail
  at runtime. The owning bootstrap/browser suites retain that responsibility; this
  feature must not broaden into a duplicate installation harness.

## Foundation references
- `epic-foundation-sqlite-readpath` — the read path whose build graph this verifies.
- `epic-foundation-catalog-bootstrap` — nonvisual storage and real-worker test owner.
- `kilter-community-browser` — real application consumer and offline integration owner.
- `web/vite.config.ts` — ES-module worker output and app-code precache configuration.

---
id: epic-library-preservation-private-vault-acceptance
kind: story
stage: done
tags: [data, security, infra]
parent: epic-library-preservation-private-vault
depends_on: [epic-library-preservation-private-vault-native]
release_binding: null
gate_origin: null
created: 2026-10-11
updated: 2026-10-11
---

# Verify application vault transport on isolated installations

## Brief

Complete unit 3 live acceptance with synthetic data in acceptance-v1 only. Preserve emulator library before updates. Prove account session, restart of staged file, immutable retry/conflict, strict readback including 25 MiB, configured signed build and release isolation. Record exact private evidence paths and limits. No production library-v1 synthetic uploads.

## Implementation

The [parent feature](../features/epic-library-preservation-private-vault.md#application-vault-design-2026-10-11)
owns exact contracts, units, acceptance, risks and tests. Keep tokens, personal
contents and private configuration outside Git. Close this child directly on
verified completion; feature review follows all checkpoints.

## Verified checkpoint (2026-10-11)

The deployed service artifact `5048e71c05194a01758a73d8e63dca582352a529cf720a0a991973caf2354687`
contains the shared application/proof algorithm from `de88541`. Deployment and
readback confirmed the existing private bucket/runtime identity and 512 MiB,
concurrency-one, maximum-one-instance settings; the project $5 alert budget is
unchanged. No owner `library-v1` snapshots were seeded by acceptance.

SignedProof20 (final rebuild with the final native sources) passed actual adapter
acceptance against `acceptance-v1/r001`. Fresh whole-library backups were saved
outside Git before updates, decoded and compared canonically. Updating both
synthetic emulators preserved all records and playlist ordering exactly: primary
was empty, the separate installation retained eight climbs and three playlists.
No real phone was operated on.

Verified through the production TypeScript/native port in the actual WebView:

- Configured status, account sign-out/sign-in and forced token renewal; same owner
  on distinct native installation IDs, independent listing after reauthentication.
- A 5,993-byte sealed backup survived force-stop/relaunch, uploaded, listed and
  downloaded exactly. Identical retry returned identical receipt/generation.
- A structured 26,188,396-byte library (10,000 climbs, 1,000 playlists, 100,000
  ordered memberships, Unicode names, grades, drafts, Trash and effects) staged,
  survived restart, uploaded and downloaded on the other installation; SHA-256
  matched exactly. Actual 512 MiB service handled it successfully. This does not
  establish a worst-case memory ceiling for every possible library.
- An exact 25 MiB codec-valid fixture passed staging, upload and downloaded
  readback. It supplements, rather than substitutes for, the structured fixture.
- Different bytes targeting occupied slot `00000` returned `conflict`; the
  original object remains. Slots `00000`–`00002` are retained synthetic evidence.
- Legacy proof slot `00` remains readable with its prior digest after the common
  account extraction and service deployment.
- Configured release21 is non-debuggable, includes native account/vault plugins,
  selects `library-v1` and excludes proof plugin/activity/config. Unconfigured
  compile-only debug build succeeds and reports no vault config/proof surface.

Private reproducible evidence lives under
`.private-firebase/application-transport-acceptance/` (build logs, fresh backup
comparisons, operation receipts and downloaded files), with the service artifact
under `.private-firebase/application-service-1/`. No credentials, account IDs,
installation IDs or actual user library contents are committed. The committed
`android-vault-proof.mjs` invokes the real adapter with synthetic input on explicit
emulators; `verify-structured.mjs` separately exercises the real HTTP handler with
a 384 MiB Node heap and fake store, documenting the excluded SDK/runtime overhead.

Local verification remains the native child’s green web/prototype/gateway suites.
The initial legacy-driver invocation raced process startup; retry after startup
succeeded. This was a driver timing failure, not a service/storage failure.

This is transport acceptance. Automatic revision acknowledgement, visible status,
clean-install recovery through product UI, physical phone/Fullride acceptance and
real-authoring admission remain dependent feature/epic gates.

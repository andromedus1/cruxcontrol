---
id: epic-library-preservation-private-vault-review-fixes
kind: story
stage: done
tags: [security, data, infra]
parent: epic-library-preservation-private-vault
depends_on: [epic-library-preservation-private-vault-acceptance]
release_binding: null
gate_origin: null
created: 2026-10-11
updated: 2026-10-11
---

# Close verified vault review gaps before automatic backup admission

## Scope and evidence

Absorbs `idea-vault-stale-download` (parked in `517cc56`) and the material
findings from the standard Claude pass `20261011T162201Z-d5498093`.
Root reproduced late sign-out during download cleanup: the adapter returned
`returned-stale-content` instead of `account-changed`. This is current-cycle
contract work under the existing feature, not a new product direction.

## Required fixes and verification

- Recheck the native session and adapter generation after downloaded content
  validation and native cleanup, before resolving content. Keep cleanup valid for
  an old session. Cover deferred cleanup and same-owner reauthentication.
- Validate application metadata before immutable create. A codec-valid extended
  year can currently create an unreadable object that poisons every pool listing.
  A regression must show 400, no write, and prior history still discoverable.
- Bound native token acquisition and the whole network transfer, including upload
  writes, so one stalled request cannot monopolize the serialized file/transfer
  worker indefinitely. Preserve staged bytes on every timeout/unknown outcome.
  Verify deadline/error behavior proportionately and compile the actual Java.
- Separate local file failures from network failures in the bounded error mapping;
  storage failure must not tell the user they are offline. Correct the adapter
  harness's abort semantics to retain sealed files and cover authoritative retain.
- Prevent debuggable application builds selecting the real library namespace,
  both natively and in package checks. Preserve explicit isolated signedProof
  acceptance and unconfigured compile-only CI.
- Roll stale foundation acceptance wording forward, retaining unfinished automatic
  recovery, physical phone/Fullride and real-authoring gates.

## Ownership

Root owns adapter/contract/gateway/packaging fixes, service redeployment, evidence
and review adjudication. The existing native vault worker owns only Java session,
transfer and local error boundary plus focused tests. Root coordinates doc edits.
Automatic-backup worker remains on disjoint library/coordinator/UI files. No
private data, secrets or device identifiers enter Git. Keep one completion commit
for this checkpoint; standard feature review needs fix verification, not another
independent pass.

## Verified completion

- Late download completion rechecks both adapter generation and native account
  epoch after cleanup. Deferred sign-out and same-owner reauthentication regressions
  pass; the original failing assertion returned stale content.
- Application metadata is checked before immutable creation. Gateway 17 tests pass,
  including the formerly failing extended-year regression. The updated artifact
  `9cd3b6d59b867435d4766d9bc1e6c9efdfa5fb8c47ffd3dc20926f9b446f2dee`
  is deployed and read back ACTIVE with unchanged service bounds. Live native
  upload rejects that timestamp and preserves all three prior copies and hashes.
- Native token waits have a 30-second bound; each request/download has a
  180-second watchdog that disconnects its HTTP connection and interrupts the
  current worker. Disarming prevents an old watchdog interrupting subsequent work.
  Five JVM tests and debug Java compilation pass; CI now runs those tests.
  Android's [HTTP implementation](https://android.googlesource.com/platform/prebuilts/fullsdk/sources/+/refs/heads/androidx-constraintlayout-release/android-35/com/android/okhttp/internal/huc/HttpURLConnectionImpl.java)
  routes disconnect to engine cancellation. Callback tests establish deadline
  ownership and reuse, not every possible real socket failure.
- Local file and HTTP errors have separate bounded mappings. Stream acquisition
  failures close earlier resources. Test abort preserves sealed stages, and
  authoritative retention has explicit adapter coverage.
- Native configuration, package validators and tests reject production scope in
  debuggable builds. SignedProof22 selects isolated r001; non-debuggable release23
  selects library-v1 and excludes proof activity/plugin/config. Both builds pass.
- Prototype lint/typecheck, 109 prototype tests and 11 package/config tests pass.
  Fresh external backups were compared with both emulators after upgrade; empty
  and eight-climb/three-playlist libraries remain exact through v2 migration and
  relaunch. The retained native stage retries with its original immutable receipt;
  structured readback again verifies 26,188,396 bytes, 10,000 climbs and 1,000 lists.
- Foundation wording is corrected in `744b0cc`. Remaining native fault-injection,
  partial cleanup and directory-sync concerns are parked in
  `idea-vault-fault-injection` with their bounded current impact, not silently
  counted as verified. Integrated automatic recovery and physical board gates
  remain separate and unfinished.

Private evidence: `.private-firebase/review-update-acceptance/` and
`.private-firebase/application-service-2/`. No phone, user records or real backup
namespace was modified. Standard review fix verification is complete; the parent
awaits the required CI result before final review closure.

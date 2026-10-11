---
id: epic-library-preservation-private-vault-review-fixes
kind: story
stage: implementing
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

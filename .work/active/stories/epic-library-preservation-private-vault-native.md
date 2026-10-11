---
id: epic-library-preservation-private-vault-native
kind: story
stage: done
tags: [data, security, infra]
parent: epic-library-preservation-private-vault
depends_on: [epic-library-preservation-private-vault-service]
release_binding: null
gate_origin: null
created: 2026-10-11
updated: 2026-10-11
---

# Transfer account-bound backups through durable native files

## Brief

Implement units 2 and the packaging portion of 3: shared native account path, durable bounded staging and streamed authenticated transport, strict TypeScript adapter, ignored variant configuration and build isolation. Verify synthetic local tests and Android compilation; host performs live device acceptance.

## Implementation

The [parent feature](../features/epic-library-preservation-private-vault.md#application-vault-design-2026-10-11)
owns exact contracts, units, acceptance, risks and tests. Keep tokens, personal
contents and private configuration outside Git. Close this child directly on
verified completion; feature review follows all checkpoints.

Implemented the shared native Firebase account session and production
`PrivateVault` Capacitor plugin. Firebase identity and ID tokens remain in
native code; JavaScript receives only account status and the typed vault port.
Application requests use the fixed HTTPS gateway and the five-digit
`library-v1` pool. Acceptance scopes are restricted to the signed, debuggable
proof variant and its four bounded run pools. The legacy proof path still uses
its separate two-digit pool through the shared account session.

Staging is account-and-scope bound under `noBackupFilesDir`; decoded chunks are
limited to 64 KiB, sealed only after size and SHA-256 verification, fsynced,
and atomically renamed. Sealed files survive process restarts, while partial
stages and download temporaries are removed at plugin startup. Uploads use
immutable create and verify the receipt; downloads stream to a private native
file and cross the bridge as bounded Base64 UTF-8 byte ranges. Native account
epochs and adapter generations reject stale results immediately when sign-in
or sign-out begins, including same-account reauthentication.

The adapter strictly validates snapshots and receipts and incrementally
decodes downloaded UTF-8 before running the library-backup codec. Content
counts are derived from the decoded backup. Missing, corrupt, wrong-account,
wrong-scope, stale-session, oversized, and malformed transfer cases are
covered by adapter and gateway tests. Root-owned variant config generation,
build isolation checks, and the actual-adapter proof driver are included in the
native checkpoint after packaging verification.

Validation: `npm --prefix prototypes/ios run typecheck`, `lint`, and `test`
passed (100 tests plus 10 package/config checks); `npm --prefix web run
typecheck`, `lint`, and `test` passed (838 tests); and
`npm --prefix prototypes/firebase-vault/gateway test` passed (16 tests).
The final signedProof20 rebuild and APK packaging checks passed after a
timestamp check caught a later shared-session edit than the first compiled
class. On emulator 5590, the installed update preserved the exact baseline
library, and the actual TypeScript adapter completed configured
`acceptance-v1/r001` status, list, and a 5,993-byte stage. Advanced acceptance
and upper-size transfer evidence remain owned by the parent acceptance story.

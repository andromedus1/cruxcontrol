---
id: epic-library-preservation-private-vault-native
kind: story
stage: implementing
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

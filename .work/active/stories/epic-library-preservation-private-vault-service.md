---
id: epic-library-preservation-private-vault-service
kind: story
stage: done
tags: [data, security, infra]
parent: epic-library-preservation-private-vault
depends_on: [epic-library-preservation-native-library]
release_binding: null
gate_origin: null
created: 2026-10-11
updated: 2026-10-11
---

# Serve isolated immutable application snapshots

## Brief

Implement unit 1 of the parent application-vault design: shared strict port and contracts, explicit proof/application/acceptance pools, the existing authenticated conditional-write algorithm, and focused route/store/contract tests.

## Implementation

The [parent feature](../features/epic-library-preservation-private-vault.md#application-vault-design-2026-10-11)
owns exact contracts, units, acceptance, risks and tests. Keep tokens, personal
contents and private configuration outside Git. Close this child directly on
verified completion; feature review follows all checkpoints.

## Implementation notes
- Execution capability: one inline worker; the service and shared contract are a cohesive checkpoint with no environment or device operations.
- Review weight: standard from `.work/CONVENTIONS.md`; this child checkpoint closes on verification and does not receive a separate review pass.
- Files changed: `web/src/private-vault/{types,contract,contract.test}.ts`; `prototypes/firebase-vault/gateway/{contract,handler,gcs-store,index}.mjs` and their focused tests; `prototypes/firebase-vault/{prepare-service,cost-estimate}.mjs`.
- Tests added: strict shared response-decoder tests; application and acceptance route isolation, five-digit slot/capacity, codec-derived history metadata, canonical GCS metadata and malformed receipt tests. Existing proof behavior and conditional-create tests remain active.
- Simplification: the existing authenticated handler and GCS store now select explicit pool definitions; exact PUT readback reuses the already-decoded request only after byte equality and digest checks, while GET always decodes stored bytes.
- Discrepancies from design: incorporated the accepted advisory before application storage was introduced: five-digit slots, `exportedAt` and server-derived counts, and four bounded acceptance runs. No unresolved discrepancy.
- Adjacent issues parked: none.
- Verification: gateway suite 16/16; shared contract tests 11/11; web typecheck passed; aggregate-capacity cost estimate rendered with 2,592 configured slots and remains illustrative, not a spending cap.

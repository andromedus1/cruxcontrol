---
id: epic-library-preservation-private-vault-acceptance
kind: story
stage: implementing
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

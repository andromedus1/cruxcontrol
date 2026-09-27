---
id: epic-shared-climb-library-invited-access-delivery
kind: story
stage: drafting
tags: [ui, security, infra]
parent: epic-shared-climb-library-invited-access
depends_on: [epic-shared-climb-library-invited-access-provider-proof, epic-shared-climb-library-invited-access-client]
release_binding: null
gate_origin: null
created: 2026-09-26
updated: 2026-09-27
---

# Deliver and recover the invited service through CI

## Brief

Implement Unit 4 of the parent design: concrete environment configuration, CI-gated deployment and migrations, operator invite/revoke/identity repair, synthetic backup/restore and compatible rollback. Re-run hosted checks against the real integrated client.

## Implementation

The [parent feature](../features/epic-shared-climb-library-invited-access.md)
owns the exact interfaces, files, acceptance criteria, tests, risks and implementation
order. Follow its corresponding unit; do not duplicate or independently redesign
the contract here.

Actual resource configuration, successful provider proof, artwork distribution resolution and required feature review precede rollout. Phone work requires a fresh verified whole-library backup and original-origin/profile checks. This story is not complete merely because CI passes.

## Design hold

Reopened with the parent on 2026-09-27: establish the iOS shell and native access
contract before implementing the prior web-only design. See the parent’s current
design hold; this story is not ready for implementation.

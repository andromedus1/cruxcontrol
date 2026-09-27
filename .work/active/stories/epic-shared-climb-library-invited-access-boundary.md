---
id: epic-shared-climb-library-invited-access-boundary
kind: story
stage: drafting
tags: [ui, security, infra]
parent: epic-shared-climb-library-invited-access
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-26
updated: 2026-09-27
---

# Verify shared requests and bind invited members

## Brief

Implement Unit 1 of the parent design: verified human identity, current membership, explicit idempotent enrollment, fixed sign-in completion page, and fail-closed API routing. Include the stable Worker/D1 tooling, generated binding types and compatible Node/CI baseline required to run the service locally.

## Implementation

The [parent feature](../features/epic-shared-climb-library-invited-access.md)
owns the exact interfaces, files, acceptance criteria, tests, risks and implementation
order. Follow its corresponding unit; do not duplicate or independently redesign
the contract here.

Locally signed tokens, real local D1 migrations and concurrent enrollment/revocation tests establish the service contract. No real account, production data or deployment is needed for this story.

## Design hold

Reopened with the parent on 2026-09-27: establish the iOS shell and native access
contract before implementing the prior web-only design. See the parent’s current
design hold; this story is not ready for implementation.

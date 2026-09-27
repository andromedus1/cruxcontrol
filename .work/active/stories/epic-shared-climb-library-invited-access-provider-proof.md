---
id: epic-shared-climb-library-invited-access-provider-proof
kind: story
stage: drafting
tags: [ui, security, infra]
parent: epic-shared-climb-library-invited-access
depends_on: [epic-shared-climb-library-invited-access-boundary]
release_binding: null
gate_origin: null
created: 2026-09-26
updated: 2026-09-27
---

# Prove email-code access on the actual provider

## Brief

Implement Unit 2 of the parent design using an isolated minimal proof shell and fictional membership data. Check real account entitlements, routes, email delivery, request cost/CPU and Android browser/installed-PWA return behavior.

## Implementation

The [parent feature](../features/epic-shared-climb-library-invited-access.md)
owns the exact interfaces, files, acceptance criteria, tests, risks and implementation
order. Follow its corresponding unit; do not duplicate or independently redesign
the contract here.

Andrew has no hosting account or domain. Account setup is an external prerequisite for the live part; local scaffolding can proceed. Record sanitized hosted evidence in the parent. Mocked tests cannot close this story.

## Design hold

Reopened with the parent on 2026-09-27: establish the iOS shell and native access
contract before implementing the prior web-only design. See the parent’s current
design hold; this story is not ready for implementation.

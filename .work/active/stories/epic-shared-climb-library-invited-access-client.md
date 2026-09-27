---
id: epic-shared-climb-library-invited-access-client
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

# Enter the shared area while preserving local sessions

## Brief

Implement Unit 3 of the parent design using the approved entry mockup and existing inline status/retry patterns. Integrate the typed session client, explicit sign-in/check flow, independent local navigation, and service-worker route exclusions.

## Implementation

The [parent feature](../features/epic-shared-climb-library-invited-access.md)
owns the exact interfaces, files, acceptance criteria, tests, risks and implementation
order. Follow its corresponding unit; do not duplicate or independently redesign
the contract here.

Use workspace and controlled-PWA tests to verify editor/playlist preservation, stable board controller identity, correct expired/denied/unavailable handling and safe updates. Keep the rollout opt-in disabled until provider proof and delivery checks complete.

## Design hold

Reopened with the parent on 2026-09-27: establish the iOS shell and native access
contract before implementing the prior web-only design. See the parent’s current
design hold; this story is not ready for implementation.

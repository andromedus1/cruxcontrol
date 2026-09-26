---
id: epic-shared-climb-library-invited-access
kind: feature
stage: drafting
tags: [ui, security, infra]
research_refs:
  - .research/analysis/briefs/invited-offline-library.md
parent: epic-shared-climb-library
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-26
updated: 2026-09-26
---

# Enter the invited shared library

## Brief

Let an invited member enter the shared area through email-code sign-in while the
local application remains usable without a session. Establish a verified identity
and current membership boundary for every shared request, operator-managed access
and revocation, and clear signed-out/expired/unavailable states. Returning from
sign-in must preserve the user's task without forcing an active editor or connected
board session to reload.

This slice owns the real hosting/session proof as well as the first application
entry. Validate the researched Access + Worker + D1 candidate against the actual
account, hostname, plan/cost, mobile return path, and all reachable API routes before
selecting production deployment. Reject untrusted identity, stale membership, and
cross-origin mutations; isolate preview data. Include CI deployment/rollback and
service recovery procedures proportional to this one-circle service. Local tests
alone do not establish a working hosted invitation path.

There is no public signup, in-app administration console, shared climb publication,
or private-library synchronization in this feature. No account or resources have
been provisioned. If the candidate fails its proof, use the researched alternative
and revise the owning design before growing a provider abstraction.

## Epic context

- Parent: [shared-library epic](../epics/epic-shared-climb-library.md).
- First capability and highest external uncertainty; publication consumes its
  authenticated member boundary. Existing static hosting is groundwork, not proof
  of a protected collaboration service.

## Inherited design decisions

- One invited partner/friends circle; operator-managed invitations and revocation.
- Email-code journey approved; hosted provider form may differ from the illustration.
- Local climbs, playlists, editor, backups, and Android board control do not require
  shared sign-in. Auth failure cannot clear local data or force an app update.
- Current membership authorizes requests; a valid identity token alone is insufficient.
- Cloudflare is conditional on the proof above. Credentials and member addresses
  stay outside committed fixtures and client bundles.
- Any phone-origin change follows the standing library-preservation instructions.
  Artwork distribution must be resolved for any newly hosted application audience.

## Research briefs

- [Invited/offline library comparison](../../../.research/analysis/briefs/invited-offline-library.md)
  — access, revocation, Static Assets identity limitation, session and route proof.

## Foundation references

- `docs/SPEC.md` — shared contributed library and independent local use.
- `docs/ARCHITECTURE.md` — intended collaboration boundary and update admission.
- `docs/DEPLOY.md` — existing CI deployment path; recheck actual configuration.

## Mockups

- Inherits `.mockups/design-system/`.
- Approved 2026-09-26: [entry](../../../.mockups/flows/shared-library/01-entry.html)
  and [illustrative sign-in](../../../.mockups/flows/shared-library/02-sign-in.html).
- Preserve all existing workspace destinations and persistent board controls.
  Expiry/error notices reuse existing inline status/retry components; there is no
  new member-management UI.

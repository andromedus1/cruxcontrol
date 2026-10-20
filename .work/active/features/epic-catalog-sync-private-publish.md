---
id: epic-catalog-sync-private-publish
kind: feature
stage: drafting
tags: [infra, security]
parent: epic-catalog-sync
depends_on: [epic-catalog-sync-append-only-guards]
release_binding: null
gate_origin: null
created: 2026-10-19
updated: 2026-10-19
research_refs:
  - .research/analysis/campaigns/kilter-current-catalog-sources/parent.md
---

# Scheduled Build and Private, Signed-In Catalog Publication

## Brief

A scheduled GitHub Actions workflow (weekly by default; cadence configurable and
intentionally relaxed) fetches the Boardsesh manifest once, runs normalization and
reconciliation, and, when every guard passes, publishes the new artifact and manifest
to private Google Cloud storage. Prior versions are retained and a last-known-good
pointer only advances on success. A tripped guard or failed run publishes nothing and
opens or updates a single GitHub issue with the diff report; logs and issues never
expose credentials or signed URLs.

Distribution is private: only signed-in users can read the catalog. Devices obtain it
through an authenticated endpoint that verifies the Firebase ID token the Android app
already holds for private backups, and returns the current manifest and a short-lived
download for the artifact. CI writes with a least-privilege identity (no long-lived keys
in the repo). Resources are namespaced apart from the live private-backup vault, which
holds real backups and must not be deleted, recreated or repurposed; infrastructure
changes go through reviewed, CI-applied paths, never a local apply.

It does **not** change the app's install flow (device update) or catalog presentation.

## Epic context

- Parent epic: `epic-catalog-sync`
- Position in epic: consumer of the guards; producer of the endpoint and manifest
  contract the device-update feature calls.

## Inherited design decisions

- Re-host privately behind the existing Firebase sign-in; no public catalog URL.
- Auto-publish when guards pass; tripped guard holds and notifies via GitHub issue.
- Cadence slower than daily is acceptable; fetch each Boardsesh artifact at most once
  per run and never more than daily.

## Research briefs

- [Current Kilter catalog sources](../../../.research/analysis/campaigns/kilter-current-catalog-sources/parent.md) §3 Terms and permissions (use mode c, re-hosting;
  setter attribution; no official-sourcing claim) and implementation notes 1–2, 9–10.

## Foundation references

- `docs/DEPLOY.md` (live private-backup resources; CI-only infrastructure).
- `prototypes/firebase-vault/README.md` (existing Firebase project, gateway, provisioning).
- `docs/ARCHITECTURE.md` §Intended independent preservation boundary.

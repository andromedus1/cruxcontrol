---
title: Native account backups without an assumed monthly service floor
description: Assess Firebase as a usage-priced native backup proof alongside the existing Supabase candidate.
type: brief
kind: research
updated: 2026-10-10
status: locked
provenance: agent-synthesis
verification_status: reviewed-corrections-verified
research_method: /research
summary: >
  Firebase supplies a documented native authentication route and granular storage
  authorization, with usage-based billing and eligible no-cost storage allowances.
  Billing exposure, token persistence, and actual native recovery remain proof
  gates; neither Firebase nor Supabase is selected by documentation alone.
key_findings:
  - Firebase storage requires a billing account even within no-cost allowances.
  - Native authentication does not automatically authenticate a WebView SDK.
  - Storage create/read can be separated from overwrite/delete permissions.
  - Storage budget alerts do not provide a hard spending cap.
  - Native sign-in, renewal, owner isolation and clean-install recovery still need execution evidence.
---

# Native account backups without an assumed monthly service floor

## Position

`extends`: Keep the existing preservation comparison as framing and add a bounded
Firebase proof before treating a fixed monthly plan as necessary. Do not select a
provider merely from its storage price. Test account recovery, session persistence,
renewal, immutable storage, readback and isolated restoration in the target native
client. This brief adds a candidate and cost boundary; it does not reverse the
existing separation of local durability from independent recovery.

## Documented candidate

Firebase exchanges sign-in for an hour-long ID token and a renewable refresh token;
major account changes, user deletion/disablement and revocation can invalidate it.
[backup-service-firebase-sessions]{1} Capawesome documents a Capacitor 8 compatible
authentication plugin using native SDKs, including Google and GitHub providers.
Native sign-in does not itself establish the WebView SDK's session.
[backup-service-firebase-plugin]{2}

Storage Rules separate create, update and delete, and separate get from list;
listing needs Rules Version 2. Overlapping allow rules are additive, and rules are
not filters. [backup-service-firebase-rules]{3}
`extends`: A candidate policy can allow owner-scoped creation and discovery while
withholding client overwrite/delete. This is a design to test against real API
requests, not a demonstrated authorization boundary. Prefer native authenticated
object access rather than assuming native sign-in authorizes a JavaScript client.
The Android SDK provides size-limited byte downloads and stream downloads.
[backup-service-firebase-download]{4}

## Operating boundary

Firebase Storage requires Blaze and a billing account. New default buckets use
Google Cloud Storage pricing, including eligible US-region allowances; legacy
bucket allowances are a different case. [backup-service-firebase-billing]{5}
The applicable monthly free tier lists 5 GB-months of storage, 5,000 Class A and
50,000 Class B operations, plus qualified outbound transfer. It is shared at the
billing-account level and overages are chargeable. [backup-service-google-free]{6}
Storage is absent from Firebase's supported spend-cap services; alerts-only budgets
do not pause services. [backup-service-firebase-budgets]{7}

Supabase Free can pause after one inactive week; its non-pausing Pro plan starts
at USD 25/month. [backup-service-supabase-pricing]{8}
`{inferred: compare}`: Firebase offers a usage-priced alternative to that monthly
floor, with billing exposure instead of a guaranteed zero-cost operation. No
per-user bill is estimated here: retention, snapshot size, upload/readback frequency,
other billing-account usage and abuse controls need measured inputs.

## Contradictions

| Sources | Relationship | Consequence |
|---|---|---|
| [backup-service-firebase-billing]{5} / [backup-service-google-free]{6} | qualifies | No-cost usage does not remove the billing-account requirement or overage liability. |
| [backup-service-firebase-sessions]{1} / [backup-service-firebase-plugin]{2} | qualifies | Native renewable identity does not imply a signed-in WebView SDK. |
| [backup-service-firebase-budgets]{7} / [backup-service-supabase-pricing]{8} | incommensurable | A usage alert and a plan starting price are different controls; neither establishes an all-inclusive spending ceiling. |

## Disconfirming analysis

`extends`: The billing requirement disproves a no-account or guaranteed-free interpretation.
[backup-service-firebase-billing]{5} [backup-service-google-free]{6}
The native/web session distinction defeats a direct substitution of a web SDK
after native login. [backup-service-firebase-plugin]{2}
`extends`: The Rules overlap behavior defeats a policy review that looks
only at one restrictive match. [backup-service-firebase-rules]{3}
`extends`: The source set does not establish secure token
persistence, successful account recovery or an upload rate cap in the native app.
`extends`: Do not base long-lived preservation on a temporary trial.
[backup-service-google-free]{6} Keep independent
portable files and retained good versions even after either service passes.

## Required execution evidence

`extends`: Before choosing production service configuration, prove native sign-in
and return, force-stop/restart, forced token refresh, sign-out/denial, a separate
account's denied access, denied overwrite/delete, interrupted upload/retry and
authenticated exact byte readback. Audit token storage and OS-backup exclusions.
Recover on an isolated empty installation using the account alone, then compare
all library records after relaunch. Establish server-enforced size/access limits,
bounded client scheduling, capacity reporting and explicit billing settings.
No hosted project, credentials, billing account or actual native authentication
has been exercised in this source-only assessment.

## Sources

Entries use descriptive source labels; URLs identify the fetched pages.

1. **backup-service-firebase-sessions** — Manage User Sessions. https://firebase.google.com/docs/auth/admin/manage-sessions (fetched 2026-10-10).
2. **backup-service-firebase-plugin** — Capacitor Firebase Authentication. https://capawesome.io/docs/sdks/capacitor/firebase/authentication/ (fetched 2026-10-10).
3. **backup-service-firebase-rules** — Cloud Storage Security Rules core syntax. https://firebase.google.com/docs/storage/security/core-syntax (fetched 2026-10-10).
4. **backup-service-firebase-download** — Download files on Android. https://firebase.google.com/docs/storage/android/download-files (fetched 2026-10-10).
5. **backup-service-firebase-billing** — Default bucket and billing requirements. https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024 (fetched 2026-10-10).
6. **backup-service-google-free** — Free Google Cloud features. https://docs.cloud.google.com/free/docs/free-cloud-features (fetched 2026-10-10).
7. **backup-service-firebase-budgets** — Avoid surprise bills. https://firebase.google.com/docs/projects/billing/avoid-surprise-bills (fetched 2026-10-10).
8. **backup-service-supabase-pricing** — Supabase pricing. https://supabase.com/pricing (fetched 2026-10-10).

## Verification

Source-direct acquisition and attestations precede synthesis. One independent
adversarial read returned NEEDS-REVISION for bounded wording/marker/bibliography
issues. Corrections: narrow session invalidation to the documented major account
changes; mark and cite composed disconfirming conclusions; identify abbreviated
bibliography labels as descriptive. The lead checked each against the primary
documentation and source attestations. The byte-download wording explicitly scopes
the maximum-size option to byte downloads, not streams. No provider-selection claim
or runtime acceptance was added. Citation lint resolves every chain with no broken
or thin attestations; remaining pattern flags point at a cited capability sentence,
an expressly inferred comparison and a bibliography label. Native/service execution
remains a separate acceptance gate. No second review loop under standard weight.

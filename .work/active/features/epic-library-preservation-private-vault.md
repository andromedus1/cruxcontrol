---
id: epic-library-preservation-private-vault
kind: feature
stage: drafting
tags: [data, security, infra]
research_refs: [independent-library-preservation, native-backup-service-costs]
parent: epic-library-preservation
depends_on: [epic-library-preservation-native-library]
release_binding: null
gate_origin: null
created: 2026-10-10
updated: 2026-10-10
---

# Access private backups through a recoverable account

## Brief

Prove native Android account sign-in, return, session renewal, owner-only authorization and recovery without the old phone. Select the smallest service implementation supported by that proof, with immutable complete snapshots, independent discovery and authenticated readback. Account-protected service-managed encryption is approved; end-to-end encryption and a separate owner key are not required.

Reuse the verified preservation comparison. Compare actual native authentication before choosing hosting; do not infer a workable session from storage primitives. Prepare reviewable configuration, retention/capacity limits and costs before provisioning. Offline authoring remains available during sign-out/outage. Existing backups must be discoverable without a local installation secret; empty/stale clients have no authority to delete or replace them. Sharing membership never authorizes private backup access.

## Epic context

- Parent: `epic-library-preservation` — Android dogfood with parity, independent backup and the older Kilter catalog.
- Inherit the parent’s settled no-interim-PWA, offline-use, dual-backup and account-recovery decisions.
- User target: a private dogfood build in the next few days, contingent on demonstrated platform and recovery behavior rather than an unverified date promise.

## Grounding

- [Preservation comparison](../../../.research/analysis/briefs/independent-library-preservation.md).
- [Specification](../../../docs/SPEC.md), especially private library preservation and current wall-session capabilities.
- [Architecture](../../../docs/ARCHITECTURE.md), especially runtime composition, native transport and independent preservation.
- [Existing native shell](../../../prototypes/ios/README.md); native packaging does not currently imply native library persistence.

## Mockups

- Inherit [library preservation](../../../.mockups/flows/library-preservation/index.html) where backup surfaces apply.
- Existing editor, library, playlist and Kilter browser reuse their current UI; mock only genuinely new structure.
- Andrew’s 2026-10-10 instruction to proceed supplies authorization to continue this prepared direction; no new UI redesign milestone.

## Candidate proof and operating proposal

Supabase is the first native authentication candidate, not a selected production
service. Its rotating sessions and native redirect documentation address a known
gap in the Cloudflare Access candidate. Compare actual Android sign-in, secure
session persistence, renewal after app restart and account recovery before locking
the architecture. No account, paid plan or service has been provisioned.

The proposed private configuration is one project, one non-public snapshot bucket,
and owner-scoped authenticated insert/list/read. Do not grant client update/delete
or expose a service-role credential. Use unique immutable object names, bounded
complete-library files, authenticated byte readback and retained prior versions.
Initial retention keeps copies rather than deleting them automatically; capacity
admission must pause visibly before the configured storage ceiling. Neither an
untrusted filename nor a provider's successful PUT is a verified recovery receipt.
Prove denied anonymous/other-owner access and denied overwrite/delete through the
actual API, not only by reading the policy SQL.

For account access, evaluate GitHub OAuth with PKCE and an explicit native return
path using Andrew's existing account; this avoids depending on a new production
email delivery service. Email OTP remains an alternative if preferred, but production
SMTP must then be configured and verified. Keep tokens in an OS-protected native
store excluded from automatic OS restoration, never WebView localStorage or exports.
Only synthetic snapshots enter the service during this proof.

**Cost boundary, checked 2026-10-10:** a free project can support the technical
proof, but pauses after one inactive week and has 1 GB file storage. The proposed
non-pausing operating tier is Pro, currently from USD 25/month for one project;
included file storage is 100 GB. Keep default spend control and no extra project,
compute upgrade, custom domain or add-on. This is a proposal, not spending approval
or an all-inclusive guarantee: applicable taxes, excluded usage categories and any
email service need explicit treatment before paid activation. Provider database
backups do not back up Storage object bytes; application snapshot retention and the
portable-file recovery path remain separate responsibilities.

Primary documentation checked for this proposal:
- [Sessions](https://supabase.com/docs/guides/auth/sessions) and
  [native redirects](https://supabase.com/docs/guides/auth/native-mobile-deep-linking).
- [Storage authorization](https://supabase.com/docs/guides/storage/security/access-control).
- [Pricing](https://supabase.com/pricing) and
  [cost control](https://supabase.com/docs/guides/platform/cost-control).
- [Production email limits](https://supabase.com/docs/guides/auth/auth-smtp) and
  [database backup scope](https://supabase.com/docs/guides/platform/backups).

Budget/provider direction and a real native account proof remain open. Do not advance
this feature to implementation on the strength of storage documentation alone.

### Usage-priced candidate

The focused [native service cost assessment](../../../.research/analysis/briefs/native-backup-service-costs.md)
adds Firebase native Authentication plus Cloud Storage as another proof candidate.
Its documented Capacitor 8 path and renewable native sessions warrant testing, but
native sign-in does not automatically authenticate a WebView SDK. Keep identity and
object access on the demonstrated native path; inspect token persistence and OS
backup exclusions before claiming secure recovery.

Firebase Storage requires a Blaze billing account even within eligible no-cost
allowances. A US-region bucket can use those allowances; overages are chargeable,
and Storage budget alerts are not a hard cap. No billing account or project has
been created. The pending budget question establishes an operating constraint,
not provider selection or permission to activate billing. The source review passed
after bounded wording/citation corrections; execution evidence remains pending.

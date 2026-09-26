---
description: Compares invitation and contribution services for a small offline-capable shared library.
type: brief
kind: research
provenance: agent-synthesis
updated: 2026-09-26
summary: A minimal Access-protected Worker with D1 is a conditional fit for one invited circle; Supabase provides an alternative with admin invitations, database policies, and production SMTP configuration. Local-copy and publication semantics remain explicit product decisions.
decisions_informed: [invited-library-access, shared-contribution-storage, offline-copy-semantics]
verification_status: complete
---

# Invited libraries with locally owned copies

## Question and boundary

Which invitation, storage, and update approach suits a small invited group whose
members explicitly publish reusable records, while personal editing and saved
collections must continue offline? The comparison covers a Cloudflare service,
Supabase, and static/file distribution. It does not evaluate public discovery,
collaborative editing, multi-group administration, or automatic private-data sync.

This is a documentation-grounded comparison as of 2026-09-26, not a deployed
prototype, pricing analysis, or service-level benchmark. Provider behavior is
source-attested below; application contracts and recommendations carry `extends`
or inference markers.

## Position

{inferred: aggregate} For one operator-managed circle attached to an existing
Cloudflare static application, prefer a **small Worker API with D1 and
email-code Access sign-in**, conditional on validating the real hostname,
Access configuration, and mobile login experience. Path-selective routing and
Access policies permit a bounded shared-service surface, while D1 offers
transactional batches. [shared-library-cf-assets]{4}
[shared-library-cf-paths]{5} [shared-library-cf-d1-api]{7}

`extends`: Keep the local application usable without a shared-library session.
Store only explicit contributions and membership on the service. Use a current
membership record for every shared read/write; authentication alone must not
authorize contribution ownership. This is proposed application behavior, not a
built-in synchronization feature.

| Approach | Source-supported capabilities | Assessment for the stated boundary |
|---|---|---|
| Access + Worker + D1 | Email-code access for permitted addresses; selected API routing; transactional database batches. [shared-library-cf-otp]{1} [shared-library-cf-assets]{4} [shared-library-cf-d1-api]{7} | {inferred: aggregate} A fit for operator-managed invitations, with custom authorization and publication logic still required. |
| Supabase Auth + Postgres policies | Admin invitation links; signup controls; user-aware row policies. [shared-library-sb-config]{12} [shared-library-sb-invite]{13} [shared-library-sb-rls]{15} | {inferred: aggregate} A viable alternative when accounts and invitations should become application-managed capabilities. Email delivery and database policies still need deliberate configuration. |
| Static files / portable exchange | Static Assets serves files and can delegate dynamic paths to Worker code. [shared-library-cf-assets]{4} | `extends`: Treat file exchange as the baseline. Distribution without a trusted write path leaves publication to a separate operator/process; adding authenticated uploads creates a service boundary again. No claim that static publishing is impossible. |

No option is established as cheaper or faster. The preference depends on the
small-circle scope and existing hosting context, not a measured vendor advantage.

## Access and revocation

Access OTP sends a code to policy-permitted email addresses; new organizations
must configure it. [shared-library-cf-otp]{1}
`extends`: An initial invitation can be an operator adding a permitted address
and active membership, then giving that person the library link. An in-app member
management console is optional scope, not a prerequisite for an invited circle.

There is an important implementation qualification: direct Worker invocations can
receive verified identity through `ctx.access`, but the Static Assets router does
not propagate that context to user Worker code.
[shared-library-cf-worker-access]{2}
The separate JWT guide broadly says a Worker behind Access still needs assertion
validation, then supplies an example checking signing keys, issuer, and audience.
[shared-library-cf-jwt]{3}
{inferred: qualifies} Explicit validation fits the Static Assets deployment;
the documentation's broader wording remains in tension with the direct-Worker
guidance, as recorded below.
`extends`: Missing/invalid identity must fail closed on every API hostname.
Do not trust a caller-supplied email header.

Revoking an Access session does not prevent a still-permitted user from signing
in again. Expired AJAX requests need explicit handling; the documented request
header allows a 401 response. [shared-library-cf-sessions]{6}
`extends`: Remove membership and edge permission together; reject new service
requests once the membership change is committed. Treat an expired session as a
shared-library state with a user-initiated sign-in action, without reloading an
active local editor or board session.

Supabase supplies an admin invitation operation and can disable new signup.
[shared-library-sb-invite]{13} [shared-library-sb-config]{12}
Its default SMTP service is unsuitable for production and restricted to project
team recipients; production invitations require a configured mail provider.
[shared-library-sb-smtp]{14}
Publishable keys may ship to clients, while secret keys bypass row policies and
belong on controlled backends. [shared-library-sb-keys]{16}
Revoked sessions' access tokens remain valid until expiry, and membership encoded
in a JWT can be stale. [shared-library-sb-signout]{17}
[shared-library-sb-rls]{15}
`extends`: If selecting Supabase, enforce current membership through database
authorization rather than relying solely on token-carried membership. Keep admin
invitation credentials out of client bundles.

## Publication and receiving changes

D1's ordinary binding queries use the primary; replicated reads require the
Sessions API. Session bookmarks provide ordering guarantees, while asynchronously
replicated data may lag. [shared-library-cf-d1-reads]{8}
`extends`: Start with primary reads for this bounded library. A committed
contribution becomes available to subsequent authorized reads; clients receive it
on refresh. Immediate publication need not imply push delivery to every device.

KV is eventually consistent and is not ideal for atomic operations or multi-read/
write transactions. [shared-library-cf-kv]{9}
{inferred: qualifies} These properties make KV alone a poor authority for
membership revocation and revision conflict checks. This does not exclude it as
a cache or exclude architectures with another coordinating authority.

`extends`: The following is a proposed contract to validate in product design:

- Publish an explicit, validated snapshot under stable contribution identity and
  an immutable revision. Record the authenticated owner server-side.
- Use a client operation identifier and an atomic uniqueness check so a timed-out
  publish can be retried without creating a second contribution. D1 batches supply
  a transaction primitive; the application must implement this contract.
  [shared-library-cf-d1-api]{7}
- Restrict revisions and withdrawal to the owner, with an operator removal path.
  Reject stale expected revisions instead of silently overwriting another edit.
- Retain a withdrawal marker in change results so clients stop offering removed
  entries. Design paginated refresh and interruption recovery before implementation.
- Saving a shared climb into a personal collection retains a local snapshot and
  source revision. Later publisher changes may be offered explicitly; they do not
  silently rewrite saved records or reorder personal collections.
- Start with explicit refresh and foreground refresh where safe. Offline
  publication reports that a connection is required; do not introduce a hidden
  background upload queue in the first milestone.

`extends`: Withdrawal controls future service distribution, not already-retained
copies. Revocation likewise cannot promise remote erasure of data deliberately
saved offline. State this ownership rule before the first contribution; changing
it would change the product contract.

## Operational implications and proof points

Access evaluates more-specific path policies independently of broader ones.
[shared-library-cf-paths]{5}
Worker Version URLs can be public and use the uploaded version's existing
resources rather than a separate environment.
[shared-library-cf-version-urls]{11}
`extends`: Inventory production, alternate, version, and preview routes.
Require protected API behavior on each reachable route and isolate test data.
Do not infer protection merely from the main application's login screen.

D1 Time Travel offers bounded hosted-database recovery: seven days on Free and
thirty on Paid. [shared-library-cf-d1-backup]{10}
`extends`: Include service export/restore procedures, plus independent backups
for private browser libraries. A hosted restore must not cause a client to replace
newer saved local records automatically.

`extends`: Before selecting the production deployment, prove:

1. Approved and unapproved email behavior, valid/invalid audience handling,
   active membership checks, revocation, and owner-versus-other-member writes.
2. Real mobile top-level sign-in, expired-session API responses, and return to the
   previous task without forced reload. Protect cookie-authenticated mutations
   against cross-origin requests; prohibit state changes through GET.
3. Duplicate retries, concurrent revision conflict, interrupted refresh, withdrawal
   propagation, and stale/offline snapshots.
4. Independent local editing, playlist order, board operation, and backup restore
   during auth/service failure.
5. Correct hostname policy, deployment credentials, database bindings, isolated
   test routes, rollback, and recovery rehearsal. Confirm applicable plan limits
   and costs against the operator's actual account.

These are acceptance/prototype obligations, not verified implementation results.

## Contradictions

| Sources / relationship | Positions and consequence |
|---|---|
| [shared-library-cf-worker-access]{2} / [shared-library-cf-jwt]{3} — **tension** | Workers Access says directly authenticated `ctx.access` requires no JWT parsing; Validate JWTs broadly says a Worker behind Access still needs assertion validation. The latter does not name the exception. {inferred: qualifies} Explicit verification is the conservative choice for Static Assets, where `ctx.access` is absent; this does not resolve the general wording conflict. |
| [shared-library-cf-sessions]{6} / [shared-library-sb-signout]{17} — **incommensurable** | Access logout clears its browser authorization cookie before issued tokens stop being accepted; Supabase retains access-token validity until expiry. {inferred: aggregate} Neither logout contract warrants promising instant authorization removal, but their mechanisms should not be conflated. |
| [shared-library-cf-d1-reads]{8} / [shared-library-cf-kv]{9} — **qualifies** | Primary database reads and session ordering differ from KV cache visibility. A generic claim that every storage choice yields immediate cross-client visibility is unsupported. |

## Disconfirming analysis

{inferred: aggregate} The search specifically tested the convenience-based Cloudflare preference.
The Static Assets identity exception, expired AJAX behavior, and non-isolated
Version URLs weaken any claim that edge authentication makes implementation
automatic. [shared-library-cf-worker-access]{2}
[shared-library-cf-sessions]{6} [shared-library-cf-version-urls]{11}

{inferred: aggregate} Supabase's invitation API and row policies are substantive alternatives,
especially if invitations become an in-app capability. Its SMTP requirement and
stale tokens qualify the convenience of managed Auth.
[shared-library-sb-invite]{13} [shared-library-sb-rls]{15}
[shared-library-sb-smtp]{14} [shared-library-sb-signout]{17}
{inferred: aggregate} The evidence supports a conditional Cloudflare preference,
not a universal preference or a claim that Supabase cannot preserve local ownership.

## Gaps and re-engagement triggers

`extends`: Revisit the service choice if public registration, many independently
managed groups, identity-provider requirements, or application-owned account
lifecycle become necessary. Revisit update mechanics if frequent concurrent
editing or push delivery becomes a requirement.

The comparison has not verified the operator's Cloudflare entitlements/custom
hostname, measured mobile authentication, provisioned either platform, compared
costs, or selected retention/export policy. These are explicit deployment/design
gaps. Publication ownership and local-copy update rules require product alignment.

## Revisions

- 2026-09-26 — **Correction:** expose the conflicting breadth of Cloudflare's JWT
  guidance; extend JWT/logout attestations and distinguish comparative inferences.
  Add a local citation for the D1 transaction primitive and make the summary's
  configuration claim concrete. The conditional service recommendation is unchanged.

## Sources

All entries below resolve through per-source attestations; titles and URLs were
read from fetched provider documentation.

1. **shared-library-cf-otp** — Cloudflare Access — One-time PIN. https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/ (fetched 2026-09-26).
2. **shared-library-cf-worker-access** — Cloudflare Workers — Access integration. https://developers.cloudflare.com/workers/configuration/cloudflare-access/ (fetched 2026-09-26).
3. **shared-library-cf-jwt** — Cloudflare Access — Validate JWTs. https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/ (fetched 2026-09-26).
4. **shared-library-cf-assets** — Cloudflare Workers — Static asset binding. https://developers.cloudflare.com/workers/static-assets/binding/ (fetched 2026-09-26).
5. **shared-library-cf-paths** — Cloudflare Access — Application paths. https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/ (fetched 2026-09-26).
6. **shared-library-cf-sessions** — Cloudflare Access — Session management. https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/ (fetched 2026-09-26).
7. **shared-library-cf-d1-api** — Cloudflare D1 — Database binding. https://developers.cloudflare.com/d1/worker-api/d1-database/ (fetched 2026-09-26).
8. **shared-library-cf-d1-reads** — Cloudflare D1 — Read replication. https://developers.cloudflare.com/d1/best-practices/read-replication/ (fetched 2026-09-26).
9. **shared-library-cf-kv** — Cloudflare KV — How KV works. https://developers.cloudflare.com/kv/concepts/how-kv-works/ (fetched 2026-09-26).
10. **shared-library-cf-d1-backup** — Cloudflare D1 — Time Travel and backups. https://developers.cloudflare.com/d1/reference/time-travel/ (fetched 2026-09-26).
11. **shared-library-cf-version-urls** — Cloudflare Workers — Version URLs. https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/ (fetched 2026-09-26).
12. **shared-library-sb-config** — Supabase Auth — General configuration. https://supabase.com/docs/guides/auth/general-configuration (fetched 2026-09-26).
13. **shared-library-sb-invite** — Supabase JavaScript — inviteUserByEmail. https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail (fetched 2026-09-26).
14. **shared-library-sb-smtp** — Supabase Auth — Custom SMTP. https://supabase.com/docs/guides/auth/auth-smtp (fetched 2026-09-26).
15. **shared-library-sb-rls** — Supabase — Row Level Security. https://supabase.com/docs/guides/database/postgres/row-level-security (fetched 2026-09-26).
16. **shared-library-sb-keys** — Supabase — API keys. https://supabase.com/docs/guides/getting-started/api-keys (fetched 2026-09-26).
17. **shared-library-sb-signout** — Supabase Auth — Signing out. https://supabase.com/docs/guides/auth/signout (fetched 2026-09-26).

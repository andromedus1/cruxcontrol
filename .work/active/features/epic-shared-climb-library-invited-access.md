---
id: epic-shared-climb-library-invited-access
kind: feature
stage: implementing
tags: [ui, security, infra]
research_refs:
  - .research/analysis/briefs/invited-offline-library.md
  - .research/analysis/briefs/invited-library-hosting-costs.md
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
- [Starting without an account or domain](../../../.research/analysis/briefs/invited-library-hosting-costs.md)
  — checked pricing, supplied hostname, provider-delivered codes, and Supabase tradeoffs.

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

## Design decisions

- Andrew has **no Cloudflare account or domain** (2026-09-26). Existing repository
  configuration is not evidence of either. Recommend a free-plan proof using a
  supplied `workers.dev` hostname; do not buy a domain or enable paid billing for
  the proof. Measure CPU before claiming that Free can support the real service.
- Keep Cloudflare conditional until hosted checks pass. A new account requires
  Andrew's own setup; local development and CI can proceed independently. No
  deployment, invite email, paid plan, or account creation has happened.
- Open sign-in in a separate browser context from an explicit user action. Returning
  only refreshes shared-session state. Never recreate the local runtime, navigate
  the original app, or reload it to complete authentication. Provide an explicit
  **Check sign-in** action when automatic focus/visibility refresh cannot finish it.
- Use an application-owned member ID for contribution ownership. First enrollment
  binds a pre-created invitation to the verified issuer/subject. Never derive
  ownership from a local receipt, email display string, or mutable display name.
  Operator-managed identity repair preserves this ID; it is not automatic rebinding.
- Session state is in memory. The provider owns its cookie; neither assertions nor
  authentication state go into local backups, IndexedDB, or portable climb files.
  No shared response is added to the app-shell cache.

## Architectural choice

1. **Same-origin Worker API + D1 + Access (proof candidate).** Keep the static PWA
   available independently and protect `/api/shared` and its descendants. Use the
   Worker for explicit identity validation and current membership checks. One origin
   avoids a separate cross-site cookie/CORS architecture. This is the smallest fit
   for the approved operator-managed circle and email-code journey.
2. **Supabase Auth + Postgres policies.** A viable alternative if the hosted proof
   fails or account management becomes a product capability. It introduces separate
   email delivery setup and a frontend-hosting choice; Free's inactivity rule matters
   for a quiet group. Preserve the local/shared boundary if switching.
3. **Protect the entire application with Access.** Fewer route distinctions, but
   couples initial app access to shared sign-in. Reject for the requirement that
   local use remain available independently of a shared session.

Implement one concrete candidate, with a narrow injected client for tests. Do not
build a multi-provider framework. The hardest uncertainty is the **real Android
browser/installed-PWA sign-in return**, including a controlling service worker.
Design and prove that seam first; local mocks cannot settle it.

## Implementation Units

### Unit 1: Request identity, membership, and enrollment

**Files:** `web/service/access.ts`, `web/service/membership.ts`,
`web/service/index.ts`, `web/service/migrations/0001_members.sql`,
`web/shared-library-contract.ts`, `web/service/tsconfig.json`.

Add compatible stable Worker/D1 test tooling and generated binding types in this
unit. Current Wrangler requires Node >=22 while this repository pins 20; update
`.nvmrc`, the root package engine and the lockfile together, keeping CI on that pin.
Choose Wrangler's matched stable Miniflare runtime, not an unqualified latest alpha.

```typescript
// web/shared-library-contract.ts — shared by the Worker and browser; no React imports.
export interface SharedMember { readonly id: string; readonly displayName: string }
export type SessionReply =
  | { readonly status: 'authenticated'; readonly member: SharedMember }
  | { readonly status: 'invited'; readonly member: SharedMember };
export type SharedErrorCode = 'unauthenticated' | 'forbidden' | 'unavailable';
export interface SharedErrorReply { readonly error: SharedErrorCode }

// web/service/access.ts
export interface VerifiedIdentity {
  readonly issuer: string;
  readonly subject: string;
  readonly email: string;
}
export interface AccessConfig { readonly issuer: string; readonly audience: string }
export function verifyIdentity(request: Request, config: AccessConfig): Promise<VerifiedIdentity>;

// web/service/membership.ts — D1Database comes from generated Wrangler bindings.
export function readMembership(db: D1Database, identity: VerifiedIdentity): Promise<SessionReply | null>;
export function enrollMember(db: D1Database, identity: VerifiedIdentity): Promise<SharedMember | null>;
```

Use `jose` verification with a cached remote key set from the configured issuer,
expected audience, RS256, application-token type, nonempty human subject/email,
required expiry/issue/not-before claims and their time checks. Read only the Access
assertion header; never decode without verifying, trust a caller email header, or
take a key URL from the token. The Static Assets router does not provide `ctx.access`.
Key-fetch/configuration failures are unavailable, not authenticated. Required claim
shape is grounded in the [application-token source](../../../.research/attestation/shared-library-cf-application-token.md).

The `members` table stores opaque `id` (primary key), configured `issuer`,
`invited_email`, nullable `subject`, bounded `display_name`, and `active` (0/1).
Unique `(issuer, invited_email)` and `(issuer, subject)` prevent duplicate binding.
Normalize invitation email consistently by trimming/lowercasing; do not collapse
plus aliases or provider-specific dots. Use prepared statements and primary reads.
Do not cache membership decisions in an isolate or put membership in a client token.

`readMembership` accepts an active exact issuer/subject/email match; an active
email-matching row with no subject returns `invited`. A different bound subject is
forbidden. `POST /api/shared/enroll` conditionally binds only an active unbound
invitation using verified token claims, then reads the resulting exact identity.
Retries by the same identity are idempotent; racing identities cannot replace the
winner. No invitation is created by a public endpoint, and GET never enrolls.
Future publication handlers require `authenticated`, not merely `invited`.

Operator revocation sets `active=0` and removes the Access allow policy. Do not
delete the member row or contributions. Repairing a changed provider subject is
an explicit operator update to a verified new subject while retaining the member
ID, never resetting a previously bound row to an open invitation. The provider
documents subject changes after organization removal/re-addition.

Routes: `GET /api/shared/session` returns the session union; `POST /api/shared/enroll`
returns the authenticated variant; `GET /api/shared/sign-in` returns a minimal HTML
completion page after identity and active-invitation/member checks. That page has
only return instructions, no app boot, local database, board controller, or shared
update lock. Unknown API paths return 404, unsupported methods 405; neither falls
through to the SPA. Missing/invalid identity is 401, no current invitation/member
403, and configuration/database/key-service failure 503. Error bodies are bounded
and sanitized; responses use `Cache-Control: no-store` and correct content types.

Require the configured canonical origin for all service requests. Mutations also
require matching `Origin`, JSON content type and a custom application request header;
do not offer permissive CORS. No arbitrary return URL is accepted. These checks must
be reusable by publication handlers without duplicating identity verification.

**Acceptance criteria:** forged/expired/wrong-issuer/wrong-audience/global/service
tokens fail; enrollment never creates an invite; retries preserve member ID; committed
revocation affects the next request even with a still-valid JWT; wrong-host and
cross-origin requests cannot bind membership; API failures never return app HTML.

### Unit 2: Actual provider proof (highest uncertainty)

**Files:** `web/service/proof/index.ts`, `web/wrangler.proof.jsonc`, and this item's
`## Hosted evidence` section. Use a tiny disposable proof shell containing no board
artwork or personal data. It calls Unit 1's service handlers; it is not a second auth
implementation. Isolate its Worker, D1 database, Access audience and membership from
any later deployment. Delete the proof fixture when its measurements are recorded
and the real client replaces it.

```text
# Proof shell and final client use this same request contract.
GET  /api/shared/session   // no-store JSON; X-Requested-With: XMLHttpRequest
POST /api/shared/enroll    // no-store JSON; explicit sign-in intent, same-origin guard
GET  /api/shared/sign-in   // top-level navigation; provider challenge then completion HTML
```

On a real free account, protect exact `/api/shared` plus descendants with allowed
test addresses and OTP; confirm public shell reachability, allowed and denied login,
expired AJAX returning 401, enrollment, revocation with an existing token, logout,
and repeat sign-in. Inventory `workers.dev`, preview/version URLs, and every enabled
route: disable alternatives or prove denial and resource isolation. A hostname check
and JWT verification remain mandatory even if the edge policy is accidentally absent.
Disable unneeded preview/version endpoints and shared-response caching.

Measure authenticated request CPU and row usage, including key-cache cold/warm cases.
Document actual plan/entitlement and any quota failures; Free is an experiment, not
a cost promise. A paid upgrade requires a concrete measured justification.

**Acceptance criteria:** record actual Android Chrome and installed proof-PWA
behavior, including provider email arrival, return to the original context with
cookie visibility, expiry, blocked recipient, and logout. Test with a controlling
service worker, not only a fresh tab. Failure reopens the provider choice before
publication work. Account setup remains outstanding; do not mark this story done
from mocked tests or current pricing documentation.

### Unit 3: Shared entry without disturbing local work

**Files:** `web/src/shared-library/session-client.ts`,
`web/src/shared-library/SharedLibraryEntry.tsx`, `web/src/app/CruxControlWorkspace.tsx`,
`web/src/app/CruxControlWorkspace.css`, `web/src/App.tsx`, `web/vite.config.ts`.

```typescript
export type SharedSessionState =
  | { readonly status: 'unchecked' | 'checking' | 'signed-out' | 'expired' | 'forbidden' | 'unavailable' }
  | SessionReply;
export interface SharedSessionClient {
  check(signal?: AbortSignal): Promise<SessionReply>;
  enroll(signal?: AbortSignal): Promise<SessionReply>;
}
export function createSharedSessionClient(fetcher?: typeof fetch): SharedSessionClient;
export interface SharedLibraryEntryProps { readonly client: SharedSessionClient }
// CruxControlWorkspaceProps adds optional sharedSessionClient; undefined hides this entry.
// WorkspaceDestination adds 'shared'; all local branches remain explicit.
```

Requests use same-origin credentials, `cache: 'no-store'`, an XHR header, bounded
timeout/abort, and strict parsing against the common contract. A typed request error
distinguishes 401, 403 and unavailable; redirects, HTML, malformed JSON and offline
errors never establish a session. Use one in-flight session refresh and ignore stale
completions after unmount/newer requests. Enrollment occurs only from an explicit
sign-in/check action; a plain background session check remains read-only.

Follow the approved entry styling. Before the browsing feature exists, success says
the member is signed in and the shared collection is not available yet; do not ship
fictional climbs or pretend a server list is empty. A build-time opt-in supplies the
client only for configured shared-service builds; the normal static preview remains
usable without an API. This rollout flag is not an authorization boundary.

Add Shared alongside My Climbs, Drafts, Trash, and Playlists; handle the fifth
destination at narrow widths. Replace assumptions that every non-list destination
is a local climb collection. Entry must not unmount a playlist with dirty metadata,
playback, a modal or pending operations: use the existing safety report to block the
new navigation with a clear inline explanation. The editor retains its existing
navigation boundary. Auth completion cannot change editor/selection/playlist-return
state, clear local errors or use the workspace's selection-resetting retry helper.

Open the fixed sign-in URL synchronously from the gesture with `noopener`; do not
depend on `window.opener`, cross-window messages, popup-close detection, or automatic
closing. Track pending sign-in only in memory and refresh on return/focus, with an
explicit Check sign-in fallback. Reauthentication never retries a future publication
automatically. Provider logout opens its fixed route separately, clears shared UI
state, and rechecks on return; do not promise immediate token revocation.

Exclude `/api`, its descendants and `/cdn-cgi` Access routes from Workbox navigation
fallback. They are network-only and absent from precache. Test upgrades from an
already-controlled shell: expose the new sign-in flow only after normal safe update
admission has installed its exclusions. Completion HTML must not instantiate App.
Keep auth controls within the applying/reload-required inert boundary. The existing
hidden-tab effect and wake-lock policies still apply; don't promise uninterrupted
animation while the browser is showing a login page.

**Acceptance criteria:** signed-out, expired, forbidden and unavailable states leave
all local capabilities usable; cancellation/retry preserves authored data and board
controller identity; return while editing does not navigate or remount; dirty or
playing playlists cannot be discarded by Shared; controlled-PWA auth routes reach
the network and never boot a second local runtime; update admission is unchanged.

### Unit 4: Deployment, operations, and final integration

**Files:** `web/wrangler.jsonc`, `web/package.json`, `package.json`, `.nvmrc`,
`.github/workflows/ci.yml`, `docs/DEPLOY.md`, `docs/ARCHITECTURE.md`.

Add the Worker entry, generated binding types and D1 migration command with explicit
environment/database selection. Run the Worker before Static Assets for API paths;
ordinary app assets retain static routing. Share the exact application origin with
auth checks. Use the pinned stable tooling and compatible Node baseline established
by Unit 1; run the existing suite under that same baseline before deployment.

Extend the current opt-in CI deployment path with least-privilege D1 access and
additive migration ordering. Keep deployment disabled until provider proof, actual
resource configuration and audience/artwork requirements are met. Preview resources
cannot bind production data. Document invite, revoke, explicit identity repair,
database export/restore, code rollback and schema compatibility. Backups and member
addresses stay outside Git; a hosted backup never substitutes for a phone backup.

Resolve the existing [artwork-distribution item](../../backlog/idea-kilter-artwork-distribution-rights.md)
before distributing the real app to a new hosted audience. The stripped auth proof
does not establish permission to serve the current private/local reference asset.

**Acceptance criteria:** CI runs service tests plus the existing web/browser suites;
re-run the hosted acceptance matrix with the real app after client integration;
restore a synthetic hosted backup and verify membership before trusting recovery;
confirm rollback does not remove personal data. Any operated phone update/move first
requires a fresh validated whole-library backup and origin/profile verification,
then post-update comparison of records and playlist ordering. No clear-site-data
shortcut. Production selection requires recorded hosted evidence and feature review.

## Implementation Order and child stories

1. [Service boundary](../stories/epic-shared-climb-library-invited-access-boundary.md)
   — Unit 1 and the local service tooling needed to test it.
2. [Provider proof](../stories/epic-shared-climb-library-invited-access-provider-proof.md)
   — Unit 2, after the boundary; start actual account testing as soon as available.
3. [Client entry](../stories/epic-shared-climb-library-invited-access-client.md)
   — Unit 3, after the boundary; safe to build disabled while provider proof is pending.
4. [Delivery and recovery](../stories/epic-shared-climb-library-invited-access-delivery.md)
   — Unit 4, after both provider proof and client entry.

Separate stories are useful because service authorization, physical mobile/provider
proof, browser integration and deployment have different evidence and span sessions.
No child story gets an independent review loop; the complete feature receives its
required review. Readiness is not evidence that account setup or hosting has happened.

## Testing

- `web/service/access.test.ts`: locally signed RS256 fixtures and key-fetch failures;
  valid human token plus forged, expired, early, wrong issuer/audience/type, missing
  required claims and service-token cases. Never bypass production verification.
- `web/service/index.test.ts`: real local D1 binding with the migration and fictional
  invitations; concurrent enrollment/retry, revocation after a prior valid request,
  identity mismatch, origin/method/host checks, sanitized errors and unknown routes.
- `web/src/shared-library/session-client.test.ts`: injected fetch for 401/403/503,
  redirects, HTML, malformed successful responses, abort/offline and enrollment guards.
- `web/src/app/CruxControlWorkspace.test.tsx`: approved entry states using existing
  runtime/controller fixtures; login return during an edit, playlist safety blocking,
  independent local navigation and unchanged update admission/controller instance.
- `web/e2e/shared-library-access.spec.ts`: controlled service worker, separate login
  context, explicit return check, local draft preservation and safe shell upgrade.
  Extend `web/e2e/support/pwa-server.ts` with explicit auth/API fixtures before its
  SPA fallback, so returning index.html cannot masquerade as a successful endpoint.
- Provider and final phone checks belong in Hosted evidence, with synthetic data
  and redacted results. Browser mocks do not prove email delivery or mobile cookies.

## Risks

- **Least certain:** installed Android app and external auth context may not share
  the required cookie/return behavior. Prove it before enabling distribution; if it
  fails, revisit the concrete provider or return mechanism with the existing research.
- **Storage origin:** changing to a hosted URL does not move a browser's library.
  Preserve the existing installation and use the established backup/restore process.
- **Route mistakes:** Access may protect one URL but leave another reachable; server
  validation, exact host checks, disabled alternatives and hostile route tests compose
  the boundary. Never infer protection from a working login page alone.
- **Partial failure:** fail closed for shared operations when keys or D1 are unavailable;
  retain local operation. Enrollment retries are idempotent, and no write is hidden in GET.
- **Recovery:** removed/recreated provider identities can change subject. Preserve the
  opaque member ID via explicit operator repair; do not orphan contribution ownership
  or let a stale token reclaim an automatically reopened invitation.
- **Cost/maintenance:** low traffic does not prove a 10 ms CPU budget or effortless
  email delivery. Measure before selecting a paid plan; keep the comparison bounded.

## Hosted evidence

Pending. No account, domain, D1 database, Access policy or production credentials
exist for this implementation. Local/CI work is actionable; provider proof and final
deployment cannot be completed from this design alone. Record sanitized observations
here rather than committing personal addresses, identifiers, tokens or backups.

## Design validation

Read the local runtime, workspace navigation/safety, PWA configuration and CI path;
a focused read-only client mapping confirmed the integration risks above. Approved
mockups cover the entry; status and retry variants reuse existing components.
The hosting-cost extension passed substantive independent checks; source omissions
and correction-log findings were resolved as recorded in the brief. Checked each
proposed story with `work-view --blocking` before adding dependency edges. This stage
transition records a completed design, not implementation, provider approval or rollout.

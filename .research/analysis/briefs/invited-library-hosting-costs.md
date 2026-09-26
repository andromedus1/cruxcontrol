---
description: Compare setup and cost constraints for a small invited library with no existing hosting account or domain.
type: brief
kind: research
provenance: agent-synthesis
updated: 2026-09-26
summary: Cloudflare remains a conditional fit for a small private hobby library starting from scratch; supplied hostnames and Access email delivery reduce setup, while Supabase's separate email delivery setup and free-project pausing change its operating tradeoffs.
decisions_informed: [invited-library-hosting, invitation-email-delivery, initial-operating-cost]
verification_status: complete
---

# Hosting a small invited library from scratch

## Question and boundary

For a personal web application serving one invited circle, does a minimal Cloudflare
service remain a reasonable starting point when the operator has neither an account
nor a domain? Compare the already-considered Cloudflare and Supabase candidates on
setup, email delivery, and published plan constraints. This is a bounded cost/setup
extension, not a market-wide ranking, implementation benchmark, or account entitlement
check. Prices and policies were checked on 2026-09-26.

## Position

{inferred: aggregate} Prefer testing **Workers + D1 + Access** for a small invited
hobby application whose account lifecycle can remain operator-managed. A supplied
hostname removes an initial domain purchase requirement, and Access supplies its
own email-code delivery. This preference does not depend on an existing account.
[shared-library-cf-workers-dev]{1} [shared-library-cf-otp]{2}

`extends`: Start on the free plans for the proof, measure the actual request CPU and
database usage, and confirm the mobile sign-in experience before production selection.
Do not promise zero operating cost or purchase a paid plan based on this comparison.

## Concrete tradeoffs

| Concern | Cloudflare candidate | Supabase candidate |
|---|---|---|
| Domain and entry | Workers supplies a `workers.dev` URL without first onboarding a custom domain. Its documented intended use is personal/hobby projects; a route/custom domain is recommended for production. [shared-library-cf-workers-dev]{1} | This comparison does not establish the application's frontend host or email sender domain. A Supabase project is not itself a complete frontend-hosting decision. `extends`: choose those separately if adopting it. |
| Email-code delivery | Access emails codes to policy-permitted addresses using its own sender. [shared-library-cf-otp]{2} | Default SMTP delivery is restricted to project-team addresses; application email authentication needs separately configured delivery, such as custom SMTP or the Send Email Auth Hook. [shared-library-sb-smtp]{3} |
| Free allowance | Workspace-security pricing lists 50 users on Free. Workers Free includes 100,000 requests/day and 10 ms CPU/request. Direct static asset requests are free; Workers Caching introduces a per-request charging qualification. [shared-library-cf-access-pricing]{4} [shared-library-cf-service-pricing]{5} | Free projects can pause for insufficient database activity over seven days; resumption is an operator action. Paid projects avoid inactivity pausing. [shared-library-sb-pausing]{6} |
| Database/runtime billing | D1 Free includes 5 million scanned rows/day, 100,000 written rows/day, and 5 GB total storage. Workers Paid starts at USD 5/account/month, with possible usage charges. [shared-library-cf-d1-pricing]{7} [shared-library-cf-service-pricing]{5} | Pro is USD 25/month and includes USD 10 compute credit for one Micro instance; extra projects/usage can increase the bill. Email delivery is a separate setup obligation. [shared-library-sb-pricing]{8} [shared-library-sb-smtp]{3} |

{inferred: qualifies} A quiet friends-and-family service can be a poor match for
Supabase Free's inactivity rule even if its traffic is well below usage allowances.
Paid Supabase removes that specific issue. This is a suitability judgment, not
evidence that Supabase is unreliable. [shared-library-sb-pausing]{6}

`extends`: Cloudflare still requires application-owned membership checks,
contribution ownership, input validation, retries, and recovery. A managed login
page does not supply those contracts. A richer application account lifecycle may
justify revisiting Supabase despite its additional setup or paid baseline.

## Disconfirming analysis

The low-cost preference was tested against constraints that can reverse it:

- Workers Free's 10 ms CPU limit can matter even with few users. The authenticated
  request path has not been measured; a small group is not proof that Free suffices.
  [shared-library-cf-service-pricing]{5}
- Enabling Workers Caching changes the static-assets pricing assumption: cache-served
  requests, including static assets, incur request charges. The free-asset allowance
  is not a blanket statement about every serving configuration. [shared-library-cf-service-pricing]{5}
- Supabase supports an email hook as an alternative to SMTP. That broadens the
  delivery options, although either path needs separate configuration beyond the
  restricted default service. [shared-library-sb-smtp]{3}
- The supplied hostname is explicitly positioned for non-business-critical hobby
  use. It is not evidence of a production SLA or a forever-stable branded origin.
  [shared-library-cf-workers-dev]{1}
- Supabase's paid plan avoids inactivity pausing, and its listed Pro features
  include daily hosted-database backups. Those facts strengthen its case where
  the operator values that package. [shared-library-sb-pausing]{6}
  [shared-library-sb-pricing]{8}
- `extends`: None of these plan tables proves real mobile cookie/return behavior,
  email deliverability to the intended recipients, successful recovery, or the cost
  of maintaining application code. Those remain proof obligations.

## Contradictions

| Sources / relationship | Positions and consequence |
|---|---|
| [shared-library-cf-workers-dev]{1} — **qualifies** | A custom domain is unnecessary to start, but the same page recommends routes/custom domains for production and positions workers.dev for hobby use. Keep both statements; do not generalize the supplied URL into an unqualified production recommendation. |
| [shared-library-cf-service-pricing]{5} / [shared-library-sb-pricing]{8} — **incommensurable** | The USD 5 Workers minimum and USD 25 Supabase Pro price cover different services and allocations. They are entry prices, not equivalent complete-system quotes or bill ceilings. |

## Limits and re-engagement triggers

`extends`: Reconsider if public registration, multiple independently managed groups,
an in-app account console, a business-critical availability target, or a failed
mobile access proof changes the requirements. Confirm account terms and current
prices during setup. A new hostname creates a new browser-storage origin; moving
personal data requires deliberate export/restore independent of the hosted database.

## Revisions and verification

- 2026-09-26 — **Correction:** qualify the static-assets allowance with the
  Workers Caching request charge, and include Supabase's Send Email Auth Hook as
  an alternative to SMTP. Extend both source attestations before correcting the
  synthesis. The conditional recommendation is unchanged.
- Standard verification: independent adversarial review found those two omissions;
  its focused second pass confirmed the corrected content and identified the
  missing correction logs. The lead added this entry and the original comparison's
  email-delivery correction entry, and surfaced that bookkeeping finding to the
  user. Primary-page spot checks confirmed both corrected qualifications. Citation
  lint resolves 22 citations with no broken or thin substrates; four named-feature
  flags are adjacent-citation false positives. No account or mobile proof is claimed.

## Sources

1. **shared-library-cf-workers-dev** — Cloudflare Workers — workers.dev. https://developers.cloudflare.com/workers/configuration/routing/workers-dev/ (fetched 2026-09-26).
2. **shared-library-cf-otp** — Cloudflare Access — One-time PIN login. https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/ (rechecked 2026-09-26).
3. **shared-library-sb-smtp** — Supabase — Send emails with custom SMTP. https://supabase.com/docs/guides/auth/auth-smtp (rechecked 2026-09-26).
4. **shared-library-cf-access-pricing** — Cloudflare — Pricing, workspace-security plan section. https://www.cloudflare.com/plans/ (fetched 2026-09-26).
5. **shared-library-cf-service-pricing** — Cloudflare Workers — Pricing. https://developers.cloudflare.com/workers/platform/pricing/ (fetched 2026-09-26).
6. **shared-library-sb-pausing** — Supabase — Project Pausing. https://supabase.com/docs/guides/platform/free-project-pausing (fetched 2026-09-26).
7. **shared-library-cf-d1-pricing** — Cloudflare D1 — Pricing. https://developers.cloudflare.com/d1/platform/pricing/ (fetched 2026-09-26).
8. **shared-library-sb-pricing** — Supabase — Pricing & Fees. https://supabase.com/pricing (fetched 2026-09-26).

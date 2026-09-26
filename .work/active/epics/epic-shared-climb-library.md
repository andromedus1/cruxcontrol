---
id: epic-shared-climb-library
kind: epic
stage: implementing
tags: [ui, data, security]
research_refs:
  - .research/analysis/briefs/invited-offline-library.md
  - .research/analysis/briefs/invited-library-hosting-costs.md
parent: null
depends_on: [epic-route-creation, epic-playlists, epic-build-effects-hardening-library-backup]
release_binding: null
gate_origin: null
created: 2026-09-12
updated: 2026-09-26
---

# Shared contributed climb library

## Brief

Let Andrew's invited partner and friends explicitly contribute climbs to a shared
library, receive other members' contributions independently of app releases, and
use those climbs in their own wall sessions and playlists. Successful submissions
publish immediately to the invited group. Android board control is sufficient for
the first shared-library milestone; personal authoring and playlist data remain
locally owned and exportable.

## Strategic decisions

- **First audience:** invited partner and friends — confirmed 2026-09-26.
- **Initial board control:** Android is sufficient. Direct iPhone board control
  remains deferred and does not block this shared-library milestone — confirmed
  2026-09-26.
- **Publication:** invited members' explicit submissions publish immediately within
  the group, without an approval queue — confirmed 2026-09-26.
- **Ownership:** explicit climb submission, library updates independent of app
  releases, and personal drafts/playlists under each person's control, as already
  approved in the saved roadmap.

## Design decisions

- **Saved-copy behavior:** keep personally saved copies unchanged when a shared
  climb is revised or withdrawn; offer updates for explicit acceptance. Publisher
  changes must not silently alter the retained climb or its playlist membership
  and ordering — confirmed by Andrew on 2026-09-26.
- **Mockup journey and visual direction:** shared-library entry → email-code sign-in
  when needed → browse → inspect → save to a personal playlist; publishing starts
  from an authored climb → review the shared snapshot → publish to the group.
  Reuse the existing visual style and allow easy returns to browsing — confirmed
  by Andrew on 2026-09-26. Andrew subsequently walked through the rendered previews
  and selected **Use this design direction** on 2026-09-26. Both journeys are signed
  off; this does not select an authentication provider.
- **Small-circle operations:** start with operator-managed invitations and removal
  of access. There is no member-administration screen or public signup in this
  milestone. This is the minimal implementation choice already proposed in the
  directional pass, not an additional user-confirmed requirement.
- **Contribution lifecycle:** authors explicitly publish revisions or withdraw their
  own contributions; an operator can remove a contribution from distribution.
  Editing a personal climb never republishes it automatically. These working rules
  apply the research recommendation and the ownership copy in the approved preview;
  they do not authorize members to edit each other's contributions.
- **Network behavior:** publishing requires a connection and an explicit action.
  A successful commit is available to the next authorized refresh; no push delivery
  or background publication queue is required. Failed/expired shared access leaves
  local editing, saved climbs, playlists, and board control available.
- **Service selection:** validate the conditional Access + Worker + D1 candidate
  in the access feature before committing to production hosting. Keep Supabase as
  the researched fallback if actual account, hostname, or mobile-session constraints
  invalidate that candidate. No infrastructure has been provisioned.
- **Starting from scratch:** Andrew has no Cloudflare account or domain, confirmed
  2026-09-26. The checked [cost/setup extension](../../../.research/analysis/briefs/invited-library-hosting-costs.md)
  still favors testing the candidate on a supplied hostname with provider-delivered
  codes. This is an agent recommendation conditional on the access proof, not a
  purchase, user commitment to a provider, or promise of free operation.

## Scope boundary

The first audience is one invited circle, not public registration. The milestone
must support access, explicit contribution, receiving updates, board-compatible
browsing/lighting, and use in personal playlists. Local climbs, ordered list
memberships, saved effects, Trash, and backup/recovery guarantees must survive the
addition. A shared-library failure must not disable local editing or board sessions.
Publication means availability to the group; it does not require real-time delivery
to every phone. Refresh cadence and offline behavior need an explicit design.

Manufacturer community-catalog acquisition, native iOS control, logbook, ML, public
discovery, and automatic synchronization of private drafts/playlists are outside this
epic. Existing portable file sharing remains useful and is not replaced by this scope.

Andrew approved this as the next major addition in the
[saved milestone priorities](../../backlog/roadmap-next-milestones.md). Aim for explicit climb
submission, library updates independent of app releases, and personal drafts and
playlists that remain under each person's control. The main journeys are approved;
the four child features below own implementation design. Production service selection
still depends on the access proof.

## Research gate and downstream decision

Determine the smallest maintainable invitation/access, contribution-storage, and
update approach that supports immediate group publication while keeping local work
usable offline. Compare a minimal service alongside the existing Cloudflare static
deployment, a managed authentication/data service, and a static/file-based baseline.
Check member identification and revocation, duplicate submissions/retries, published
revisions/removal, deployment requirements, and preservation of local copies and
playlist references. Findings can change whether a service is needed, which access
boundary it uses, and how published versions reach each client. Do not select a
stack or write production service code before this gate is resolved.

The existing Cloudflare deployment brief supplies project context but does not
establish an invitation/authentication or collaboration-data design. The output is
one focused synthesis brief with standard verification and agent judgment inside
this bounded question; Andrew confirmed this setup on 2026-09-26.

The [comparison brief](../../../.research/analysis/briefs/invited-offline-library.md)
now supplies that grounding. Its conditional recommendation is an Access-protected
Worker API with D1 alongside the static application, with Supabase retained as a
viable option if application-managed accounts/invitations become important. The
comparison does not establish actual account entitlements, a production hostname,
mobile sign-in behavior, or deployment cost. No service has been provisioned.

For this repository, `web/wrangler.jsonc` currently declares Static Assets without
an application Worker. The researched Static Assets identity limitation makes
explicit JWT validation and real route/session checks part of the eventual service
proof. Keep author/member authorization and retry/revision guarantees inside the
application contract; edge sign-in does not supply them automatically.

Andrew confirmed retaining personal snapshots and offering updates explicitly.
The design decisions above adopt the smallest ownership and online-publication
rules consistent with that choice and the approved preview. None of these mechanisms
is implemented yet.

## Design handoff

The directional question pass and rendered journey sign-off are complete. Start
feature design with `epic-shared-climb-library-invited-access`, then follow the
declared dependency chain. Inherit the decisions above without repeating the
audience, Android, publication, saved-copy, or visual-direction questions.
The existing deployment path and artwork-distribution item are audience-access
companions: invited access is not evidence of artwork redistribution permission.
Any new hosting origin must leave the phone's existing library intact and follow
the standing backup/restore process before agent-operated phone maintenance.

## Mockups

Inherits `.mockups/design-system/` tokens, components, and motion. Polished,
mobile-first previews with a responsive desktop layout:

- [Both journeys](../../../.mockups/flows/shared-library/index.html) — the review
  navigator; primary paths and return links are shown together.
- **Find and save:** `shared-library/01-entry.html` → `02-sign-in.html` →
  `03-browse.html` → `04-climb.html` → `05-save.html`, under `.mockups/flows/`.
  Email/code entry is illustrative; the final hosted authentication surface depends
  on service selection. Search, angle filtering, existing/new playlist choice, and
  a save confirmation with ordered membership are interactive.
- [Publish a climb](../../../.mockups/flows/share-climb/index.html):
  `01-your-climb.html` → `02-review.html` → `03-published.html`.
  Review shows the contribution snapshot, audience, attribution, and retained-copy
  rule. Confirmation returns to the shared list with the sample contribution visible.

**Signed off: 2026-09-26.** Andrew approved the rendered browsing/saving and publishing
journeys. [PR #22](https://github.com/andromedus1/cruxcontrol/pull/22) is merged with
passing CI. The review navigation strip is outside the
product UI. Sample names/climbs are fictional, geometry comes from the committed
Fullride definition, and hold shapes reuse the authored schematic vocabulary.
The previews perform no email, authentication, library-storage, or Bluetooth work.

These are focused journey previews. Final integration must retain the existing
Drafts, Trash, and Playlists destinations alongside shared browsing. Lifecycle actions
compose the selected surfaces: an update notice in climb detail, a compact changes
summary with an explicit choice, the existing publication preview for revisions,
and the existing destructive-confirmation pattern for withdrawal. Failure states
reuse the application's inline error/retry treatment. Operator-managed membership
has no new application screen. These variants are not separately rendered in the
preview. Under AGENTS.md's existing-component exception they need no separate flow;
if feature design exposes a novel comparison or recovery surface, mock that surface
before production UI work. Approval does not cover an unseen redesign.

Validation: all 10 HTML pages rendered at 390px and 1280px with no page exceptions,
broken local links, or horizontal document overflow. Walked email/code sign-in,
setter search and empty results, appending a retained copy to an existing playlist,
creating a new playlist, and explicit publication/return. Checked dark and light
renders and verified shared CSS tokens resolve. Browser storage remained empty.

## Simplification opportunity

Reuse the existing snapshot validation, board compatibility, renderer/controller,
local repositories, and backup boundaries. Shared distribution should eliminate
repeated manual file exchanges within the group without introducing a second editor,
board-control stack, or automatic private-library sync. No independent refactor or
test-only feature is created at scope time.

## Existing implementation to build on

- `web/src/playlists/portable-types.ts` and `portable-codec.ts` own bounded,
  versioned climb snapshots, including board identity and effect recipes.
- `web/src/playlists/portable-import.ts` validates active-board compatibility before
  writing fresh local copies. It does not supply ongoing shared-library identity or
  update tracking.
- `web/src/playlists/types.ts` and `resolve.ts` preserve ordered local/provider
  references. Design must keep personal lists and authored records safe when shared
  contributions change or disappear.
- The app remains static-first with local IndexedDB ownership. Reuse existing
  renderer, controller, import validation, and local backup boundaries; avoid
  creating a second authoring or board-control stack.

This is distinct from importing manufacturers' existing community libraries.
Andrew also reaffirmed interest in supporting Kilter, MoonBoard, Tension, and
other boards, with regularly updated community catalogs, as a farther-out idea.
That direction is already captured in [Multi-Board Providers](../../backlog/epic-multi-board-providers.md).

## Scope validation

Large scope: adds a collaboration boundary and intended shared-data capability.
Foundation intent is rolled forward without choosing a service architecture.
Dependencies are completed archived capabilities; `work-view --blocking
epic-shared-climb-library --paths` found no cycle. The approved flows now ground four
child features. Invited access now has its detailed design and four child stories
at `implementing`; publication, browse/save and updates remain `drafting`. The epic
is `implementing` because decomposition is complete, not because the shared service
is delivered. Access implementation and hosted evidence are still pending.
The source-grounded comparison passed standard
verification, recorded below; the research tag is cleared without advancing stage.

## Research engagement registration (2026-09-26)

The user approved the proposed question, agent-selected comparisons within its scope,
and standard verification. This is one integrated architecture comparison, authored
inline; the independent adversarial read remains required.

```yaml
intent: terminate-in-position
output_kind: synthesis-brief
consumer: calibrated-work
verification_rigor: standard
temporal_contract: re-engage-on-trigger
primitives_extends: []
primitives_opts_out: []
decision_relevance: Choose invitation/access, shared contribution storage, and update semantics; evidence may select a minimal hosted service, a managed auth/data platform, or a static baseline while preserving offline local ownership.
scope_authority: in-engagement-judgment
analytical_artifact_type: per-campaign-brief
```

Prior-art check: existing deployment research covers static hosting and CI, not
invited collaboration. It is context only, not a citation source or refresh target.
This is a new gap-fill engagement.

Framing candidates: (1) integrated comparison of three deployable approaches;
(2) separate access, storage, and sync specialist facets; (3) prototype-first build.
Choose (1): the decisions are coupled and the initial question is narrow enough for
one source-grounded brief. (2) risks disconnected auth/storage recommendations;
(3) would commit infrastructure before its tradeoffs are understood. No specialist
fan-out or cross-synthesis; standard verification still applies. Self-flag: existing
Cloudflare deployment can bias selection, so explicitly test a managed platform and
a static baseline, plus disconfirming Access/session evidence.

## Directional alignment

Andrew confirmed saved-copy behavior and signed off both rendered journeys. Keep
the mobile-first layout, existing tokens/components/motion, responsive desktop
composition, and ordinary in-product back links. The review step strip is not
application navigation. No further strategic question is needed for decomposition:
settled product direction is inherited, and actual hosting is an explicit proof
obligation rather than an assumed deployment choice.

## Decomposition

Four capability slices keep authorization, explicit distribution, local acquisition,
and later changes reviewable without splitting the work into database/API/UI layers.
The service comparison considered Cloudflare, Supabase, and file exchange; use the
conditional Cloudflare candidate for the first proof, retain Supabase as fallback,
and keep portable files available independently. A database-only foundation or a
separate deployment feature would hide the access capability's real acceptance
boundary, so service provisioning, session behavior, and operational proof belong
to invited access.

### Child features

- [Invited access](../features/epic-shared-climb-library-invited-access.md) — enter
  the group with email sign-in, enforce current membership, and preserve local
  sessions through auth failure — depends on: `[]`.
- [Publish a contribution](../features/epic-shared-climb-library-publish.md) — review
  and explicitly publish an attributed, retry-safe snapshot — depends on:
  `[epic-shared-climb-library-invited-access]`.
- [Browse and save](../features/epic-shared-climb-library-browse-save.md) — find,
  inspect, light, and retain compatible contributions in personal playlists —
  depends on: `[epic-shared-climb-library-publish]`.
- [Explicit updates and withdrawal](../features/epic-shared-climb-library-updates.md)
  — revise or withdraw owned contributions and let recipients choose whether to
  accept updates while retaining their data — depends on:
  `[epic-shared-climb-library-browse-save]`.

The chain reflects real contract consumers. Publication establishes shared identity
and immutable revisions; saving records that provenance from its first version;
the final feature consumes both to offer explicit updates. No catalog bootstrap,
logbook, iOS bridge, or manufacturer-sync dependency is introduced.

### Decomposition risks

- **Access proof first:** actual hostname/account configuration and mobile sign-in
  are unverified. Static Assets does not pass verified Access context to the user
  Worker. The access feature must prove the trust boundary, alternative routes,
  expiry, and revocation before declaring the candidate production-ready.
- **Local ownership is the hardest data boundary:** initial saves must include
  backupable source identity/revision. Subsequent updates must detect intervening
  local edits and preserve stable local IDs and playlist order. Separate IndexedDB
  stores are not one transaction; interrupted saves need explicit recovery.
- **Lost responses and concurrent writers:** retries must not duplicate publication;
  updates must reject stale expectations. Refresh failure or a partial result is
  never evidence that a source was withdrawn.
- **Deployment is not a phone migration:** retain the existing origin during phone
  maintenance, validate a fresh backup, and restore deliberately if a different
  origin is chosen. The artwork-distribution companion remains a hosting gate;
  use the authored schematic path where redistribution is unresolved.
- **Keep features bounded:** initial publication owns creation and the revision
  identity contract; the final lifecycle feature owns later mutations. Auth,
  mutation, preservation, browser, and operational checks belong to their owning
  features, not additional test/refactor/deployment items.

Grounding used direct reads of the existing workspace, draft and playlist types,
portable import, Static Assets configuration, and sibling item boundaries. These
known seams left no separate exploration question, so no Explore fan-out was needed.

## Design advisory review

One fresh-context advisory pass at the project's `standard` weight examined the
four feature boundaries, dependency chain, approval claims, privacy, and local-data
preservation. No decomposition blocker was found. Accepted its one useful addition:
authors must rediscover owned publications after browser recovery or on a second
device; the publish and lifecycle briefs now assign that responsibility explicitly.
No extra feature or approval is needed. This is design advice, not implementation
verification or the epic's eventual completion review.

## Research verification (2026-09-26)

Standard verification is complete: 17 source-direct attestations, 39 resolved
citations, zero broken or thin chains. Two named-feature lint flags are line-wrap
false positives: the path/routing claim and D1 recovery-window claim each have
adjacent citations to the exact supporting detail. No estimate, superlative,
unfetched attribution, or analytical-artifact citation was found in the lead check.

The independent reader reopened all 17 official sources. First pass requested four
corrections: preserve the Cloudflare JWT/context documentation tension; attest the
actual logout behavior; mark comparative judgments as inference; and locally cite
the D1 transaction claim. The source records and brief were corrected in place,
including precise cookie wording and explicit no-extra-parsing context detail.
Second-pass verdict: **APPROVED**; all eight checklist categories passed:

- Semantic citation chains and uncited claim shapes: corrected and supported.
- Contradictions and relevance weighting: the provider wording tension remains
  visible, and both platform alternatives retain their qualifications.
- Quote context and analytical-tier inheritance: no substantive verbatim quote
  distortion or prior-analysis-as-source citation.
- Source locations and semantic attestation depth: the details are locatable and
  sufficiently specific, including the narrow invitation-API claim.

The lead independently rechecked Access session/logout behavior, Static Assets
identity limitations, the general JWT instruction, and Supabase production SMTP
requirements against fetched provider pages, then reread the corrected comparison
and lint findings. This verifies the research, not a deployed service or accepted
product design. No acquisition failure or additional research queue item remains.

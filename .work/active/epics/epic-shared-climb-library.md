---
id: epic-shared-climb-library
kind: epic
stage: drafting
tags: [ui, data, security]
research_refs:
  - .research/analysis/briefs/invited-offline-library.md
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
playlists that remain under each person's control. Design alignment is in progress; no
service, authentication provider, or synchronization contract is selected yet.

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

Research recommends retained personal snapshots, explicit updates, owner-managed
published revisions, withdrawal from future distribution, and online-only explicit
publication initially. These are proposals for design alignment, not confirmed
product decisions or implemented behavior.

## Design handoff

Run the research-enhanced `epic-design --only-questions` pass before autonomous
decomposition/implementation. Settle publication ownership/revision/removal rules,
recipient update behavior, and the invite flow from the researched options.
The existing deployment path and artwork-distribution item are audience-access
companions: invited access is not evidence of artwork redistribution permission.
Any new hosting origin must leave the phone's existing library intact and follow
the standing backup/restore process before agent-operated phone maintenance.

## Mockups

Inherit `.mockups/design-system/`. New shared-library and contribution surfaces
require committed mockups before production UI. Proposed journey for alignment:
open the group's library, inspect a shared climb, and add it to a personal list;
from an authored climb, review the shared snapshot and explicitly publish it.
Invitation/sign-in screens depend on the research outcome. No flow is marked
approved or implemented yet.

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
epic-shared-climb-library --paths` found no cycle. Feature decomposition and mockups
remain pending design alignment. The source-grounded comparison passed standard
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

## Directional alignment pending

Two questions are with Andrew; no answer is inferred from elapsed time:

- **Saved-copy behavior:** recommend retaining personal copies when the published
  source changes or is withdrawn, with explicit acceptance of later revisions.
- **Mockup journey:** enter shared browsing, sign in by email code when needed,
  browse, inspect, and save to a personal playlist; publish through an explicit
  review from an authored climb. Reuse the established visual system and allow
  returns to browsing rather than imposing a one-way wizard.

The remaining invite administration choice can start with operator-managed access
under the researched small-circle model; a self-service invitation console is not
assumed. Resolve the directional pass and committed mockups before decomposition.

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

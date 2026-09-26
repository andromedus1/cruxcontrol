---
id: epic-shared-climb-library
kind: epic
stage: drafting
tags: [ui, data, security, needs-research]
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
playlists that remain under each person's control. Scoping is in progress; no
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
establish an invitation/authentication or collaboration-data design. Proposed output:
one focused synthesis brief with standard verification and agent judgment inside
this bounded question; research kickoff settings await the user's confirmation.

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
epic-shared-climb-library --paths` found no cycle. Feature decomposition and research
execution are pending their respective design/grounding checkpoints.

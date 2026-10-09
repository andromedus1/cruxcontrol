---
id: roadmap-next-milestones
created: 2026-09-12
updated: 2026-10-09
tags: []
---

# Next milestones: Kilter community climbs, then invited sharing

Andrew confirmed the laptop migration is complete and authorized resumption on
2026-10-09. Kilter community catalog access now takes priority over partner/friend
sharing; iOS tooling and simulator preparation resume immediately. This is a
priority and resumption capture; the linked work items own their scope. No release
schedule, service architecture, or new feature decomposition is selected here.

## Agreed order

**Preservation priority (2026-10-09):** Andrew has closed further recovery escalation
and chosen to proceed assuming the missing post-migration climbs are lost. The
[incident record](../archive/story-phone-library-recovery.md) preserves the qualified
diagnosis; physical unrecoverability and the deletion trigger remain unproven.
[Independent library preservation](../active/epics/epic-library-preservation.md) is now the
immediate priority: both automatic private online backups and owner-controlled
portable files, with verified restoration. Resume the sequence below after this
protection work; do not treat closing the recovery attempt as permission to reset
the phone or as evidence that safeguards already ship.

Andrew confirmed the immediate sequence after PR #31 merged (2026-10-09):
update and dogfood the older catalog on the connected Android phone, then pursue
current Kilter coverage, then partner sharing. Physical iPhone testing waits for
hardware; retain the native-client proof gate for production sharing. Logbook,
additional board manufacturers, grade prediction and recommendations are explicitly
deferred for now. USB debugging enables phone maintenance but does not itself
establish current catalog acquisition. Preserve and validate a fresh whole-library
backup before updating the phone.

1. **Reliable everyday sessions.** The six selected fixes are implemented and
   verified in [PR #20](https://github.com/andromedus1/cruxcontrol/pull/20):
   [corrupt-climb recovery](../archive/idea-corrupt-climb-list-recovery.md),
   [playlist read-failure isolation](../archive/idea-isolate-playlist-read-failures.md),
   [screenshot dimension limits](../archive/idea-screenshot-import-dimension-limit.md),
   [resolved screenshot warnings](../archive/idea-screenshot-import-resolved-warnings.md),
   [native-share cancellation](../archive/idea-native-share-cancel-status.md), and
   [playlist boundary focus](../archive/idea-playlist-play-through-boundary-focus.md).
   PR #20 is merged into `andromedus1/cruxcontrol` main. Continue dogfooding after
   the phone update; merging the PR does not update the phone.
2. **Resume iPhone preparation on the new laptop.** The
   [iOS epic](../active/epics/epic-ios-controller-bridge.md) is active: Andrew requires
   iPhones to control the board as well as browse, save and publish (2026-09-27).
   Install the required tooling, compile the prototype, and exercise the simulator
   checklist with synthetic data. Simulator work can proceed without an iPhone;
   actual board control still needs physical iPhone acceptance. Prove native BLE,
   local data preservation and sign-in before advancing shared-service implementation.
   Capacitor is the researched first proof candidate; no framework migration is selected.
   The unimplemented access feature/stories return to drafting for native-client design.
3. **Kilter community catalog access: the next major addition.** Bring existing
   Kilter community climbs into the app ahead of invited sharing, beginning with
   the active Fullride board. Existing work includes
   [bootstrap](../active/features/epic-foundation-catalog-bootstrap.md),
   [worker/WASM verification](../active/features/epic-foundation-verify-worker-build.md),
   [provider-neutral queries](../archive/epic-universal-board-platform-catalog-domain.md),
   [sync](../active/epics/epic-catalog-sync.md), and
   [storage fallback](epic-foundation-sqlite-idb-fallback.md).
   The lazy SQLite catalog service and first browser are now wired into the running
   app. Production-browser acceptance passes for consented installation, filtering
   and offline reopening, with exact authored-library preservation. The owning
   items record completed standard reviews and green CI; this branch is not a
   public release. The
   approved older snapshot is explicitly labeled, has unknown source freshness, and
   receives no automatic refresh. Current official-app coverage and permission for
   public binary distribution remain unresolved; retain the existing provider and
   distribution gates before broadening this slice.
   Android/web catalog work can proceed while iPhone hardware is unavailable;
   neither invited-service implementation nor native iPhone acceptance is its gate.
   Andrew approved an explicitly labeled older Kilter library first on 2026-10-09,
   followed by current official-app coverage. The
   [community browser](../archive/kilter-community-browser.md) owns that
   first usable slice; an older snapshot must not be presented as current coverage.
4. **Shared contributed climbs: after Kilter community access and the mobile proof.** Continue the
   [shared-library epic](../active/epics/epic-shared-climb-library.md) so Andrew's partner and
   friends can contribute climbs, receive library updates, control the board, and
   make their own playlists. Aim for explicit submission, library updates independent
   of app releases, and personal drafts/playlists under each person's control.
   Existing portable file sharing is useful groundwork, but does not supply ongoing
   shared-library updates. This work does not depend on importing manufacturer catalogs.
5. **Make access practical for that audience.** Establish a stable installation URL
   using the [existing deployment path](../../docs/DEPLOY.md); deployment was disabled
   at the roadmap review, so recheck configuration before planning changes. Resolve
   [artwork distribution](idea-kilter-artwork-distribution-rights.md) for the intended
   audience and [catalog offer/artifact pairing](idea-catalog-distribution-offer.md)
   for the chosen packaging path. Include the [iOS controller bridge](../active/epics/epic-ios-controller-bridge.md)
   and a practical native distribution path. These are audience-dependent companions
   to the shared-library milestone, rather than work to postpone until afterward.
6. **Local logbook.** Follow the library milestones with a
   [local logbook](../active/epics/epic-logbook.md) for attempts, sends, notes, and
   history. Kilter catalog access is a separate earlier priority, not bundled behind
   delivery of the logbook.
7. **Optional polish.** Retain
   [expanded physical animation-capacity measurements](idea-expanded-fullride-capacity-matrix.md),
   [artwork loading](idea-fullride-artwork-warm-cache-load.md),
   [artwork metadata cleanup](idea-fullride-artwork-metadata-authority.md),
   [shared validation rules](idea-share-domain-validation-invariants.md), and
   [microphone-responsive effects](idea-party-mode.md) behind the priorities above.
8. **Additional manufacturers, one at a time.** Keep
   [multi-board providers](epic-multi-board-providers.md) longer term. Andrew wants
   Kilter, MoonBoard, Tension, and other boards usable from one app, with current
   community libraries. Verify control, layouts, acquisition, update behavior, and
   redistribution separately for each provider. Investigate existing APIs and
   integrations before committing to scraping. The existing epic already owns this
   direction; do not create a duplicate universal-board project.
9. **Grade prediction and personalized training.** Retain
   [grade prediction](epic-grade-prediction.md) and
   [recommendations](epic-recommendations.md), behind the shared wall-session loop
   and broader catalog acquisition. Existing research is a starting point, not proof
   that the models or training pipeline have shipped.

## Resumption state

- **Migration pause resolved (2026-10-09).** Andrew confirmed work is running on
  the new laptop and authorized the tooling installations and continuation.
  The [migration handoff](idea-laptop-migration-handoff.md) records the earlier
  checkpoint and remaining validation. Native BLE prototype preparation is merged
  through PR #29; the laptop pause no longer blocks implementation. This confirmation
  does not itself establish native compilation, phone testing, or library-backup evidence.
- Read this capture, then query `.work/bin/work-view --ready` and the linked items.
  Dependency readiness does not override this product priority order.
- The [effects feature](../archive/epic-route-creation-flashy-light-effect-demos.md)
  and [route-creation epic](../archive/epic-route-creation.md) have completed their
  required reviews, including verified corrections for saved spatial-target recovery.
  Their completed family is archived; full implementation and review records are
  preserved at each stub's `git_ref`. Completed checkpoints under the unfinished
  foundation remain active intentionally.
- Start with tooling for the [iOS direction](../active/epics/epic-ios-controller-bridge.md)
  and advance Kilter catalog access ahead of shared-service implementation. Andrew
  confirmed iPhone board control is required on 2026-09-27. The
  [comparison](../../.research/analysis/briefs/ios-shared-client.md)
  recommends a Capacitor/native-BLE proof while retaining React Native as an alternative.
- Andrew accepted that proof-first plan but has no iPhone available yet; a friend's
  future availability will determine the physical test session. Continue preparation
  and, once Xcode is available, simulator checks under the iOS epic's
  [availability sequence](../active/epics/epic-ios-controller-bridge.md#availability-and-proof-sequence).
  Physical BLE acceptance and the production framework decision remain pending;
  this hardware constraint does not block Android/web catalog work. Shared-service
  implementation remains behind the relevant native-client proof.
- Shared-library audience decisions are settled: invited partner and friends first,
  with Android and iPhone board control required. The
  [owning epic](../active/epics/epic-shared-climb-library.md) records the decisions and
  implementation grounding. Invited members publish immediately within the group,
  without an approval queue. The verified
  [access/storage comparison](../../.research/analysis/briefs/invited-offline-library.md)
  conditionally recommends a small Cloudflare service. Personal copies stay unchanged
  and updates require explicit acceptance. Andrew approved the rendered browse/save
  and publish journeys; [PR #22](https://github.com/andromedus1/cruxcontrol/pull/22)
  is merged. The epic owns four features: invited access, publication,
  browsing/saving, and explicit updates/withdrawal. Invited access has a web candidate
  design and four stories; they return to drafting for native-client requirements.
  Revise its [access design](../active/features/epic-shared-climb-library-invited-access.md)
  after the iOS proof before resuming service implementation.
  Andrew has no hosting account or domain. The [cost/setup comparison](../../.research/analysis/briefs/invited-library-hosting-costs.md)
  supports a conditional free Cloudflare proof, with no domain purchase required;
  actual native-iPhone/mobile/route checks still precede production selection.
- Foundation intent prioritizes Kilter community access ahead of the invited library
  and permits a narrow collaboration service without surrendering local ownership,
  offline use, or recoverability. The epic owns research and design decisions; no
  service stack or authentication provider has been selected.
- Refresh current provider research before implementing old Kilter sync assumptions.
  [Kilter's support page](https://app.kiltergrips.com/support) describes the move off
  its unsupported old app. [Boardsesh's API documentation](https://www.boardsesh.com/docs)
  provides a concrete multi-board integration lead. These were checked on 2026-09-12;
  neither establishes complete current catalog coverage or redistribution permission.
- Preserve Andrew's climbs and playlists during any future phone maintenance using
  the standing [project instructions](../../AGENTS.md#phone-updates-and-library-preservation).
  Backups, authored library contents, and device identifiers stay outside Git.

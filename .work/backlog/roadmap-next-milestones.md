---
id: roadmap-next-milestones
created: 2026-09-12
updated: 2026-09-27
tags: []
---

# Next milestones: shared climbs, then more boards

Andrew approved this priority order on 2026-09-12 and asked to save it for a later
session. This is a priority and resumption capture; the linked work items own their
scope. No release schedule, service architecture, or new feature decomposition is
selected here.

## Agreed order

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
2. **Establish iPhone board control before advancing shared climbs.** The
   [iOS epic](../active/epics/epic-ios-controller-bridge.md) is active: Andrew requires
   iPhones to control the board as well as browse, save and publish (2026-09-27).
   Compare shared-code paths and prove native BLE, local data preservation and sign-in.
   Capacitor is the researched first proof candidate; no framework migration is selected.
   The unimplemented access feature/stories return to drafting for native-client design.
3. **Shared contributed climbs: the next major addition after the mobile proof.** Continue the
   [shared-library epic](../active/epics/epic-shared-climb-library.md) so Andrew's partner and
   friends can contribute climbs, receive library updates, control the board, and
   make their own playlists. Aim for explicit submission, library updates independent
   of app releases, and personal drafts/playlists under each person's control.
   Existing portable file sharing is useful groundwork, but does not supply ongoing
   shared-library updates. This work does not depend on importing manufacturer catalogs.
4. **Make access practical for that audience.** Establish a stable installation URL
   using the [existing deployment path](../../docs/DEPLOY.md); deployment was disabled
   at the roadmap review, so recheck configuration before planning changes. Resolve
   [artwork distribution](idea-kilter-artwork-distribution-rights.md) for the intended
   audience. Include the [iOS controller bridge](../active/epics/epic-ios-controller-bridge.md)
   and a practical native distribution path. These are audience-dependent companions
   to the shared-library milestone, rather than work to postpone until afterward.
5. **Catalogs and a logbook.** Follow with community-catalog browsing/updates and a
   [local logbook](../active/epics/epic-logbook.md) for attempts, sends, notes, and
   history. Existing catalog work includes
   [bootstrap](../active/features/epic-foundation-catalog-bootstrap.md),
   [worker/WASM verification](../active/features/epic-foundation-verify-worker-build.md),
   [provider-neutral queries](epic-universal-board-platform-catalog-domain.md),
   [sync](../active/epics/epic-catalog-sync.md), and
   [storage fallback](epic-foundation-sqlite-idb-fallback.md).
   SQLite catalog infrastructure is present but not wired into the running app;
   these capabilities must not be mistaken for delivered catalog access.
6. **Optional polish.** Retain
   [expanded physical animation-capacity measurements](idea-expanded-fullride-capacity-matrix.md),
   [artwork loading](idea-fullride-artwork-warm-cache-load.md),
   [artwork metadata cleanup](idea-fullride-artwork-metadata-authority.md),
   [shared validation rules](idea-share-domain-validation-invariants.md), and
   [microphone-responsive effects](idea-party-mode.md) behind the priorities above.
7. **Additional manufacturers, one at a time.** Keep
   [multi-board providers](epic-multi-board-providers.md) longer term. Andrew wants
   Kilter, MoonBoard, Tension, and other boards usable from one app, with current
   community libraries. Verify control, layouts, acquisition, update behavior, and
   redistribution separately for each provider. Investigate existing APIs and
   integrations before committing to scraping. The existing epic already owns this
   direction; do not create a duplicate universal-board project.
8. **Grade prediction and personalized training.** Retain
   [grade prediction](epic-grade-prediction.md) and
   [recommendations](epic-recommendations.md), behind the shared wall-session loop
   and broader catalog acquisition. Existing research is a starting point, not proof
   that the models or training pipeline have shipped.

## Resume next session

- Read this capture, then query `.work/bin/work-view --ready` and the linked items.
  Dependency readiness does not override this product priority order.
- The [effects feature](../archive/epic-route-creation-flashy-light-effect-demos.md)
  and [route-creation epic](../archive/epic-route-creation.md) have completed their
  required reviews, including verified corrections for saved spatial-target recovery.
  Their completed family is archived; full implementation and review records are
  preserved at each stub's `git_ref`. Completed checkpoints under the unfinished
  foundation remain active intentionally.
- Start with the [iOS direction](../active/epics/epic-ios-controller-bridge.md), not
  shared-service implementation. Andrew confirmed iPhone board control is required
  on 2026-09-27. The [comparison](../../.research/analysis/briefs/ios-shared-client.md)
  recommends a Capacitor/native-BLE proof while retaining React Native as an alternative.
- Andrew accepted that proof-first plan but has no iPhone available yet; a friend's
  future availability will determine the physical test session. Continue preparation
  and, once Xcode is available, simulator checks under the iOS epic's
  [availability sequence](../active/epics/epic-ios-controller-bridge.md#availability-and-proof-sequence).
  Physical BLE acceptance and the production framework decision remain pending;
  do not treat this availability constraint as permission to resume shared-service
  implementation under the unproven native-auth design.
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
- Foundation intent now prioritizes the invited library and permits a narrow
  collaboration service without surrendering local ownership, offline use, or
  recoverability. The epic owns research and design decisions; no service stack or
  authentication provider has been selected.
- Refresh current provider research before implementing old Kilter sync assumptions.
  [Kilter's support page](https://app.kiltergrips.com/support) describes the move off
  its unsupported old app. [Boardsesh's API documentation](https://www.boardsesh.com/docs)
  provides a concrete multi-board integration lead. These were checked on 2026-09-12;
  neither establishes complete current catalog coverage or redistribution permission.
- Preserve Andrew's climbs and playlists during any future phone maintenance using
  the standing [project instructions](../../AGENTS.md#phone-updates-and-library-preservation).
  Backups, authored library contents, and device identifiers stay outside Git.

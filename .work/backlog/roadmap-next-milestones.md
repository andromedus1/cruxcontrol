---
id: roadmap-next-milestones
created: 2026-09-12
updated: 2026-09-12
tags: []
---

# Next milestones: shared climbs, then more boards

Andrew approved this priority order on 2026-09-12 and asked to save it for a later
session. This is a priority and resumption capture; the linked work items own their
scope. No release schedule, service architecture, or new feature decomposition is
selected here.

## Agreed order

1. **Reliable everyday sessions.** Continue dogfooding and prioritize
   [corrupt-climb recovery](idea-corrupt-climb-list-recovery.md),
   [playlist read-failure isolation](idea-isolate-playlist-read-failures.md),
   [screenshot dimension limits](idea-screenshot-import-dimension-limit.md),
   [resolved screenshot warnings](idea-screenshot-import-resolved-warnings.md),
   [native-share cancellation](idea-native-share-cancel-status.md), and
   [playlist boundary focus](idea-playlist-play-through-boundary-focus.md).
2. **Shared contributed climbs: the next major addition.** Scope the
   [shared-library idea](idea-shared-climb-library.md) so Andrew's partner and
   friends can contribute climbs, receive library updates, control the board, and
   make their own playlists. Aim for explicit submission, library updates independent
   of app releases, and personal drafts/playlists under each person's control.
   Existing portable file sharing is useful groundwork, but does not supply ongoing
   shared-library updates. This work does not depend on importing manufacturer catalogs.
3. **Make access practical for that audience.** Establish a stable installation URL
   using the [existing deployment path](../../docs/DEPLOY.md); deployment was disabled
   at the roadmap review, so recheck configuration before planning changes. Resolve
   [artwork distribution](idea-kilter-artwork-distribution-rights.md) for the intended
   audience. Reprioritize the [iOS controller bridge](epic-ios-controller-bridge.md)
   if the group needs iPhone board control. These are audience-dependent companions
   to the shared-library milestone, rather than work to postpone until afterward.
4. **Catalogs and a logbook.** Follow with community-catalog browsing/updates and a
   [local logbook](../active/epics/epic-logbook.md) for attempts, sends, notes, and
   history. Existing catalog work includes
   [bootstrap](../active/features/epic-foundation-catalog-bootstrap.md),
   [worker/WASM verification](../active/features/epic-foundation-verify-worker-build.md),
   [provider-neutral queries](epic-universal-board-platform-catalog-domain.md),
   [sync](../active/epics/epic-catalog-sync.md), and
   [storage fallback](epic-foundation-sqlite-idb-fallback.md).
   SQLite catalog infrastructure is present but not wired into the running app;
   these capabilities must not be mistaken for delivered catalog access.
5. **Optional polish.** Retain
   [expanded physical animation-capacity measurements](idea-expanded-fullride-capacity-matrix.md),
   [artwork loading](idea-fullride-artwork-warm-cache-load.md),
   [artwork metadata cleanup](idea-fullride-artwork-metadata-authority.md),
   [shared validation rules](idea-share-domain-validation-invariants.md), and
   [microphone-responsive effects](idea-party-mode.md) behind the priorities above.
6. **Additional manufacturers, one at a time.** Keep
   [multi-board providers](epic-multi-board-providers.md) longer term. Andrew wants
   Kilter, MoonBoard, Tension, and other boards usable from one app, with current
   community libraries. Verify control, layouts, acquisition, update behavior, and
   redistribution separately for each provider. Investigate existing APIs and
   integrations before committing to scraping. The existing epic already owns this
   direction; do not create a duplicate universal-board project.
7. **Grade prediction and personalized training.** Retain
   [grade prediction](epic-grade-prediction.md) and
   [recommendations](epic-recommendations.md), behind the shared wall-session loop
   and broader catalog acquisition. Existing research is a starting point, not proof
   that the models or training pipeline have shipped.

## Resume next session

- Read this capture, then query `.work/bin/work-view --ready` and the linked items.
  Dependency readiness does not override this product priority order.
- The [effects feature](../active/features/epic-route-creation-flashy-light-effect-demos.md)
  has completed implementation and physical dogfooding, but still needs its standard
  independent feature review. Its parent remains open; finish the required review
  and aggregate closure before archiving that family. Completed checkpoints under
  the unfinished foundation also remain active intentionally.
- Before scoping the shared library, resolve the two unanswered audience questions:
  invited partner/friends first or everyone using CruxControl; and whether those
  people need iPhone board control. General approval of this roadmap did not answer
  either question or choose an update mechanism.
- At shared-library scoping, align the foundation documents with the approved
  priority. `docs/VISION.md` still calls ML the headline differentiator and contains
  a blanket no-server-side-user-data statement alongside its narrower allowance for
  collaboration services. Preserve local ownership, offline use, and recoverability
  while deciding the smallest service the shared library actually requires.
- Refresh current provider research before implementing old Kilter sync assumptions.
  [Kilter's support page](https://app.kiltergrips.com/support) describes the move off
  its unsupported old app. [Boardsesh's API documentation](https://www.boardsesh.com/docs)
  provides a concrete multi-board integration lead. These were checked on 2026-09-12;
  neither establishes complete current catalog coverage or redistribution permission.
- Preserve Andrew's climbs and playlists during any future phone maintenance using
  the standing [project instructions](../../AGENTS.md#phone-updates-and-library-preservation).
  Backups, authored library contents, and device identifiers stay outside Git.

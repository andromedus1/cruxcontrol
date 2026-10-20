---
provenance: agent-synthesis
updated: 2026-10-19
facet: legacy-aurora-sync
campaign: kilter-current-catalog-sources
---

# Legacy Aurora-hosted Kilter sync and BoardLib: current status (as of 2026-10-19)

## Findings

**1. BoardLib's Kilter path is unmaintained since 2026-03-17 and targets the legacy host.** BoardLib `main` is commit `4fa8a2e4` (2026-03-17, "Bump version from 0.14.1 to 0.15.1"); PyPI latest is 0.15.1; no later commits [kcs-boardlib-head-2026-10]{1}. Its Kilter code points at `https://kilterboardapp.com` (`HOST_BASES["kilter"] = "kilterboardapp"`) [kcs-boardlib-head-2026-10]{1}. The commits after Kilter's transition touch image downloading and MoonBoard, not Kilter endpoints [kcs-boardlib-head-2026-10]{1}. README still says all Aurora-based boards "(Kilter, Tension, etc.)" are supported, with no migration notice [kcs-boardlib-head-2026-10]{1}.

**2. Multiple independent sources say the legacy Kilter backend is gone.**
- Kilter's first-party support page: "The old app is no longer supported, and we weren't able to transfer account data during the transition." [kcs-kilter-support-claim]{3}
- Trade press (published 2026-03-31): "The previous Kilter app was taken down by the third-party company that operated it." [kcs-kilter-support-claim]{3}
- BoardLib issue #78 (opened 2026-03-27, still open): reporter states BoardLib's Kilter integration "relies on the Aurora Kilter endpoint, which no longer works"; the maintainer replies by asking for PRs for the new endpoints and does not dispute it [kcs-boardlib-issues-2025-2026]{2}. This is a user claim; no error output or status codes are posted [kcs-boardlib-issues-2025-2026]{2}.
- Boardsesh (a downstream consumer that previously synced Kilter from Aurora) documents that its Aurora sync "was switched off for Kilter on 2026-03-30", that "Kilter Grips split from Aurora Climbing's backend", and "Since the Kilter backend has been shut down, API-based sync is no longer available for Kilter users" [kcs-boardsesh-docs-legacy]{4}.
- Aurora Climbing's own site lists Tension, Decoy, So iLL, Grasshopper, Touchstone and Aurora boards; the fetch found no Kilter mention [kcs-kilter-support-claim]{3}.

**3. No evidence found of the legacy API serving climbs created after the transition.** Combined reading: the legacy service was taken down around late March 2026 [kcs-boardlib-issues-2025-2026]{2}[kcs-kilter-support-claim]{3}[kcs-boardsesh-docs-legacy]{4}; I found no report, commit or issue showing it serving data after that. The exact latest climb date the legacy API ever served is not stated in any fetched source. A weaker marker: Boardsesh's snapshot of legacy placement data shows `board_shared_syncs` placements last synced 2024-06-22, and some post-2024 hold-set placements are absent from that legacy snapshot [kcs-boardsesh-docs-legacy]{4}. `{inferred: aggregate}` that legacy-derived data is a frozen pre-transition corpus; its precise cutoff is unmeasured here.

**4. Pre-shutdown, Aurora was already hostile to third parties.** BoardLib issue #65 (July 2025) reports Aurora adding App Attest that "will soon block all external access" and advises backups [kcs-boardlib-issues-2025-2026]{2}; maintainer later calls Aurora "hostile towards these projects" [kcs-boardlib-issues-2025-2026]{2}. BoardLib PRs #63/#64/#67 show repeated API changes in June-July 2025 requiring patches [kcs-boardlib-issues-2025-2026]{2}. Whether App Attest was ever enforced on `/sync` is not established by fetched sources; BoardLib kept a working path to at least 2026-03 per its commit history, but #78 postdates that.

**5. Legacy sync protocol, as implemented in BoardLib (public open-source code).**
- Cursor: per-table `last_synchronized_at` string; initial value "1970-01-01 00:00:00.000000" or the values in the local SQLite `shared_syncs` table [kcs-boardlib-head-2026-10]{1}.
- Request: `POST https://kilterboardapp.com/sync`, `Content-Type: application/x-www-form-urlencoded`, body `table=cursor&table2=cursor2...` (URL-quoted), optional `Cookie: token=<session>`; custom iOS-style User-Agent [kcs-boardlib-head-2026-10]{1}.
- Response: JSON of `{table_name: [row, ...], ..., "shared_syncs": [{table_name, last_synchronized_at}], "user_syncs": [...], "_complete": bool}`. Client advances each requested table's cursor from `shared_syncs` (and `user_syncs` when a token is present) and re-POSTs until `_complete` or 100 pages [kcs-boardlib-head-2026-10]{1}. This is incremental: BoardLib/Boardsesh describe Aurora as re-sending only changed rows [kcs-boardlib-head-2026-10]{1}[kcs-boardsesh-docs-legacy]{4}.
- Auth: BoardLib's `database` command always logs in (`POST /sessions` with username/password, JSON, returns session token) before syncing; without `--username` it skips sync [kcs-boardlib-head-2026-10]{1}. The function `sync()` itself accepts `token=None`, so anonymous shared sync is possible in code but BoardLib does not use it for the database command [kcs-boardlib-head-2026-10]{1}. Maintainer: password "is only needed for synchronizing the database to the latest state" [kcs-boardlib-issues-2025-2026]{2}.
- Apply: `INSERT OR REPLACE` per table using column order from `PRAGMA table_info`; only `climb_stats` has deletion logic (rows whose `display_difficulty` is null are deleted by `(climb_uuid, angle)`; display_difficulty = benchmark_difficulty else difficulty_average) [kcs-boardlib-head-2026-10]{1}. No tombstone handling for `climbs` is present in BoardLib; I did not find how the legacy protocol signalled climb deletion `{ambiguous: not in fetched code}`.
- Bootstrapped DB: BoardLib downloads the Android APK bundle from `d.apkpure.net`, extracts `assets/db.sqlite3` [kcs-boardlib-head-2026-10]{1}. Maintainer: without sync "you'll still have the database at whatever state it was in when the APK was last released" [kcs-boardlib-issues-2025-2026]{2}. The APK is for the old `com.auroraclimbing.kilterboard` package; I did not verify whether apkpure still serves a current build.
- Tables touched by BoardLib code: `shared_syncs`, `climbs`, `climb_stats`, `difficulty_grades`, `layouts`, `product_sizes`, `product_sizes_layouts_sets` [kcs-boardlib-head-2026-10]{1}. Rate limits: none documented in the code beyond the 100-page cap [kcs-boardlib-head-2026-10]{1}.

**6. Identity compatibility between legacy and new data (second-hand, from Boardsesh docs).** New Kilter "inherited Aurora's climb UUIDs" (~80% of Boardsesh's existing catalog matched by UUID); legacy `frames` uses `p{placementId}r{code}` while new `climb_concat` uses `h{holeId}p{code}`, bridged via `board_placements(layout_id, hole_id)`; new product layouts are finer-grained than legacy layouts (six "Original" variants map to legacy `layout_id=1`) [kcs-boardsesh-docs-legacy]{4}. Detailed new-API treatment belongs to the sibling facet.

**7. BoardLib is not a current source.** The maintainer calls its utility "a bit stale" and says Boardsesh snapshots could replace the `database` command, accepting PRs; none merged as of this date [kcs-boardlib-issues-2025-2026]{2}. Boardsesh publishes per-layout SQLite snapshots (kilter layout 1: 385,746 climbs, watermark 2026-10-03) [kcs-boardsesh-snapshot-manifest]{5}; they are fed by the new Kilter backend, not Aurora [kcs-boardsesh-docs-legacy]{4}.

**8. Other legacy-API consumers.** climbdex's last commit is 2025-08-12 (no evidence of liveness after the transition) [kcs-climbdex-commits]{6}. Hangtime's Kilter client targets only the new Keycloak/PowerSync endpoints, requires an account, and syncs gyms/walls only [kcs-hangtime-kilter-client]{7}; its repo has near-daily bot commits through 2026-10-19 (live new-app endpoints) [kcs-hangtime-kilter-client]{7}.

**9. Terms.** No Aurora Climbing terms of service text was obtainable: `auroraclimbing.com/terms`, `/terms-of-service` and `tensionboardapp2.com/terms` returned 404; web search found none [kcs-kilter-support-claim]{3}. The characterisation on record in the fetched sources is the BoardLib maintainer's "Aurora was hostile towards these projects" [kcs-boardlib-issues-2025-2026]{2}. Nothing found on redistribution rights for legacy data.

## Disconfirming analysis
- Searched for evidence the legacy host still serves data post-March 2026: BoardLib issues/commits (none after 2026-03-17 mentioning success) [kcs-boardlib-head-2026-10]{1}[kcs-boardlib-issues-2025-2026]{2}; Boardsesh docs say the opposite [kcs-boardsesh-docs-legacy]{4}; Kilter statements say old app "taken down" [kcs-kilter-support-claim]{3}. Found none confirming liveness. Absence is not proof: no source reports a direct probe, and I did not call the API (constraint). Issue #78's "no longer works" is a single unverified user report, but it is corroborated by [kcs-kilter-support-claim]{3} and [kcs-boardsesh-docs-legacy]{4}, which are independent of it.
- The one hint of ambiguity: the Kilter statement says "taken down by the third-party company" without a date; Boardsesh's switch-off date (2026-03-30) is a consumer's action date, not necessarily the shutdown date `{inferred: convergence}`.
- Searched BoardLib for any Kilter migration commit: none [kcs-boardlib-head-2026-10]{1}. Searched for BoardLib fork/PR to new endpoints: only issue invitation [kcs-boardlib-issues-2025-2026]{2}.
- A TLS error fetching `https://kilterboardapp.com/` homepage was obtained once via the fetch tool; I treat it as inconclusive.

## Contradictions
- BoardLib README (HEAD) lists Kilter as a supported Aurora-based board with working sync [kcs-boardlib-head-2026-10]{1} vs. issue #78 and Kilter/Boardsesh statements that the legacy Kilter endpoint is gone [kcs-boardlib-issues-2025-2026]{2}[kcs-kilter-support-claim]{3}[kcs-boardsesh-docs-legacy]{4}. Positions stand side by side; the README is simply stale relative to dated events after its last commit (2026-03-17 vs. 2026-03-27/03-30) `{inferred: divergence}`.

## Revisit if
- Someone publishes an observed response (status/body, latest climb date) from `kilterboardapp.com/sync` after 2026-03.
- BoardLib merges a PR for Kilter Keycloak/PowerSync or Boardsesh snapshots.
- Aurora Climbing publishes terms or a statement on the legacy Kilter data, or Kilter/Aurora announce a data-sharing deal (referenced as possible in [kcs-boardlib-issues-2025-2026]{2}).
- Kilter's claim process publishes how legacy-created climbs are identified in the new catalog.

## Implementation-relevant notes
- Treat the legacy API as non-viable for new climbs: any updater should not depend on `kilterboardapp.com/sync` [kcs-boardlib-issues-2025-2026]{2}[kcs-kilter-support-claim]{3}[kcs-boardsesh-docs-legacy]{4}. The legacy corpus is useful only as a frozen baseline whose cutoff must be measured from the user's own DB (`shared_syncs.last_synchronized_at` per table) [kcs-boardlib-head-2026-10]{1}.
- For a legacy-format SQLite DB, `shared_syncs` holds per-table cursors and `climb_stats` null `display_difficulty` rows mean delete [kcs-boardlib-head-2026-10]{1}.
- Compatibility: preserve climb UUIDs (stable across the split, [kcs-boardsesh-docs-legacy]{4}); translate new hole-based `climb_concat` to legacy placement ids via per-layout hole->placement mapping; expect new holes/layouts with no legacy placement rows (e.g. hold sets after 2024-06) [kcs-boardsesh-docs-legacy]{4}.
- Deletions in the new catalog come via a separate deleted-UUID list endpoint according to [kcs-boardsesh-docs-legacy]{4}; sibling facet owns details.
- Aurora-era APK DB extraction relies on third-party mirror apkpure; fragile [kcs-boardlib-head-2026-10]{1}.

## Gaps
- No direct evidence of the last climb date served by the legacy API; no liveness probe was permitted.
- No Aurora Climbing terms/API-use text obtained.
- Exact shutdown date of the legacy backend not stated in any source; 2026-03-27..03-31 bracket from [kcs-boardlib-issues-2025-2026]{2}[kcs-kilter-support-claim]{3}[kcs-boardsesh-docs-legacy]{4}.
- Legacy deletion signalling for climbs not found in BoardLib code.
- Whether apkpure still serves an APK with a recent embedded DB is unchecked.

## Bibliography
1. kcs-boardlib-head-2026-10
2. kcs-boardlib-issues-2025-2026
3. kcs-kilter-support-claim
4. kcs-boardsesh-docs-legacy
5. kcs-boardsesh-snapshot-manifest
6. kcs-climbdex-commits
7. kcs-hangtime-kilter-client

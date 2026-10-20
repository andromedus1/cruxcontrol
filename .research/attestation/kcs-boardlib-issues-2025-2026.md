---
source_handle: kcs-boardlib-issues-2025-2026
fetched: 2026-10-19
source_url: https://github.com/lemeryfertitta/BoardLib/issues
provenance: source-direct
substrate_confidence: source-direct
---

# BoardLib issues relevant to legacy Aurora/Kilter status (read via GitHub API 2026-10-19)

## #78 "Kilter Aurora API got removed, new app uses Keycloak auth + PowerSync sync" (open; opened 2026-03-27 by Stevie-Ray)
- Body: "BoardLib's Kilter integration relies on the Aurora Kilter endpoint, which no longer works, it should move to the V2 app endpoint." Reports new app auth "POST https://idp.kiltergrips.com/realms/kilter/protocol/openid-connect/token", API base "https://portal.kiltergrips.com/api", PowerSync backend "https://sync1.kiltergrips.com" ("that seems to synced board/wall data i havent looked at the climbs/logbooks"). Links a reference implementation (hangtime-climbing-boards api/kilter.client.ts).
- Comment azuttre (2026-03-27): "The new backend doesn't have user's logbooks per their instagram." Has old BoardLib logbook backups.
- Comment lemeryfertitta (maintainer, 2026-03-27): welcomes PRs for the new Kilter endpoints; "Long-run, this might be a nice change for the open source community, as Aurora was hostile towards these projects."; user data cannot be recovered "unless Kilter and Aurora make some kind of deal".
- Issue has 2 comments; no PR resolving it as of 2026-10-19 (no repository commits after 2026-03-17).
- Note: the "no longer works" statement is the reporter's claim, not a measured result in the issue; no error output posted.

## #80 "Boardsesh database snapshots" (open; opened 2026-07-15 by marcodejongh; maintainer reply 2026-08-07)
- Proposes Boardsesh CDN snapshots as an alternative source: "one artifact per (board type, layout) — so kilter/1 is the full Kilter original-layout catalog (all 370k climbs across all wall sizes)"; "Where possible Boardsesh uses the same id as the upstream climbs database, to make sure logbooks etc work."
- Maintainer: "could replace the `database` command implementation with that source"; "Boardlib's utility is probably a bit stale right now with changes in the app ecosystem and such".

## #65 "Aurora will soon block this again" (closed 2025-07-18; opened 2025-07-07 by marcodejongh)
- "Looks like Aurora is adding App Attest to the app which will soon block all external access"; recommends "keeping backups of the data, as soon you won't be able to update anymore." Follow-up 2025-07-08: attest "already in the current version", waiting for devices to update.

## #70 "Password to download database" (closed 2025-08-26)
- Maintainer: password is the Kilter login; "the password is only needed for synchronizing the database to the latest state. If you don't mind an old database, you can just fail/ctrl-c at the password check and you'll still have the database at whatever state it was in when the APK was last released."

## PRs #63/#64/#67 (June-July 2025)
- #63: "new login endpoints and the new sync endpoint"; #64 (2025-07-05) "The aurora apis changed some more"; #67 (2025-07-17): apkpure now serves an app bundle with nested APK. Shows Aurora-era API churn through mid-2025, with BoardLib patched each time.

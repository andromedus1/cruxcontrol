---
source_handle: kcs-kilter-support-claim
fetched: 2026-10-19
source_url: https://app.kiltergrips.com/support
provenance: source-direct
substrate_confidence: source-direct
---

# Kilter first-party support page + trade press on the legacy app

## https://app.kiltergrips.com/support (fetched 2026-10-19, content via WebFetch summarization)
- "The old app is no longer supported, and we weren't able to transfer account data during the transition."
- "Almost all climbs created on the old app have been preserved."
- Process: "Request a data export from Aurora and upload it through our Claim Data page — we'll verify your ownership and migrate them to your new account."; logbooks/send histories reclaimed through the same export+claim; "Draft climbs from the old app may be included in your data export."; claims processed at kilterboard.io/claim ("We've started processing claims this week").
- "The automatic Liked Climbs playlist will only show climbs you've liked in the new app until you complete the steps."
(Caveat: text came through an LLM-summarized fetch; quoted strings were returned as quotations by the fetcher.)

## https://climbingbusinessjournal.com/new-kilter-board-app-reclaim-the-boulders-you-created/ (published 2026-03-31 per fetch)
- "The previous Kilter app was taken down by the third-party company that operated it."
- "We're also working on recovering personal user data (logbooks, history) from the old app. We can't make promises on that front — the data was held by a third party — but we're doing everything we can."
- No takedown date given in the article.

## https://auroraclimbing.com (fetched 2026-10-19)
- Page lists Tension Board, Decoy Board, So iLL Connect Board, Grasshopper Board, Touchstone Board, and Aurora Board with apps; the fetch found no mention of Kilter, nor terms links.
- Attempted https://auroraclimbing.com/terms, /terms-of-service and https://tensionboardapp2.com/terms: all HTTP 404. No Aurora Climbing terms text was obtained.
- A WebFetch of https://kilterboardapp.com/ (a single homepage fetch through the fetch tool, not an API call; no /sync or other API path was requested) failed with a TLS error (TLSV1_ALERT_INTERNAL_ERROR); this is a single tool-level observation and not evidence of service status.

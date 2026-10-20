---
provenance: agent-synthesis
updated: 2026-10-19
facet: kilter-first-party
---

# Kilter first-party app, web presence, and terms

## Findings

### Timeline of the app transition
- The previous Kilter app was operated by Aurora Climbing. Reported chronology: 2026-03-19 Kilter cease-and-desist to Aurora; 2026-03-26 Aurora took the app out of the stores / disabled its server; 2026-03-30 a court dismissed Kilter's suit without prejudice; 2026-03-31 Kilter press release for its new app [kcs-news-yahoo]{1} [kcs-vertige]{2} [kcs-cbj-press]{3}. One source dates the backend shutdown March 25 [kcs-boardsesh-migration]{4}; sources differ by a day (see Contradictions).
- Kilter's statement: "The previous Kilter app was taken down today by the third-party company that operated it. We were not aware this would happen." [kcs-news-yahoo]{1}. Kilter says it now controls "the entire stack" and the app is early [kcs-cbj-press]{3}.

### First-party presence
- Consumer pages: kilterboard.io and app.kiltergrips.com serve the same landing page; settercloset.com is the marketing site (kiltergrips.com redirects there) [kcs-kilter-landing]{5}. Store apps: iOS id 6755110303 and Android com.kiltergrips.kilter_board_app [kcs-kilter-landing]{5}. iOS seller is Kilter LLC; listing mentions climbs "filtered by board size compatibility" and user-created/shared climbs; account login required for full function [kcs-appstore-ios]{6}.
- Public API or developer documentation: none found. Landing, support, FAQ, claim, and store pages contain no API/developer links [kcs-kilter-landing]{5} [kcs-kilter-support]{7} [kcs-settercloset-pages]{8}, and the Terms never mention an API [kcs-kilter-terms]{9}. Absence in fetched pages, not proof of nonexistence.
- Catalog exposure: the app is described as offering "thousands of climbs" from gyms worldwide [kcs-kilter-landing]{5}; no page lists supported layouts/sizes (including 7x10 Fullride) [kcs-kilter-support]{7} [kcs-settercloset-pages]{8}. Coverage by layout is therefore unanswered from first-party public pages.

### Data claim / migration
- Official flow at kilterboard.io/claim: (a) request an export from Aurora, then upload the JSON to Kilter's portal (up to 6MB, 5-7 business days), recovering "climbs, logbook, drafts etc"; (b) manual claim recovers only published climbs by ownership verification [kcs-kilter-claim]{10}. Scope is per-user ownership attachment; no bulk catalog export is offered [kcs-kilter-claim]{10}.
- Kilter says created climbs were preserved and old-app setter usernames were imported as plain text, not linked to accounts until claimed [kcs-kilter-support]{7}. The press release says personal-data recovery cannot be promised [kcs-cbj-press]{3}. The official app has no import for the Aurora JSON (third-party commentary) [kcs-ownclimb]{11}.
- New accounts are required; old credentials do not transfer [kcs-kilter-support]{7}.
- Legacy-ID continuity: Kilter pages do not state it. A third-party PR author reports climb UUIDs and difficulty-grade IDs remained unchanged across the split, and that climbs created after the split are absent from the legacy catalog [kcs-boardlib-pr1]{12} (secondary claim; `{confidence: secondary}`). Placement/hole/LED/layout ID continuity: not addressed by any first-party source fetched.

### Legacy host status
- Kilter has not (in fetched pages) announced shutdown/freezing of kilterboardapp.com; it says "The old app is no longer supported" [kcs-kilter-support]{7}. A single reachability check on 2026-10-19 found the host resolves but fails TLS handshake [kcs-legacy-host-observation]{13}, matching a third-party report [kcs-boardlib-pr1]{12}. No path was probed.

### Official statements on third-party apps / open data
- None found in Kilter's pages, terms, privacy policy, or press release. Third-party commentary notes third-party clients are "at the mercy of the APIs they talk to" [kcs-ownclimb]{11}. Boardsesh states it is not affiliated with Aurora and publishes its own API; it says nothing about Kilter permission [kcs-boardsesh-about]{14}.

### Terms analysis (applies campaign-wide)
Kilter, LLC Terms of Use, updated 2026-03-09 [kcs-kilter-terms]{9}:
- Automated access: "don't ... try to access them using a method other than the interface and the instructions that we provide, or extensively or automatically copy any content from the Services (in other words, no scraping)."
- Reverse engineering of Services or Software prohibited absent written permission. Software licence is "personal, non-commercial".
- Services use is "personal non-commercial use".
- Kilter may add limits or stop providing Services at any time; terms are modifiable at will.
- No section on ownership/licensing of user-created climbs; no API terms; no data-export provision; no explicit treatment of third-party clients.
Product terms: reverse engineering prohibited (12a); reference to a "Third-Party App Integration Agreement" whose text was not seen; Kilter owns IP in Products [kcs-kilter-product-terms]{15}.
Privacy policy: only a personal-data portability right (EU) and access by email request; silent on climbs/API [kcs-kilter-privacy]{16}.
Reading `{inferred: terms-vs-use}`: reading from the terms alone, programmatic copying of the first-party service's catalog is contrary to the "no scraping"/"interface and instructions" language; personal-use versus redistribution is not distinguished by the terms, and the user-content licence gap leaves climb-ownership status open (setters' ownership is implied only by the claim flow, which verifies ownership of boulders). Whether any given third-party route is permitted is a legal question for counsel.

## Implementation-relevant notes
- There is no documented, supported programmatic catalog source from Kilter: no public API, no bulk export [kcs-kilter-landing]{5} [kcs-kilter-claim]{10} [kcs-kilter-terms]{9}.
- The only official user-facing routes to old data are Aurora's JSON export (on request, via email) and the Kilter claim portal, both per-user [kcs-kilter-claim]{10}.
- Reported (not Kilter-documented) new-app sync stack is Keycloak plus PowerSync [kcs-boardlib-pr1]{12}; it requires an account and was not examined here, per constraints.
- Legacy-catalog UUID/grade-ID reuse is reported but unverified by first-party sources; do not assume placement/layout ID continuity [kcs-boardlib-pr1]{12}.
- Legacy Aurora host does not complete TLS handshake from this check [kcs-legacy-host-observation]{13}; a snapshot-based legacy catalog will not receive new climbs from it.

## Disconfirming analysis
- Searched for an API/developer page, third-party policy, and 7x10/layout list across kilterboard.io, app.kiltergrips.com, settercloset.com, store listing, terms, privacy: none found. The Play Store page fetch failed and Reddit/staff posts were not retrieved, so statements there remain unchecked.
- Searched for evidence legacy climbs share IDs: only a third-party PR asserts it; no first-party contradiction found.
- The "no scraping" reading could be narrowed by an unseen "Third-Party App Integration Agreement"; its text was not located.

## Contradictions
- Shutdown date: Boardsesh page says Aurora backend gone March 25 [kcs-boardsesh-migration]{4}; press chronology says March 26 [kcs-news-yahoo]{1} [kcs-vertige]{2}. Positions left side by side (may be server vs store timing).
- Preservation: support page says created climbs were preserved [kcs-kilter-support]{7}; press release says logbook recovery cannot be promised [kcs-cbj-press]{3}; claim page says manual claim recovers climbs only, JSON recovers more [kcs-kilter-claim]{10}. These concern different data classes; recorded as a `qualifies` relationship.

## Revisit if
- Kilter publishes an API, developer terms, a bulk export, or a third-party-app policy.
- Terms of Use are revised from the 2026-03-09 version.
- A "Third-Party App Integration Agreement" text is found.
- Kilter staff statements (Reddit/Instagram/email) on third-party apps or legacy IDs are obtained.
- kilterboardapp.com changes reachability.

## Gaps
- Layout/size coverage (including 7x10 Fullride) of the new app's catalog; whether post-March-2026 climbs exist for it.
- First-party statement on legacy ID continuity and on deletions/edits/grade schema.
- Google Play listing content; Kilter social/Reddit statements; the Third-Party App Integration Agreement.
- Whether Kilter claims ownership or a licence over user-created climbs (terms silent).

## Bibliography
1. kcs-news-yahoo
2. kcs-vertige
3. kcs-cbj-press
4. kcs-boardsesh-migration
5. kcs-kilter-landing
6. kcs-appstore-ios
7. kcs-kilter-support
8. kcs-settercloset-pages
9. kcs-kilter-terms
10. kcs-kilter-claim
11. kcs-ownclimb
12. kcs-boardlib-pr1
13. kcs-legacy-host-observation
14. kcs-boardsesh-about
15. kcs-kilter-product-terms
16. kcs-kilter-privacy

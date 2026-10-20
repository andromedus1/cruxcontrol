---
source_handle: kcs-boardsesh-kilter-http-spec
fetched: 2026-10-19
source_url: https://github.com/boardsesh/boardsesh/blob/3340422a27c42e576207ada906c34a5c0c5ab4be/docs/KILTER_HTTP_API_SPEC.md
provenance: source-direct
substrate_confidence: source-direct
---

# Boardsesh docs/KILTER_HTTP_API_SPEC.md at commit 3340422a27c42e576207ada906c34a5c0c5ab4be (third-party reverse-engineered description of Kilter's first-party API; Android 2.10.1 versionCode 65; live checks 2026-06-02)

## Key passages
- Hosts: idp.kiltergrips.com (Keycloak realm kilter), portal.kiltergrips.com/api (REST), sync1.kiltergrips.com (PowerSync), app.kiltergrips.com/terms and /privacy (static terms/privacy pages exist).
- Auth: Keycloak Authorization Code + PKCE, client_id=kilter, scope 'openid offline_access'; Bearer JWT on every portal /api call. Doc states a password grant against /token with same client_id also works for the PowerSync stream.
- Public climb catalog is REST, not a PowerSync bucket. Climb DTO fields (camelCase): climbUuid, name, description, userUuid, username, productName, productLayoutUuid, edgeLeft/Right/Bottom/Top, frameCount, framesPace, angle, allowMatch, isDraft, isListed, accumulatedHoldSetValue, curated, isDeleted, createdAt, updatedAt, climbConcat. ClimbStat DTO: climbUuid, angle, ascentCount, currentDifficultyId, officialKilterDifficulty, difficultyAverage, qualityAverage, faUsername, faAt, curated; PK (climbUuid, angle). Doc labels the DTO 'inferred' and notes confidence HIGH only for checked per-layout reads.
- Doc disclaims: 'a client and integration guide, not an authoritative server contract'.


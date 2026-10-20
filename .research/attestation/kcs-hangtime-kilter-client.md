---
source_handle: kcs-hangtime-kilter-client
fetched: 2026-10-19
source_url: https://github.com/Stevie-Ray/hangtime-climbing-boards/blob/af537bc13f30cd30442c19036a09b8afe17d3305/api/kilter.client.ts
provenance: source-direct
substrate_confidence: source-direct
---

# hangtime-climbing-boards api/kilter.client.ts (224 lines, read in full)
- Constants: KILTER_AUTH_URL https://idp.kiltergrips.com/realms/kilter/protocol/openid-connect/token ; KILTER_SYNC_ENDPOINT https://sync1.kiltergrips.com ; client_id "kilter"; scope "openid offline_access".
- Auth: form POST grant_type=password with username/password (an authenticated account is required); token used as PowerSync credentials.
- Syncs only gyms and walls tables via @powersync/node (docstring: "Downloads Kilter gym and wall data from the app's PowerSync backend"); not climbs.
- Repo has bot commits "Latest data: <timestamp>" almost daily (2026-10-14..2026-10-19), showing the new-app endpoints are live and polled.

---
source_handle: kcs-boardlib-pr1
fetched: 2026-10-19
source_url: https://github.com/daniloaleixo/BoardLib/pull/1
provenance: source-direct
substrate_confidence: source-direct
---

# BoardLib fork PR #1: restore Kilter logbook access after the Aurora split

## Summary
Third-party description (not Kilter documentation). Claims: kilterboardapp.com fails during TLS handshake (reproduced with requests, curl, openssl) from multiple networks; Tension/Aurora/Decoy endpoints unaffected. New Kilter app uses Keycloak auth and PowerSync (read-only client in the PR) at a kiltergrips.com sync host over POST streams. Reports that "Climb UUIDs and difficulty-grade IDs remained unchanged across the split", so the old kilter.sqlite3 serves as name/grade lookup; climbs set after the split cannot be named and export as '(unknown climb <prefix>)'. This is a claim by a PR author; the endpoint is not publicly documented by Kilter and was not probed by this engagement.

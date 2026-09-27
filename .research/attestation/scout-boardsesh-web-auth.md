---
source_handle: scout-boardsesh-web-auth
fetched: 2026-09-27
source_url: https://github.com/boardsesh/boardsesh/blob/ab9a998efde3559869a6ab9884b36e804ce5f932/packages/mobile/src/lib/auth-store.web.ts
provenance: source-direct
substrate_confidence: source-direct
---

# Boardsesh browser credentials

## Anchored observations (paraphrased)

### backendToken / session synchronization / deferred credential repair comment

The Expo-web variant of the mobile package keeps its backend token in process memory
and obtains identity from authenticated session/API requests. Comments identify the HttpOnly NextAuth
cookie as the browser credential and explicitly distinguish it from SecureStore.
This demonstrates a separate web credential strategy in the source, not automatic
cookie sharing between browser and native applications. This file is not the
separate Next.js application's credential implementation.

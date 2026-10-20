---
source_handle: kcs-boardsesh-api-docs
fetched: 2026-10-19
source_url: https://boardsesh.com/docs
provenance: source-direct
substrate_confidence: summarizing-fetch (page text summarized by fetch tool, not read verbatim)
---

# Boardsesh API docs page (fetched via summarizing fetch tool; confidence: reduced-depth, page text was summarized not read verbatim)

## Summary
- REST base `/api/v1/`; capabilities listed: fetching climb data and statistics, user registration/auth, profile management, resolving URL slugs to numeric IDs. No complete endpoint listing on the page.
- REST auth: NextAuth session cookies via `/api/auth/...`. WebSocket GraphQL (graphql-ws) at `/api/graphql`; JWT from `GET /api/internal/ws-auth` passed as `authToken` connection param.
- Rate limits (quoted by fetch tool): "Authentication endpoints are rate-limited to prevent abuse. Rate limit headers are included in responses. Public read endpoints have generous limits." No numeric limits.
- Terms (quoted): "This API is for integrations. Publishing an app that uses the Boardsesh backend as its service needs written permission, which we do not currently grant." Refers to /legal.
- No Kilter-specific data-source documentation on this page.


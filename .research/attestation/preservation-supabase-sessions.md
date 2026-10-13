---
source_handle: preservation-supabase-sessions
fetched: 2026-10-09
source_url: https://supabase.com/docs/guides/auth/sessions
provenance: source-direct
substrate_confidence: source-direct
---

# Supabase sessions

## Anchored observations

**Session and refresh behavior:** Sessions last indefinitely by default. Short-lived access tokens pair with rotating refresh tokens that do not expire by default and are normally single-use, with documented reuse exceptions. Refresh exchanges them for a new pair without a new sign-in. Sign-out, security-sensitive actions and configured lifetime/inactivity rules can terminate sessions.

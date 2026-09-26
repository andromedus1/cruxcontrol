---
source_handle: shared-library-sb-smtp
fetched: 2026-09-26
source_url: https://supabase.com/docs/guides/auth/auth-smtp
provenance: source-direct
substrate_confidence: source-direct
---

# Supabase Auth — Custom SMTP

## Summary

Email-based authentication and invitations need a delivery configuration appropriate to their recipients. The default mail service is limited and explicitly unsuitable for production use.

## Anchored observations (paraphrased)

### Default SMTP service
The built-in service restricts delivery to project team addresses, has tight rate limits, and offers best-effort delivery without an SLA. Application users are not thereby members of the Supabase project team.

### Set up custom SMTP
The guide describes configuring a separate SMTP provider and sender details for production email delivery.

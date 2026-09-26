---
source_handle: shared-library-cf-otp
fetched: 2026-09-26
source_url: https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/
provenance: source-direct
substrate_confidence: source-direct
---

# Cloudflare Access — One-time PIN

## Summary

Access can email a one-time code to an address permitted by an application's policy. This provides an authentication method without connecting another identity provider.

## Anchored observations (paraphrased)

### Set up OTP
New Zero Trust organizations must configure this login method. Access policy rules must allow the intended email addresses.

### User experience
The emailed code expires after ten minutes and is single-use. An address rejected by policy receives no code, although the interface presents the same submission message.

### Allow OTP emails through your email gateway
The documented sender is noreply@notify.cloudflare.com. Access performs this code-delivery flow; this page does not require configuring a separate application SMTP sender.

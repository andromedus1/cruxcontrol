---
source_handle: shared-library-sb-config
fetched: 2026-09-26
source_url: https://supabase.com/docs/guides/auth/general-configuration
provenance: source-direct
substrate_confidence: source-direct
---

# Supabase Auth — General configuration

## Summary

Auth configuration controls whether new users may sign up and whether email sign-ins require confirmation.

## Anchored observations (paraphrased)

### Allow new users to sign up
Disabling this setting restricts sign-in to users who already exist. The page describes anonymous sign-in as a separate option, which must also be considered when configuring a closed application.

### Confirm Email
Email confirmation can be required before a user signs in. This is an authentication setting; the page does not define an application's group membership or contribution permissions.

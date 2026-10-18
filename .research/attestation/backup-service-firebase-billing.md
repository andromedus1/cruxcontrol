---
source_handle: backup-service-firebase-billing
fetched: 2026-10-10
source_url: https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
provenance: source-direct
substrate_confidence: source-direct
---

# Cloud Storage for Firebase billing requirements

## Billing requirements and troubleshooting

Cloud Storage now requires the pay-as-you-go Blaze plan, even when use falls inside no-cost allowances. Spark projects cannot access their buckets. Linking a Cloud Billing account is part of upgrading. Billing problems can prevent access.

## Changes for default buckets

New default buckets use the `PROJECT_ID.firebasestorage.app` name and Google Cloud Storage pricing. The Always Free allowance applies to eligible usage in `US-CENTRAL1`, `US-EAST1`, and `US-WEST1`. The separate legacy `appspot.com` allowances do not describe new buckets.

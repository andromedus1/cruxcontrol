---
source_handle: shared-library-cf-d1-pricing
fetched: 2026-09-26
source_url: https://developers.cloudflare.com/d1/platform/pricing/
provenance: source-direct
substrate_confidence: source-direct
---

# Cloudflare D1 — Pricing

## Summary

D1 meters rows read/written and stored data, with included free-plan quotas.

## Anchored observations (paraphrased)

### Billing metrics
The free plan includes 5 million rows read per day, 100,000 rows written per day, and 5 GB total storage. Paid storage above the included amount is USD 0.75 per GB-month. These are account-level totals, not a statement of the per-database size limit.

### Definitions and opening billing explanation
Reads count scanned rows, not just returned results; indexes can reduce scans and add write counts. D1 does not bill hours or capacity units and has no compute charge while no queries run. This statement is not an uptime SLA or a general promise that an account can never be suspended.

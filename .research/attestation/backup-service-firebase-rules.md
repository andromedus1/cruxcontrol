---
source_handle: backup-service-firebase-rules
fetched: 2026-10-10
source_url: https://firebase.google.com/docs/storage/security/core-syntax
provenance: source-direct
substrate_confidence: source-direct
---

# Cloud Storage Security Rules syntax

## Granular operations

Read access can be split into `get` and `list`; listing requires Rules Version 2. Write access can be split into `create`, `update`, and `delete`, each with separate conditions.

## Overlapping match statements; rules are not filters

If several matching rules apply, any true allow condition grants access. A narrower false condition does not override a broader true one. Rules are not filters: a client cannot ask for a broad set and expect unauthorized entries to be silently removed.

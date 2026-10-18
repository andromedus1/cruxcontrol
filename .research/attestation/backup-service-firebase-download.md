---
source_handle: backup-service-firebase-download
fetched: 2026-10-10
source_url: https://firebase.google.com/docs/storage/android/download-files
provenance: source-direct
substrate_confidence: source-direct
---

# Android Cloud Storage downloads

## Download files; download in memory

The SDK offers `getBytes()` and `getStream()` from a storage reference. `getBytes()` downloads into a byte array and accepts a maximum size; unbounded downloads can exhaust memory. File downloads are another option. The page separately documents obtaining a download URL, and identifies absent files and denied permission as possible failures.

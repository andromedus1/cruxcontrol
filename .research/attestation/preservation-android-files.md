---
source_handle: preservation-android-files
fetched: 2026-10-09
source_url: https://developer.android.com/training/data-storage/app-specific
provenance: source-direct
substrate_confidence: source-direct
---

# Android app-specific storage

## Anchored observations

**Persistent files and cache files:** Android distinguishes persistent internal app files from cache directories, which may be reclaimed under low-storage pressure. Both are app-specific and are removed on uninstall. Shared storage is appropriate for files expected to exist independently of the app.

---
source_handle: recovery-chrome-temp-dir
fetched: 2026-10-09
source_url: https://chromium.googlesource.com/chromium/src/+/4ed32028bcb2d00bc07a8880eb85aca80c9c5ec6/base/files/file_util_posix.cc
provenance: source-direct
substrate_confidence: source-direct
---

# Chromium Android temporary-directory resolution

## Summary

The Android implementation normally resolves temporary files through DIR_CACHE.

## Anchored observations

- **GetTempDir:** uses a nonempty TMPDIR environment value if present. Otherwise,
  the Android branch returns PathService::Get(DIR_CACHE, path).
- **CreateNewTempDirectory:** obtains a parent through GetTempDir, then creates a
  unique temporary directory beneath that parent.

This is default source behavior, not proof of a particular runtime environment.

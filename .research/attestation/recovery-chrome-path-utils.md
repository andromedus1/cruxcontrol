---
source_handle: recovery-chrome-path-utils
fetched: 2026-10-09
source_url: https://chromium.googlesource.com/chromium/src/+/4ed32028bcb2d00bc07a8880eb85aca80c9c5ec6/base/android/java/src/org/chromium/base/PathUtils.java
provenance: source-direct
substrate_confidence: source-direct
---

# Chromium Android private download directory resolution

## Summary

The directories called private downloads are external app-specific download folders,
not the internal cache directory.

## Anchored observations

- **getAllPrivateDownloadsDirectories:** normally calls Android
  getExternalFilesDirs(Environment.DIRECTORY_DOWNLOADS), then returns absolute paths.
- **getAllPrivateDownloadsDirectories, initial branch:** a testing override can
  substitute directories; ordinary resolution uses the Android method above.
- **setPrivateDirectoryPathInternal:** internal cache
  resolution separately uses appContext.getCacheDir().

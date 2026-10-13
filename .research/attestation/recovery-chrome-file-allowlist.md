---
source_handle: recovery-chrome-file-allowlist
fetched: 2026-10-09
source_url: https://chromium.googlesource.com/chromium/src/+/4ed32028bcb2d00bc07a8880eb85aca80c9c5ec6/chrome/browser/net/chrome_network_delegate.cc
provenance: source-direct
substrate_confidence: source-direct
---

# Chromium Android file access policy

## Summary

Android Chrome limits file-URL access to specified external-storage/download paths.

## Anchored observations

- **IsAccessAllowedAndroid:** allows descendants of Android external storage,
  GetAllPrivateDownloadsDirectories, secondary-storage download directories on newer
  Android, and /sdcard or /mnt/sdcard. The internal application cache is not listed.
- **IsAccessAllowedInternal:** Android builds delegate to this allowlist unless the
  process-global testing override is enabled.
- **EnableAccessToAllFilesForTesting:** sets that override; this file supplies no
  user-facing permission dialog or runtime setting for the override.
- **IsAccessAllowed overload:** Android checks the supplied path rather than resolved
  symlink paths, specifically to support external-storage aliases.
- **IsAccessAllowedChromeOS:** explicitly adds DIR_TEMP to its own allowlist. The
  Android function does not add DIR_TEMP; the platform policies differ.

The testing override is a qualification, not evidence it is enabled in a retail app.

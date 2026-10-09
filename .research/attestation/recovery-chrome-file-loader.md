---
source_handle: recovery-chrome-file-loader
fetched: 2026-10-09
source_url: https://chromium.googlesource.com/chromium/src/+/4ed32028bcb2d00bc07a8880eb85aca80c9c5ec6/content/browser/loader/file_url_loader_factory.cc
provenance: source-direct
substrate_confidence: source-direct
---

# Chromium restricted file URL loading

## Summary

Normal file URL loading checks file existence and then the browser's path policy.

## Anchored observations

- **FileURLLoader::Start:** failed GetFileInfo returns ERR_FILE_NOT_FOUND. Under
  restricted access, a false IsFileAccessAllowed result returns ERR_ACCESS_DENIED.
- **FileURLLoaderFactory::CreateLoaderAndStartInternal, file branch:** dispatches
  FileURLLoader::CreateAndStart with FileAccessPolicy::kRestricted.
- **CreateFileURLLoaderBypassingSecurityChecks:** a separate explicit API exists;
  this does not imply normal downloads use it.

This distinguishes missing-file and policy-denial branches in source without proving
which branch executed on a specific device.

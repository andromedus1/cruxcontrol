---
source_handle: recovery-chrome-download-loader
fetched: 2026-10-09
source_url: https://chromium.googlesource.com/chromium/src/+/4ed32028bcb2d00bc07a8880eb85aca80c9c5ec6/content/browser/download/download_manager_impl.cc
provenance: source-direct
substrate_confidence: source-direct
---

# Chromium download manager file URL selection

## Summary

Ordinary file-URL downloads use the file URL loader factory.

## Anchored observations

- **BeginResourceDownloadOnChecksComplete, loader-factory selection:** a supplied
  URL-loader factory takes priority, followed by a blob factory. Otherwise a file URL
  creates FileURLLoaderFactory using browser-context path and its shared CORS list.
- **Same branch:** Chrome UI URLs and filesystem URLs have separate factory branches.
  The source URL scheme therefore controls which transport performs a download.

This is source-level routing evidence, not a runtime log of a particular failure.

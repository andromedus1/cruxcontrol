---
source_handle: recovery-chrome-browser-client
fetched: 2026-10-09
source_url: https://chromium.googlesource.com/chromium/src/+/4ed32028bcb2d00bc07a8880eb85aca80c9c5ec6/chrome/browser/chrome_content_browser_client.cc
provenance: source-direct
substrate_confidence: source-direct
---

# Chromium browser file access delegation

## Summary

Chrome's browser implementation forwards file access decisions to its network delegate.

## Anchored observations

- **ChromeContentBrowserClient::IsFileAccessAllowed:** passes the path, absolute path
  and profile path to ChromeNetworkDelegate::IsAccessAllowed and returns its result.
- **SpecialAccessFileURLLoaderFactory:** a separate extension-specific implementation
  invokes a bypass API. Its existence is not evidence that IndexedDB diagnostic
  downloads use that implementation.

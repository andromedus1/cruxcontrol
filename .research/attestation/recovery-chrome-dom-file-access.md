---
source_handle: recovery-chrome-dom-file-access
fetched: 2026-10-09
source_url: https://chromium.googlesource.com/chromium/src/+/4ed32028bcb2d00bc07a8880eb85aca80c9c5ec6/content/browser/devtools/protocol/dom_handler.cc
provenance: source-direct
substrate_confidence: source-direct
---

# Chromium debugging file-input access

## Summary

The DOM debugging handler can grant a renderer read access to explicit file paths.

## Anchored observations

- **DOMHandler constructor:** receives an allow_file_access capability from its caller.
- **SetFileInputFiles:** rejects callers without that capability. With a frame host,
  it calls ChildProcessSecurityPolicyImpl::GrantReadFile for every supplied path,
  then falls through to renderer handling.
- **GetFileInfo:** uses the same capability gate for exposing the underlying path.

This route is distinct from the network file-URL allowlist. It still relies on browser
process permissions, client capabilities and renderer file handling.

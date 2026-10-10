---
source_handle: preservation-files
fetched: 2026-10-09
source_url: https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
provenance: source-direct
substrate_confidence: source-direct
---

# File System Access API

## Anchored observations

**Support, writing files, stored handles and permissions:** The page includes Android among supported Chromium platforms and recommends feature detection. Pickers require a secure context and user gesture. Handles can be stored in IndexedDB. The security section describes losing access when a tab closes and requesting permission again; the stored-handle section says permissions are not always retained between sessions and should be checked. Writes reach the file when the stream closes. OPFS is origin-private and distinct from selected user files.

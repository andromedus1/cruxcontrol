---
source_handle: recovery-chrome-idb-export
fetched: 2026-10-09
source_url: https://chromium.googlesource.com/chromium/src/+/4ed32028bcb2d00bc07a8880eb85aca80c9c5ec6/content/browser/indexed_db/indexed_db_internals_ui.cc
provenance: source-direct
substrate_confidence: source-direct
---

# Chromium IndexedDB internals download handler

## Summary

The internals UI requests a bucket archive, then starts a normal file-URL download.

## Anchored observations

- **DownloadBucketData:** calls ForceClose before requesting the archive from the
  IndexedDB control. This is an operational action on a live browser.
- **OnDownloadDataReady:** constructs a file URL from zip_path and creates download
  parameters for the current WebContents main frame. It does not provide a custom
  URL-loader factory or expose archive bytes to the WebUI caller.
- **OnDownloadDataReady and FileDeleter:** a download observer owns temporary-directory
  cleanup when the transfer reaches COMPLETE, CANCELLED or INTERRUPTED.
- **OnDownloadStarted:** attaches FileDeleter only after a non-null item with no
  initial interruption. Earlier failure can leave temporary files without this observer.

Anchors refer to revision 4ed32028bcb2d00bc07a8880eb85aca80c9c5ec6.

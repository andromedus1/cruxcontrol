---
source_handle: recovery-chrome-debug-drag
fetched: 2026-10-09
source_url: https://chromium.googlesource.com/chromium/src/+/4ed32028bcb2d00bc07a8880eb85aca80c9c5ec6/content/browser/devtools/protocol/input_handler.cc
provenance: source-direct
substrate_confidence: source-direct
---

# Chromium debugging file-drop dispatch

## Summary

Authorized debugging clients can dispatch drag data containing explicit native files.

## Anchored observations

- **ProtocolDragDataToDropData:** each path in the protocol files array becomes a
  native filename in DropData.
- **DispatchDragEvent:** file-related items require allow_file_access. The handler
  resolves a render widget and point before dispatch.
- **OnWidgetForDispatchDragEvent:** filters drop data and calls the widget's drag-enter,
  drag-over or drop handling. This is a separate pathway from a file chooser's
  EnumerateChosenDirectory method.

The source exposes the dispatch mechanism; usable file/directory entries still depend
on the receiver's context and permissions. It is not an acquisition guarantee.

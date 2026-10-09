---
source_handle: recovery-chrome-file-input
fetched: 2026-10-09
source_url: https://chromium.googlesource.com/chromium/src/+/4ed32028bcb2d00bc07a8880eb85aca80c9c5ec6/third_party/blink/renderer/core/html/forms/file_input_type.cc
provenance: source-direct
substrate_confidence: source-direct
---

# Chromium file-input path handling

## Summary

Explicit file paths and directory uploads take different renderer paths.

## Anchored observations

- **SetFilesFromPaths:** creates native file chooser entries for the supplied paths
  and calls FilesChosen; multiple inputs retain all supplied entries.
- **SetFilesFromPaths, webkitdirectory branch:** instead calls SetFilesFromDirectory
  on the first path.
- **SetFilesFromDirectory:** creates upload-folder chooser parameters and invokes
  EnumerateChosenDirectory. Successful explicit-file selection does not establish
  successful directory enumeration through that separate pathway.

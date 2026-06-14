---
source_handle: chrome-sqlite-opfs
fetched: 2026-06-13
source_url: https://developer.chrome.com/blog/sqlite-wasm-in-the-browser-backed-by-the-origin-private-file-system
provenance: source-direct
---

# Chrome for Developers — SQLite Wasm in the browser backed by the Origin Private File System

## Summary

Official Chrome guidance on running the SQLite team's Wasm build with OPFS-backed
persistence. The synchronous OPFS access method is usable only inside dedicated
Web Workers so the main thread isn't blocked. Because the build depends on
SharedArrayBuffer, the page must be served with Cross-Origin-Opener-Policy:
same-origin and Cross-Origin-Embedder-Policy: require-corp. The package ships on
npm as @sqlite.org/sqlite-wasm, and Wasm cannot be served from file:// URLs, so a
web server (HTTP) is required to run any such app.

## Key passages

- "The synchronous nature of this method brings performance advantages, but therefore it is only usable inside dedicated Web Workers for files within the Origin Private File System so the main thread can't be blocked."
- Required headers: "Cross-Origin-Opener-Policy set to the same-origin directive" and "Cross-Origin-Embedder-Policy set to the require-corp directive."
- "SQLite Wasm depends on SharedArrayBuffer, and setting these headers is part of its security requirements."
- "Install the @sqlite.org/sqlite-wasm package from npm."
- "Browsers will not serve Wasm files from file:// URLs, so any apps you build with this require a web server."

---
description: Read before designing epic-foundation — which framework, in-browser SQLite approach, and PWA/hosting strategy for a distributable CruxControl
type: brief
kind: research
slug: foundation-pwa-sqlite
research_method: /brief
verification_status: attested
provenance: agent-synthesis
updated: 2026-06-13
nav_priority: high
blocks_phase: epic-foundation
summary: |
  Curates the foundation-layer decisions for CruxControl as a distributable,
  offline-first PWA: the in-browser SQLite approach (wa-sqlite OPFSCoopSyncVFS in a
  Web Worker, IndexedDB fallback), the framework choice (client-only React + Vite
  SPA), and the PWA/static-hosting strategy (vite-plugin-pwa + a custom-header-capable
  static host). Key load-bearing constraint: the catalog read path runs in a Worker,
  and the chosen VFS avoids the COOP/COEP headers the official SQLite-Wasm build forces.
key_findings:
  - "sql.js is in-memory only (no persistence beyond whole-file import/export) — unsuitable as the durable catalog read path."
  - "wa-sqlite OPFSCoopSyncVFS performs well past 1GB and supports concurrent connections; it uses OPFS sync access handles directly, avoiding the SharedArrayBuffer→COOP/COEP requirement the official @sqlite.org build imposes."
  - "Any OPFS synchronous SQLite path must run inside a dedicated Web Worker; the main thread queries it via messaging."
  - "Web Bluetooth is Chromium-only (~77% global), HTTPS/secure-context + user-gesture gated — matches the SPEC's accepted browser constraint."
  - "Recommended stack: client-only React + Vite SPA, wa-sqlite (OPFSCoopSyncVFS) in a Worker, vite-plugin-pwa for offline shell + install, static deploy to a custom-header-capable host (Cloudflare Pages)."
status: draft
---

# Brief: Distributable Offline-First PWA + In-Browser SQLite (Foundation)

## Purpose

Unblocks **epic-foundation** (`[needs-brief]`). It answers the three decisions
that gate the whole project: (1) how to run the Kilter catalog as a queryable
in-browser SQLite database, (2) which web framework to build on given the app is
**distributed to friends** as a no-backend PWA, and (3) how to package and host it
offline-first. Every downstream epic reads through this foundation, so these
choices are load-bearing.

---

## 1. In-Browser SQLite: the catalog read path

The catalog (climbs, `climb_stats`, `holes`/placements — see
[data-model.md](data-model.md)) is tens of thousands of rows and is **read-heavy**:
the app queries/filters it constantly and writes to it only during sync. It must
persist across sessions and load instantly offline.

### Options

- **sql.js** — the oldest approach. It "only supports in-memory databases, and does
  not support persistence other than importing or exporting the entire database file
  at a time" `[powersync-sqlite-web]{1}`. Usable, but persistence means
  serialize-the-whole-file, and a multi-MB catalog re-imported on every load is
  wasteful. **Not** the durable read path; acceptable only as a throwaway prototype.

- **wa-sqlite + OPFSCoopSyncVFS** — *recommended.* It "uses synchronous access
  handles, but it supports multiple concurrent connections, and has file system
  transparency" and "keeps performing well even for databases over 1GB in size"
  `[powersync-sqlite-web]{1}`. Our catalog is far under that ceiling. For older
  browsers, wa-sqlite's `IDBBatchAtomicVFS` is the fallback (good for small DBs,
  "performance degrades with larger databases (100MB+)" `[powersync-sqlite-web]{1}`).

- **Official `@sqlite.org/sqlite-wasm` OPFS build** — viable but costlier to
  distribute: its OPFS path uses "the SharedArrayBuffer + Atomics workaround … to
  make the operation synchronous. This means COOP and COEP headers are required"
  `[powersync-sqlite-web]{1}`. Those headers (`Cross-Origin-Opener-Policy:
  same-origin`, `Cross-Origin-Embedder-Policy: require-corp` `[chrome-sqlite-opfs]{2}`)
  must be set by the host — which rules out hosts that can't set custom headers and
  adds cross-origin friction for any third-party resource.

### Why OPFSCoopSyncVFS for a *distributable* app

Because OPFSCoopSyncVFS uses OPFS **synchronous access handles directly** rather than
the SharedArrayBuffer+Atomics workaround, it avoids the COOP/COEP header requirement
the official build forces. That keeps hosting unconstrained (any static host works,
including ones that can't set custom headers) — a real advantage when the goal is
"a friend opens a URL and it works." It also handles our catalog size comfortably.

### Worker requirement (non-negotiable)

Synchronous OPFS access "is only usable inside dedicated Web Workers … so the main
thread can't be blocked" `[chrome-sqlite-opfs]{2}`. **The SQLite engine runs in a Web
Worker**; the UI thread issues queries over `postMessage` (a thin RPC, e.g. Comlink).
Design the data layer's port around async query calls from day one.

### Bootstrap & persistence flow

1. Ship/fetch a prebuilt `kilter.db` (produced by BoardLib, see
   [data-model.md](data-model.md)) once on first run.
2. Write it into OPFS via the Worker; subsequent loads open it from OPFS — no
   re-download, instant offline reads.
3. The sync engine (epic-catalog-sync) applies incremental updates to the OPFS DB.
4. Wasm cannot be served from `file://` — "any apps you build with this require a web
   server" `[chrome-sqlite-opfs]{2}` (a non-issue for a hosted PWA).

---

## 2. Framework: client-only SPA

**Hard constraint:** Web Bluetooth needs a client (browser) execution context and a
user gesture — there is no server-side rendering path for the board-control flow. So
the app is a **client-rendered SPA** (no SSR runtime), which also means it deploys as
pure static assets — ideal for backendless distribution.

**Recommendation: React + Vite** (with `vite-plugin-pwa`). Rationale, weighted by the
VISION's "distribution robustness" criterion:

- **Ecosystem maturity = robustness.** React has the deepest pool of working examples
  and wrappers for exactly our stack pieces — Web Bluetooth, wa-sqlite/sql.js in a
  Worker, and ONNX Runtime Web / TensorFlow.js inference. Fewer unknowns = fewer
  distribution surprises across friends' devices.
- **Static output.** Vite builds a static SPA hostable anywhere; no server runtime.
- **PWA tooling.** `vite-plugin-pwa` (Workbox under the hood) is first-class.

**Strong alternative: SvelteKit** (static adapter) — leaner output and excellent DX;
viable if you prefer it. The deciding factor is ecosystem depth for the niche pieces
(BLE + Wasm SQLite + in-browser ML), where React currently leads. Either way the
shape is the same: a static, client-only PWA. *(Final call belongs to
feature-design's architectural-options step; this brief recommends React + Vite.)*

**Not recommended:** Next.js/Nuxt SSR frameworks — the server runtime is dead weight
for a client-only, backendless app and complicates static distribution.

---

## 3. Browser support reality

Web Bluetooth is **Chromium-only**: Chrome 56+, Edge 79+, Opera 43+, Samsung Internet
6.2+; **not** Firefox or Safari/iOS (any version), ~77% global support
`[caniuse-web-bluetooth]{3}`. This matches the SPEC's accepted constraint: friends on
non-Chromium browsers can browse/share but not drive a board. It also requires a
secure context (HTTPS) and a user gesture to request a device — both satisfied by a
hosted HTTPS PWA. Plan a clear "unsupported browser" message for the board-control
surface rather than a silent failure.

---

## 4. PWA + hosting strategy

- **Tooling:** `vite-plugin-pwa` for the web app manifest (name, icons, `start_url`,
  `display: standalone`, theme/background) + a Workbox service worker.
- **Caching:** cache-first (versioned) for the app shell/static assets;
  network-first for sync API calls. **Do NOT** route the multi-MB `kilter.db` through
  the service-worker cache — it lives in OPFS (above), fetched once and persisted.
- **Install:** listen for `beforeinstallprompt` where supported; provide manual
  install instructions elsewhere. Installability + offline shell are the bar
  Lighthouse audits against.
- **Hosting:** any static HTTPS host. **Cloudflare Pages** is the recommended default
  — free, fast, and supports custom headers (so the option to switch to the official
  SQLite-Wasm build later, with its COOP/COEP needs, stays open). Netlify/Vercel
  static are equivalent. Plain GitHub Pages works for the wa-sqlite path but cannot
  set custom headers, so it would foreclose the official-build option.

---

## Implementation Notes

- **Data-layer port:** define an async query interface (`query(sql, params)` →
  rows) backed by the Worker. Everything above it (browser, renderer, sync) depends
  on the port, never on wa-sqlite directly — keeps the VFS swappable and the app
  testable without OPFS.
- **Worker + RPC:** SQLite in a dedicated Worker; Comlink (or a hand-rolled
  postMessage protocol) for the main-thread RPC. Budget for async everywhere in the
  read path.
- **Catalog bootstrap is a one-time cost:** download `kilter.db` once → OPFS. Show
  a first-run loading state; thereafter loads are instant and offline.
- **VFS fallback:** detect OPFS sync-access-handle support; fall back to
  `IDBBatchAtomicVFS` on older browsers (with degraded large-DB perf).
- **Deploy = static build + CI:** `vite build` → static host. epic-foundation should
  include a CI/deploy story (the project currently has no remote/CI). HTTPS is
  required for both service workers and Web Bluetooth.
- **Headers:** the wa-sqlite OPFSCoopSyncVFS path needs no special headers; if you
  ever move to the official build, set COOP `same-origin` + COEP `require-corp`
  `[chrome-sqlite-opfs]{2}` and verify Web Bluetooth + third-party assets still load.

---

## Sources

1. PowerSync — *The Current State of SQLite Persistence on the Web* (May 2026 update). `[powersync-sqlite-web]{1}` — https://powersync.com/blog/sqlite-persistence-on-the-web
2. Chrome for Developers — *SQLite Wasm in the browser backed by the Origin Private File System*. `[chrome-sqlite-opfs]{2}` — https://developer.chrome.com/blog/sqlite-wasm-in-the-browser-backed-by-the-origin-private-file-system
3. caniuse.com — *Web Bluetooth* support table. `[caniuse-web-bluetooth]{3}` — https://caniuse.com/web-bluetooth
4. MDN — *Web Bluetooth API* — https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API
5. vite-plugin-pwa documentation — https://vite-pwa-org.netlify.app/

---
id: epic-foundation-sqlite-readpath
kind: feature
stage: review
tags: [data]
parent: epic-foundation
depends_on: [epic-foundation-scaffold]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-14
---

# In-Browser SQLite Read Path (wa-sqlite Worker)

## Brief

Implement the catalog read path: wa-sqlite running on `OPFSCoopSyncVFS` inside a dedicated
Web Worker, with the main thread issuing async queries over a thin RPC (Comlink or
hand-rolled postMessage). This is the trickiest, most load-bearing feature in the epic —
everything that reads climbs/holds/stats goes through it.

Covers: the Worker host for wa-sqlite, OPFS sync-access-handle setup, the data-layer port
implementation (`query(sql, params)` → rows) from the scaffold's interface, OPFS
support-detection with an `IDBBatchAtomicVFS` fallback for older browsers, and tests
against a small fixture DB. Does NOT cover fetching the real catalog (catalog-bootstrap) or
any UI.

## Epic context
- Parent epic: `epic-foundation`
- Position: critical-path feature — catalog-bootstrap depends on it; sibling epics' read
  paths all sit on top of this port.

## Inherited design decisions
- wa-sqlite `OPFSCoopSyncVFS` in a Web Worker (avoids the COOP/COEP headers the official
  build forces); `IDBBatchAtomicVFS` fallback on older browsers.
- SQLite runs in a Worker; UI thread is async-only against the port.

## Research briefs
- [foundation-pwa-sqlite.md](../../../docs/briefs/foundation-pwa-sqlite.md) — §1 (in-browser SQLite), Implementation Notes (port, Worker+RPC, VFS fallback).
- [data-model.md](../../../docs/briefs/data-model.md) — catalog schema the queries target.

## Foundation references
- `docs/ARCHITECTURE.md` — Module Map §1 (Data Layer); Conventions (single source of truth).

## Design decisions

Resolved with the user during feature-design (2026-06-14):

1. **Worker RPC = Comlink.** Wrap the Worker as an async object instead of a
   hand-rolled `postMessage` protocol. Removes message-correlation and
   error-propagation bug surface for a one-runtime-dependency cost (~3KB). The
   `CatalogPort` surface is tiny (`query`/`isReady`/`close`), so the ergonomic win
   is cheap.
2. **CI test path = real wa-sqlite in Node against an in-memory VFS, seeded from a
   committed fixture.** OPFS does not exist in Node/jsdom, so the OPFS *persistence*
   layer is verified manually / by a later e2e pass. CI exercises the real SQL
   engine + the adapter's row-mapping + error paths by running wa-sqlite with
   `MemoryAsyncVFS` over a small Kilter-subset fixture. This is what keeps the
   keystone SQL path honest in CI.
3. **IDB fallback deferred.** This feature ships the OPFS path + capability
   detection + a graceful "unsupported environment" failure. The
   `IDBBatchAtomicVFS` fallback is split into its own follow-up feature
   (`epic-foundation-sqlite-idb-fallback`, `depends_on` this one) because board
   control already requires Chromium (Web Bluetooth) where OPFS sync-access-handles
   are universal; the fallback only serves browse-only Safari/Firefox, which no
   product surface consumes yet. Re-scope into a release when browse-on-Safari is
   prioritized.

## Architectural choice

**Chosen: a Worker-agnostic SQLite engine module, hosted in a dedicated Web Worker,
exposed to the main thread via Comlink, behind the existing `CatalogPort`.**

Options weighed (Phase 5a):

- **A — Engine module + Worker host + Comlink (chosen).** The SQLite logic lives in
  a pure, Worker-free module (`catalog-db.ts`) that takes an injected VFS. The
  browser Worker constructs it with `OPFSCoopSyncVFS`; Node tests construct the same
  module with `MemoryAsyncVFS`. The main-thread adapter (`SqliteCatalogPort`) spawns
  the Worker, `wrap`s it with Comlink, and satisfies `CatalogPort`. Wins because it
  makes the keystone SQL path testable in CI *without* a Worker or OPFS (decision 2),
  and keeps the VFS swappable (decision 3's fallback drops in as another VFS).
- **B — Monolithic Worker (SQLite + OPFS + RPC in one file).** Simpler file count,
  but the engine can only run inside a Worker with OPFS — untestable in Node, which
  fails decision 2. Rejected.
- **C — SQLite on the main thread (async VFS, no Worker).** Rejected outright:
  `OPFSCoopSyncVFS` uses synchronous access handles that are *only* callable inside a
  dedicated Worker (brief §1, "Worker requirement (non-negotiable)"). Main-thread
  OPFS-sync is impossible.

The split in (A) is the Ports-&-Adapters + SSOT conventions applied at the data
edge: everything above depends on `CatalogPort`, never on wa-sqlite; the VFS is the
single swappable seam.

## Implementation Units

### Unit 1: SQLite engine (Worker-agnostic) — *trickiest, build first*

**File**: `web/src/data/sqlite/catalog-db.ts`

```typescript
import type { Row, SqlValue } from '../port.ts';

/** A wa-sqlite VFS instance + the name to register/open it under. */
export interface VfsBinding {
  vfs: SQLiteVFS;        // from wa-sqlite
  name: string;          // VFS name passed to sqlite3_open_v2
}

/** Opens a wa-sqlite connection over an injected VFS and runs read queries.
 *  Knows nothing about Workers, OPFS, or Comlink — that is the host's job. */
export class CatalogDb {
  static async open(dbFilename: string, binding: VfsBinding): Promise<CatalogDb>;

  /** Execute a read-only statement; map result columns → Row objects. */
  query<T extends Row = Row>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;

  isReady(): boolean;     // true once the connection is open
  close(): Promise<void>;
}
```

**Implementation Notes**:
- Uses the **async** wa-sqlite build (`wa-sqlite/dist/wa-sqlite-async.mjs` →
  `SQLite.Factory`). OPFSCoopSyncVFS and MemoryAsyncVFS both register against the
  async build — this build/VFS pairing is the **riskiest assumption** (see Risks);
  validate it in the Node test before building Units 2-4.
- Bind params positionally (`sqlite3_bind_*`); iterate rows with
  `sqlite3_step`/`sqlite3_column_*`, keying each `Row` by `sqlite3_column_name`.
  Map SQLite column types → `SqlValue` (TEXT→string, INTEGER/REAL→number,
  NULL→null, BLOB→Uint8Array).
- Read-only: open with `SQLITE_OPEN_READONLY` in the browser host. The Node test
  opens read-write to seed the fixture, then queries — so `open` takes flags.
- On a SQLite error, throw a `CatalogQueryError` (Unit 5 type) carrying the failing
  `sql` for debuggability; finalize the statement in a `finally`.

**Acceptance Criteria**:
- [ ] `CatalogDb.open` returns a ready instance over a `MemoryAsyncVFS` binding.
- [ ] `query('SELECT uuid, angle FROM climb_stats WHERE angle = ?', [40])` returns
      the seeded rows as `Row[]` with correct value types.
- [ ] A query against a non-existent table throws `CatalogQueryError` whose message
      includes the offending SQL.
- [ ] `close()` flips `isReady()` to `false` and finalizes the connection.

---

### Unit 2: Worker host

**File**: `web/src/data/sqlite/catalog.worker.ts`

```typescript
import { expose } from 'comlink';
// constructs OPFSCoopSyncVFS, opens CatalogDb, exposes a CatalogDbApi
export interface CatalogDbApi {
  query<T extends Row = Row>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  isReady(): Promise<boolean>;
  close(): Promise<void>;
}
```

**Implementation Notes**:
- Instantiate the wa-sqlite async module, build `OPFSCoopSyncVFS` (registered name
  e.g. `"opfs-coop"`), `CatalogDb.open(CATALOG_DB_FILENAME, {vfs, name})` with
  `SQLITE_OPEN_READONLY`, then `expose({query, isReady, close})`.
- `CATALOG_DB_FILENAME` is shared with catalog-bootstrap — define once in
  `web/src/data/sqlite/catalog-config.ts` and import in both.
- Opening a not-yet-bootstrapped DB: a missing file under READONLY surfaces as an
  open error; `isReady()` resolves `false` rather than throwing, so the UI can show
  "catalog not loaded" until catalog-bootstrap runs. (Whether rows *exist* is
  bootstrap's concern, not this feature's.)

**Acceptance Criteria**:
- [ ] Worker module builds under Vite (`new Worker(new URL(...), {type:'module'})`).
- [ ] `expose`d API method names match `CatalogDbApi` exactly.

---

### Unit 3: OPFS capability detection

**File**: `web/src/data/sqlite/opfs-support.ts`

```typescript
/** True only when the environment can run OPFSCoopSyncVFS:
 *  navigator.storage.getDirectory + FileSystemFileHandle.createSyncAccessHandle. */
export function isOpfsSyncAccessSupported(): boolean;
```

**Implementation Notes**:
- Feature-detect presence of `navigator.storage?.getDirectory` and
  `FileSystemFileHandle.prototype.createSyncAccessHandle` (the latter is only
  *callable* in a Worker, but its presence on the prototype is detectable from the
  main thread — that is sufficient for a pre-flight gate).
- Pure, synchronous, no side effects → trivially unit-testable.

**Acceptance Criteria**:
- [ ] Returns `false` in jsdom (no OPFS) — proven by a unit test.
- [ ] Returns `true` when both globals are stubbed present.

---

### Unit 4: Main-thread port adapter

**File**: `web/src/data/sqlite/sqlite-catalog-port.ts`

```typescript
import { wrap } from 'comlink';
import type { CatalogPort, Row, SqlValue } from '../port.ts';

export class UnsupportedEnvironmentError extends Error {}

/** CatalogPort backed by wa-sqlite in a Worker. Spawns the Worker lazily,
 *  Comlink-wraps it, and delegates query/isReady/close. */
export class SqliteCatalogPort implements CatalogPort {
  static create(): SqliteCatalogPort;   // throws UnsupportedEnvironmentError if !isOpfsSyncAccessSupported()
  query<T extends Row = Row>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  isReady(): Promise<boolean>;
  close(): Promise<void>;
}
```

**Implementation Notes**:
- `create()` calls `isOpfsSyncAccessSupported()` first and throws
  `UnsupportedEnvironmentError` (clear, user-facing message) when false — Fail Fast,
  so the app shell can render an "use a Chromium browser" state instead of a cryptic
  Worker crash. This is the seam where the deferred IDB fallback will later branch
  instead of throwing.
- Spawn `new Worker(new URL('./catalog.worker.ts', import.meta.url), {type:'module'})`,
  `wrap<CatalogDbApi>(worker)`; delegate the three methods. `close()` also
  `terminate()`s the Worker (satisfies the port's "release resources" contract).
- Comlink rehydrates errors thrown in the Worker; re-wrap into `CatalogQueryError`
  at the boundary if the engine type is lost across the wire.

**Acceptance Criteria**:
- [ ] `create()` throws `UnsupportedEnvironmentError` in jsdom.
- [ ] With a faked Comlink endpoint, `query` delegates args verbatim and returns the
      worker's rows.
- [ ] `close()` calls `worker.terminate()` and resolves.

---

### Unit 5: Errors + test fixture

**Files**: `web/src/data/sqlite/errors.ts`, `web/src/data/sqlite/__fixtures__/catalog-fixture.sql`

```typescript
export class CatalogQueryError extends Error {
  constructor(message: string, readonly sql: string, options?: ErrorOptions);
}
```

**Implementation Notes**:
- `catalog-fixture.sql` is a small, diffable Kilter-subset seed: `climbs`,
  `climb_stats`, `difficulty_grades` with a handful of rows mirroring the real schema
  (see `docs/briefs/data-model.md`). Node tests load it into `MemoryAsyncVFS` via
  `CatalogDb` opened read-write. (A committed binary `.db` is the alternative; the SQL
  seed is preferred for diffability — note for reviewers.)

**Acceptance Criteria**:
- [ ] `CatalogQueryError` carries `.sql` and chains the cause.
- [ ] Fixture seeds without error and the schema columns match data-model.md.

---

## Implementation Order

1. **Unit 5 errors + fixture** — needed by everything's tests.
2. **Unit 1 `catalog-db.ts`** — the engine; its Node test validates the riskiest
   assumption (wa-sqlite async-build ↔ VFS pairing) before more is built on it.
3. **Unit 3 `opfs-support.ts`** — standalone, cheap.
4. **Unit 2 `catalog.worker.ts`** — wraps Unit 1 with OPFS + Comlink.
5. **Unit 4 `sqlite-catalog-port.ts`** — wires Units 2+3 into `CatalogPort`.

## Testing

### Unit tests
- `web/src/data/sqlite/catalog-db.test.ts` (Node/vitest) — opens `CatalogDb` over
  `MemoryAsyncVFS`, seeds `catalog-fixture.sql`, asserts real query results, value
  typing, and `CatalogQueryError` on bad SQL. **This is the keystone test** — real
  SQL in CI.
- `web/src/data/sqlite/opfs-support.test.ts` — false in jsdom; true with stubbed globals.
- `web/src/data/sqlite/sqlite-catalog-port.test.ts` — `create()` throws in jsdom;
  delegation verified against a faked Comlink endpoint (no real Worker in jsdom).

### Integration points
- **Port contract**: `SqliteCatalogPort` and the existing `MockCatalogPort` both
  satisfy `CatalogPort` — downstream consumers depend only on the interface.
- **OPFS persistence + real Worker**: explicitly out of CI scope (decision 2);
  verified manually in a browser now, by e2e later, and exercised for real by
  catalog-bootstrap.

## Risks

- **wa-sqlite build ↔ VFS pairing** (riskiest): the exact async-build import path and
  that `OPFSCoopSyncVFS` / `MemoryAsyncVFS` register cleanly against it are assumed
  from the brief, not yet run in this repo. **Mitigation/fallback**: Unit 1's Node
  test is the spike — if `MemoryAsyncVFS` can't pair with the async build, fall back
  to wa-sqlite's sync build + `MemoryVFS` for tests and re-confirm OPFSCoopSyncVFS's
  build requirement. Resolve before Units 2-4.
- **Vite Worker + Comlink bundling**: `new URL(...import.meta.url)` Worker spawning
  with `{type:'module'}` must survive `vite build`, not just dev. **Fallback**: if
  module workers misbundle, switch the worker to a classic build target via Vite's
  worker config.
- **Comlink error fidelity**: custom error subclasses may degrade to plain `Error`
  across the Comlink boundary. **Fallback**: re-wrap into `CatalogQueryError` at the
  main-thread adapter using the message string.

## Implementation notes

Implemented 2026-06-14 on `feat/sqlite-readpath`. All five units built; full
verification (typecheck / lint / test / build) green; 20 tests pass (16 new).

### Spike result — the riskiest assumption did NOT hold as written, but the path is sound

The design assumed the **async** wa-sqlite build (`wa-sqlite-async.mjs`) paired
with `OPFSCoopSyncVFS` (browser) and `MemoryAsyncVFS` (Node tests). At
wa-sqlite **v1.0.0** the API and VFS lineup differ from the older examples the
brief referenced:

- **There is no `OPFSCoopSyncVFS`.** The current OPFS sync-access-handle VFS is
  **`AccessHandlePoolVFS`** (`wa-sqlite/src/examples/AccessHandlePoolVFS.js`),
  which explicitly targets the **synchronous** build and uses
  `FileSystemSyncAccessHandle` (exactly what `isOpfsSyncAccessSupported` probes).
- Because `AccessHandlePoolVFS` is sync-build, I standardized on the **sync
  build** (`wa-sqlite/dist/wa-sqlite.mjs` → `SQLite.Factory`) for *both* runtimes
  and paired the Node test with **`MemoryVFS`** (sync), not `MemoryAsyncVFS`.
  Using one build for both keeps the engine identical across browser and CI. The
  wrapper API (`open_v2`/`prepare`/`step`/…) is Promise-returning regardless of
  build, so `CatalogDb` is async either way.
- **Node WASM loading**: the Emscripten loader tries to `fetch()` the `.wasm`,
  which fails over a `file://` URL in Node. Fixed by injecting the wasm bytes via
  a new `configureSqliteWasm(bytes)` hook (`catalog-db.ts`); the test reads the
  bytes with `createRequire(...).resolve('wa-sqlite/dist/wa-sqlite.wasm')`
  (`import.meta.resolve` is unavailable under Vite's SSR transform). In the
  browser, Vite serves the `.wasm` and the default loader resolves it.

The keystone spike (real wa-sqlite + `MemoryVFS` + fixture, real SELECTs incl.
params/JOIN/NULL/typed values/BLOB) is **green in CI**, so the engine is proven
even though the exact build/VFS names changed.

### Actual wa-sqlite v1.0.0 API used

- Module: `import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite.mjs'` (sync
  build), `import * as SQLite from 'wa-sqlite'` → `SQLite.Factory(module)`.
- Query path: `sqlite3.statements(db, sql)` (async iterable of stmt ptrs, which
  auto-finalizes per iteration) → `bind_collection(stmt, params)` →
  `column_names` → `step` (=== `SQLITE_ROW`) → `column(stmt, i)` switched on
  `column_type` (NULL→null, INTEGER/FLOAT→number with BigInt narrowed, TEXT→
  string, BLOB→copied Uint8Array). `vfs_register(vfs, false)` + `open_v2(file,
  flags, vfs.name)` + `close(db)`.
- VFS naming: the VFS dictates its own name (`MemoryVFS.name === 'memory'`,
  `AccessHandlePoolVFS.name === 'AccessHandlePool'` — a fixed getter, not
  settable), so `VfsBinding.name` is set from `vfs.name`. `vfs_register` throws
  on a duplicate name, so `CatalogDb` guards with a per-API `WeakMap` of
  registered names (`registerVfsOnce`).

### Files

- `errors.ts` — `CatalogQueryError` (carries `.sql`, chains cause).
- `catalog-config.ts` — `CATALOG_DB_FILENAME` (shared with catalog-bootstrap).
  (Dropped the planned `OPFS_VFS_NAME` const: the VFS supplies its own name.)
- `catalog-db.ts` — the Worker-agnostic engine (Unit 1) + `configureSqliteWasm`.
- `catalog-db-api.ts` — the `CatalogDbApi` Comlink surface, split out so the
  main-thread port imports the *type* without pulling Worker code into the bundle.
- `opfs-support.ts` — `isOpfsSyncAccessSupported()`.
- `catalog.worker.ts` — Worker host: `AccessHandlePoolVFS` + `CatalogDb` READONLY
  + Comlink `expose`. Missing/un-bootstrapped DB → `null` connection →
  `isReady()` false (no throw).
- `sqlite-catalog-port.ts` — `SqliteCatalogPort` + `UnsupportedEnvironmentError`.
  `create()` takes an optional `WorkerFactory` (defaults to the Vite module
  Worker) for testability; re-wraps lost errors into `CatalogQueryError`.
- `wa-sqlite-vfs.d.ts` — ambient types for the untyped `AccessHandlePoolVFS.js`.
- `__fixtures__/catalog-fixture.sql` — Kilter-subset seed (climbs / climb_stats /
  difficulty_grades, mirroring data-model.md).

### Tested in CI vs deferred

- **In CI**: keystone `catalog-db.test.ts` (real SQL engine, row mapping, value
  typing, NULL, JOIN, `CatalogQueryError`, close semantics — 7 tests);
  `opfs-support.test.ts` (false in jsdom, true when both globals stubbed — 4);
  `sqlite-catalog-port.test.ts` (`create()` fail-fast gate + delegation/
  termination via a real Comlink endpoint over a `MessageChannel` fake Worker —
  5).
- **Deferred (cannot run in jsdom/Node — decision 2)**: real OPFS persistence,
  the real module Worker, and `AccessHandlePoolVFS`. Verified manually in a
  browser / by a later e2e pass and exercised for real by catalog-bootstrap.
  Marked explicitly with comments in `catalog.worker.ts` and the port test.

### Vite config change (required, minimal)

Set `worker: { format: 'es' }` in `web/vite.config.ts`. The catalog Worker
dynamically imports the wa-sqlite WASM glue, which makes the worker bundle
code-split; Vite's default `worker.format: 'iife'` cannot code-split and
`vite build` **fails** without this. Verified via a throwaway entry that the
build emits `catalog.worker-*.js`, the `wa-sqlite-*.js` glue chunk, and the
hashed `wa-sqlite-*.wasm` asset (no `optimizeDeps.exclude` needed). Also added
`@types/node` (devDep) + `"node"` to `tsconfig` `types` for the Node test's
`node:` imports.

---
description: Historical — the legacy Aurora Kilter sync protocol as BoardLib implemented it; read the current Kilter catalog sources brief instead
type: brief
kind: historical
slug: catalog-sync-api
research_method: /brief
verification_status: attested
provenance: agent-synthesis
updated: 2026-06-13
summary: |
  Captures the legacy Aurora sync path as of 2026-06-13; not refreshed for the
  2026-03 Kilter/Aurora split.
  Curates the Kilter catalog-sync layer: BoardLib is the canonical reference
  implementation (download SQLite, then sync via the API; shared/public data only by
  default, user data requires credentials). Establishes the boundary between the
  one-time bootstrap (foundation) and incremental sync, and flags that the precise
  request/response shapes, shared_syncs cursor mechanics, and auth/publish endpoints
  must be read out of BoardLib's source — they are not in any official doc.
status: superseded
superseded_by: .research/analysis/campaigns/kilter-current-catalog-sources/parent.md
supersession_note: |
  Superseded 2026-10-19 by the current Kilter catalog sources brief; the legacy
  /sync endpoint no longer serves Kilter.
---

# Brief: Catalog Sync & the Kilter API (Sync Engine)

> **Superseded (2026-10-19).** The legacy Aurora sync described here no longer serves
> Kilter. Read [current Kilter catalog sources](../../.research/analysis/campaigns/kilter-current-catalog-sources/parent.md)
> instead; this brief is retained as the historical record.

## Purpose

Unblocks **epic-catalog-sync** (`[needs-brief]`). [data-model.md](data-model.md)
describes the catalog schema and names the sync endpoint
(`POST kilterboardapp.com/sync`) and `shared_syncs` mechanism at a high level. This
brief curates the *implementation* reality: what BoardLib actually does, the
shared-vs-user data boundary, and where the undocumented details live. It also
unblocks the publish path (route-creation) and optional ascent sync (logbook).

---

## 1. BoardLib is the reference implementation

There is no official Kilter sync-API specification. **BoardLib**
(`lemeryfertitta/BoardLib`, Python) is the de-facto reference. Its database command:

```
boardlib database <board_name> <database_path> --username <board_username>
```

"This command will first download a sqlite database file to the given path. After
downloading, the database will then use the sync API to synchronize it with the
latest available data" `[boardlib]{1}`. If the DB already exists, "the command will
skip the download step and only perform the synchronization" `[boardlib]{1}` — i.e.
incremental sync is the steady state, full download is one-time.

**Read BoardLib's source** for the exact endpoint paths, request/response JSON
shapes, and how it tracks `shared_syncs` timestamps. These are the load-bearing
details the implementation needs and they exist only in code, not docs.

## 2. The shared-vs-user data boundary (auth)

"The database will only contain the 'shared,' public data. User data is not
synchronized" `[boardlib]{1}` by default. The full catalog (climbs, `climb_stats`,
holds/placements) is shared/public and syncs without auth. **Personal data**
(ascents, bids — see [data-model.md](data-model.md)) and **publishing** a new climb
require authentication (a logged-in session/token tied to a Kilter account).

So the sync engine has two tiers:
- **Public catalog sync** — no auth; keeps the local DB fresh. Needed by everything.
- **Authenticated operations** — login → token; needed for ascent sync
  (epic-logbook) and climb publishing (epic-route-creation). Read BoardLib for the
  login flow and how the token is attached.

## 3. Architecture fit

- Bootstrap (one-time full download) belongs to **epic-foundation**; this epic owns
  **incremental** sync thereafter, reconciling new/changed rows into the OPFS SQLite
  DB (foundation brief).
- All Kilter network I/O sits behind a **SyncPort** adapter (ARCHITECTURE: ports &
  adapters); the rest of the app never calls the API directly. Mock it for tests.
- The API is undocumented and may drift (ARCHITECTURE risk) — isolate it so drift is
  a one-adapter fix, and pin BoardLib's behavior as the contract.

---

## Implementation Notes

- **Read BoardLib first.** Before designing requests, read its sync module for: the
  base URL/endpoints, auth/login request, the sync request body (what cursor/
  `shared_syncs` fields it sends), and the response shape (tables/rows returned).
  Treat that as the spec.
- **Incremental reconciliation.** Apply synced rows into the existing OPFS DB
  (upsert by primary key); don't re-download. Track the last sync cursor locally.
- **Auth is optional and lazy.** Public catalog sync works anonymously. Prompt for
  Kilter credentials only when the user wants ascent sync or to publish — and store
  the token in browser-local storage (per-user isolation, data-ownership principle).
- **Reproducible pipeline.** Sync must re-run safely as the catalog grows (SPEC
  non-functional requirement) — idempotent upserts, resumable cursor.
- **Cross-reference:** [data-model.md](data-model.md) owns the schema, frames
  encoding, and the high-level `POST /sync` / `shared_syncs` description.

---

## Sources

1. lemeryfertitta/BoardLib — utilities for climbing board APIs. `[boardlib]{1}` — https://github.com/lemeryfertitta/BoardLib
2. (cross-ref) [data-model.md](data-model.md) — schema, frames encoding, sync endpoint + shared_syncs overview.

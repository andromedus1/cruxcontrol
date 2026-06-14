---
id: epic-catalog-sync
kind: epic
stage: drafting
tags: [data, needs-brief]
parent: null
depends_on: [epic-foundation]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
---

# Catalog Sync: Incremental Updates from the Kilter API

## Brief

Keeps the local catalog fresh after the one-time BoardLib bootstrap. This epic owns
the sync engine: the `POST kilterboardapp.com/sync` protocol, incremental updates
driven by `shared_syncs` timestamps, and (optionally) the authenticated paths needed
for personal data and publishing. It is the only module that performs network I/O
against the Kilter API.

When done, the local catalog can be brought up to date incrementally without a full
re-download, and the authenticated surface needed by route-publishing and logbook-sync
exists. It does NOT own how that data is browsed, edited, or logged.

## Research briefs

- `docs/briefs/data-model.md` — describes the sync API at a high level
  (`POST /sync`, `shared_syncs`) and names BoardLib as the reference implementation.
- **[needs-brief]** — *Kilter sync protocol & auth.* The exact request/response
  shapes, the incremental cursor mechanics, pagination/conflict handling, and the
  **authentication flow** (login token, what's needed to read ascents/bids and to
  publish climbs) are thin and undocumented officially. The API may drift. **BoardLib**
  is the canonical reference to read. Run `/research-pipeline:brief` before
  `/epic-design`. Note: this brief also unblocks the publish path in
  epic-route-creation and the optional sync in epic-logbook.

## Foundation references

- `docs/ARCHITECTURE.md` — Module Map §2 (Sync Engine); Biggest Risks (Sync API
  drift / auth); Conventions (ports & adapters at the network edge).
- `docs/SPEC.md` — Capability 6 (Data Acquisition, incremental sync); Constraints
  (data ownership, reproducible pipelines).

## Anticipated child features

Provisional:
- Sync client (POST /sync + shared_syncs cursor) behind a mockable port
- Incremental catalog reconciliation into the local SQLite DB
- Auth flow (token acquisition; gates personal-data + publish features)

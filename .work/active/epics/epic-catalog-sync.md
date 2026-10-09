---
id: epic-catalog-sync
kind: epic
stage: drafting
tags: [data]
parent: null
depends_on: [epic-universal-board-platform]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-10-09
research_refs:
  - docs/briefs/data-model.md
  - docs/briefs/catalog-sync-api.md
  - .research/analysis/landscapes/climbing-board-ecosystem.md
---

# Catalog Sync: Verified Kilter Sources and Catalog Updates

## Brief

Owns verified acquisition and updates after the initial older-library bootstrap.
Andrew accepted the explicitly labeled older snapshot first on 2026-10-09 and wants
current official-app climbs next. The retained BoardLib / `POST /sync` research
describes the legacy Aurora path; it does not establish current first-party Kilter
coverage. Refresh source, protocol, coverage, and intended-use evidence before
selecting the current acquisition adapter or claiming incremental freshness.

The eventual adapter should preserve provider-native identities and provenance and
replace or update the local catalog without risking the personal library. Whether
current access supports incremental reads, requires full snapshots, or needs an
authorized account is unresolved. Personal-data and publishing authentication are
separate evidence questions. This epic does not own browsing, editing, or logging.

## Research briefs

- `docs/briefs/data-model.md` — describes the sync API at a high level
  (`POST /sync`, `shared_syncs`) and names BoardLib as the reference implementation.
- **[brief written]** [catalog-sync-api.md](../../../docs/briefs/catalog-sync-api.md)
  — *Kilter sync protocol & auth.* The exact request/response
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

Provisional, pending refreshed source evidence:
- Current-source acquisition and coverage verification
- Source-specific client behind a mockable port; legacy sync is one candidate
- Safe catalog replacement or incremental reconciliation, according to that source
- Authorized account flow where required, separately covering personal data/publishing

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
updated: 2026-10-19
research_refs:
  - docs/briefs/data-model.md
  - .research/analysis/campaigns/kilter-current-catalog-sources/parent.md
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

## Current-source research (2026-10-19)

The [current Kilter catalog sources](../../../.research/analysis/campaigns/kilter-current-catalog-sources/parent.md)
brief supersedes `docs/briefs/catalog-sync-api.md` and unblocks epic design. Findings that
shape this epic:

- The legacy Aurora `/sync` path (BoardLib) no longer serves Kilter; Kilter's new app has no
  public API or bulk export, and its terms prohibit scraping and reverse engineering.
- Boardsesh publishes anonymous per-layout SQLite snapshots fed from Kilter's new backend.
  For Homewall 7x10 (layout 8, size 17) its hardware rows match ours exactly and legacy
  climb UUIDs carry over; 13,347 listed climbs are 7x10-lightable versus the 11,102 in our
  current bundled snapshot, including 1,149 dated after the split.
- An adapter must normalize role codes 12–15 → 42–45 by name, accept dashed and 32-hex
  UUIDs case-insensitively, consult aliases, treat `is_listed=0` as removal, diff snapshots
  to detect other removals, and stop reusing three-star rating thresholds.
- Boardsesh invites snapshot use but requires written permission for a publicly
  distributed app that uses its data or servers as its service. Andrew accepted Boardsesh
  as the recurring upstream on 2026-10-19; the re-host versus direct-fetch choice is open.
- The personal library (authored climbs, playlists, backups) stays outside the catalog
  store and must be unaffected by any catalog update, including playlist references to
  catalog climbs later unlisted or aliased.

### Operator decisions (2026-10-19)

- **Re-host.** A scheduled job fetches the Boardsesh Homewall snapshot and publishes
  CruxControl's own normalized 7x10 catalog artifact (with its own hash) to a
  CruxControl-controlled host; the app never fetches from Boardsesh directly. Cadence may
  be slower than daily (for example weekly); freshness is not time-critical.
- **Climb identities are append-only.** Every climb UUID ever published stays in the
  catalog. Upstream removal, unlisting, exclusion or alias folding marks a climb as removed
  upstream (hidden from browsing by default) rather than deleting it, so playlist
  references keep resolving.
- **Fail closed on suspicious upstream data.** The job publishes nothing and keeps the
  last-known-good artifact when the manifest or artifact is missing, the schema or format
  version changes, any 7x10 hardware row changes, the listed-climb count drops beyond a
  threshold, or newly removed climbs exceed a cap. Thresholds are a design choice for this
  epic. Previous artifacts are retained for rollback.
- **Device installs stay atomic.** The installed catalog is replaced only after the new
  artifact passes integrity checks; the personal library is never touched.

The engagement record (dials, decomposition, gate outcomes) lives with the campaign:
`dispatch.md`, `verification-checklist.md`, `campaign-evaluation.md`, `acquisitions.md`.

## Research briefs

- `docs/briefs/data-model.md` — describes the sync API at a high level
  (`POST /sync`, `shared_syncs`) and names BoardLib as the reference implementation.
- **[superseded 2026-10-19]** [catalog-sync-api.md](../../../docs/briefs/catalog-sync-api.md)
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

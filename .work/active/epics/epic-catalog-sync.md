---
id: epic-catalog-sync
kind: epic
stage: done
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
  upstream (still visible, with a badge) rather than deleting it, so playlist
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

## Design decisions

- **Upstream source**: Boardsesh public snapshots, consumed by CruxControl's own build —
  operator decision 2026-10-19 after reviewing the terms tension.
- **Distribution**: re-host privately behind the existing Firebase sign-in (Android
  first); no public catalog URL — avoids public redistribution of Kilter-derived data.
- **Publish gate**: auto-publish when every guard passes; a tripped guard publishes
  nothing and opens a GitHub issue with the diff report.
- **Device update**: periodic check while signed in, summary prompt, explicit tap to
  install; the current catalog stays until the new one verifies.
- **Removed-upstream climbs**: kept forever, visible in browse and playlists with a
  "removed upstream" badge.
- **Cadence**: weekly by default and configurable; never more than one Boardsesh fetch
  per artifact per day.

## Decomposition

Split by capability along the data path: one deterministic transformation defines the
artifact contract; reconciliation and guards own the append-only and fail-closed
policy; publishing owns schedule, private storage and the authenticated endpoint; the
app side splits into installing new versions (Android, signed-in) and presenting the
new data's meaning. Presentation depends only on the artifact contract, so it can
proceed in parallel with the infrastructure chain. The provisional "authorized account
flow" arc is dropped: catalog acquisition needs no Kilter account, and personal-data
sync and publishing remain out of scope for this epic.

### Child features

- `epic-catalog-sync-snapshot-normalize` — Boardsesh Homewall snapshot → CruxControl
  7x10 artifact and manifest (roles, UUIDs, aliases, provenance, hardware pin) —
  depends on: `[]`
- `epic-catalog-sync-append-only-guards` — merge with the previous artifact, append-only
  identities, removed-upstream marking, fail-closed guards and diff report — depends on:
  `[epic-catalog-sync-snapshot-normalize]`
- `epic-catalog-sync-private-publish` — scheduled workflow, private storage with retained
  versions, authenticated endpoint, guard-trip issue — depends on:
  `[epic-catalog-sync-append-only-guards]`
- `epic-catalog-sync-device-update` — Android signed-in update check, prompt, verified
  A/B install, no downgrade — depends on: `[epic-catalog-sync-snapshot-normalize,
  epic-catalog-sync-private-publish]`
- `epic-catalog-sync-catalog-semantics` — removed-upstream badge, declared rating scale,
  setter attribution and source wording, stable playlist resolution — depends on:
  `[epic-catalog-sync-snapshot-normalize]`

### Decomposition risks

- **Live vault proximity (highest).** Private publish shares the Firebase project that
  holds real backups. Keep catalog resources namespaced and separately permissioned,
  make any gateway change additive, and apply infrastructure only through reviewed CI.
- **Upstream conversion quirks.** Role recoding (12–15), dashed UUIDs and the 523
  dashed-UUID climbs with pre-split dates show Boardsesh's conversion can change;
  hardware pinning and guards must catch drift rather than silently excluding climbs.
- **Guard thresholds.** Too tight blocks every update; too loose lets a partial upstream
  through. Tune from real diffs; a held update is the safe failure.
- **Critical path.** Normalize → guards → publish → device update is serial; catalog
  semantics is the only parallel branch.
- **Foundation drift.** SPEC/ARCHITECTURE currently state the catalog never refreshes
  and is same-origin only; the owning features must roll those docs forward when they
  land.

## Mockups

None planned at epic level. New UI (update prompt in Manage, removed-upstream badge,
scale and attribution text) composes existing catalog dialog, row and detail components.

## Child features reviewed and complete

All five child features are done with their reviews recorded:
`snapshot-normalize`, `append-only-guards`, `catalog-semantics`, `private-publish`,
`device-update`. Operator provisioning and the first live publish completed on
2026-10-20 (catalog v2: 13,326 climbs, 1,261 added, 23 removed upstream), and the
owner-phone update and catalog install passed with exact library preservation (see
`epic-catalog-sync-device-update` → Live acceptance).

## Epic review

- Effective weight: standard; one deeper aggregate pass at the epic boundary.
- Reviewer: Codex `gpt-6.1-sol` (high) via peeragent — cross-model, no network. It ran
  210 focused web tests, 44 Python tests, 10 gateway tests, 6 provisioning checks and
  typecheck, plus two diagnostic probes.
- Proposed verdict: Request changes. Receiver adjudication (all accepted and fixed):
  - **Blocker — preservation checked per climb, resolution is per climb and angle.** A
    climb losing only its 40° stats passed with `lost=[]` while 40° playlist lookups
    failed. Reconciliation now preserves every previously usable (climb, angle) pair,
    and `lost` counts a missing pair. Regression added.
  - **Important — carried legacy ratings kept the 1–3 scale inside a 0–5 artifact.**
    Rows copied from a schema-2 previous artifact are rescaled ×5/3 (Boardsesh's rule).
    Regression added.
  - **Important — once-per-day fetch was unenforced.** The build now reads the small
    upstream manifest first and stops as "unchanged" before downloading any artifact
    when its build time equals the published version's. Regression asserts only the
    manifest URL is fetched.
  - **Important — schema, hardware, invariant and previous-artifact refusals bypassed the
    hold issue.** They now write a report and route to the same single held issue.
    Regression runs the real publish script with a hardware mismatch.
  - **Important — README and VISION still described no live updates.** Rolled forward to
    distinguish signed-in Android updates from the legacy web/signed-out snapshot.
- Verification after fixes: Python 47 tests; foundation docs re-read for consistency.
- Closure: standard weight — findings fixed and verified, no second pass. The arc is
  live: weekly private publication enabled and the owner phone on catalog v2 with exact
  library preservation.

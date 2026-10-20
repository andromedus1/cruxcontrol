---
id: epic-catalog-sync-snapshot-normalize
kind: feature
stage: drafting
tags: [data]
parent: epic-catalog-sync
depends_on: []
release_binding: null
gate_origin: null
created: 2026-10-19
updated: 2026-10-19
research_refs:
  - .research/analysis/campaigns/kilter-current-catalog-sources/parent.md
---

# Normalize Boardsesh Snapshots into the CruxControl 7x10 Catalog Artifact

## Brief

Deterministically convert one Boardsesh Homewall snapshot (v1-gzip layout 8 plus the
v1-catalog hardware artifact) into a CruxControl catalog artifact the existing app
can install: the legacy-compatible tables and columns the query layer reads, pruned to
product 7 / layout 8 / size 17 / sets 26–27, gzipped reproducibly, with a manifest that
carries provenance (source, Boardsesh build time, table watermarks, schema version).
This replaces the BoardLib path in `web/scripts/build-catalog-snapshot.py` as the
catalog's source.

Normalization is the core of this feature: map role codes 12–15 to 42–45 by role name;
preserve the exact UUID spelling already published (legacy 32-hex climbs match exactly
today) and carry new dashed UUIDs as-is; resolve aliases; keep 7x10 compatibility
consistent with the app's placement/LED check; carry quality, sends and grades with an
explicit scale marker; and refuse to emit anything if the snapshot's hardware rows for
size 17 differ from the pinned board definition (`layoutRevision`
`kilter:7:8:17:f0d70b3db9a6`). Accept both gzip and plain SQLite bodies and record
the source bytes' hash.

It does **not** merge with previous artifacts, enforce append-only identity, publish
anything, or change the app. Those belong to sibling features.

## Epic context

- Parent epic: `epic-catalog-sync`
- Position in epic: foundation feature. Every sibling consumes the artifact and manifest
  contract defined here.

## Inherited design decisions

- Boardsesh snapshots are the recurring upstream; CruxControl re-hosts its own derived
  artifact (epic §Design decisions).
- The personal library is never touched by catalog work.

## Research briefs

- [Current Kilter catalog sources](../../../.research/analysis/campaigns/kilter-current-catalog-sources/parent.md) §4 (artifact shape, role codes, UUIDs, aliases,
  quality scale, transport) and implementation notes 2–5, 7–8.

## Foundation references

- `docs/SPEC.md` §2 Climb Browser and §6 Data Acquisition (provenance per import,
  native payloads alongside normalized fields).
- `docs/ARCHITECTURE.md` Module Map 2–3 (Data Layer, Catalog Providers).
- Existing contract: `web/src/data/catalog/manifest.ts`,
  `web/src/data/sqlite/catalog-install.ts` (`KILTER_CATALOG_REQUIRED_COLUMNS`),
  `web/src/data/catalog/kilter-projection.ts`.

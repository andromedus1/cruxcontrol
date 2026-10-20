---
id: epic-catalog-sync-device-update
kind: feature
stage: drafting
tags: [data, security]
parent: epic-catalog-sync
depends_on: [epic-catalog-sync-snapshot-normalize, epic-catalog-sync-private-publish]
release_binding: null
gate_origin: null
created: 2026-10-19
updated: 2026-10-19
research_refs:
  - .research/analysis/campaigns/kilter-current-catalog-sources/parent.md
---

# Signed-In Catalog Update Check and Atomic Install on Android

## Brief

Let the Android app learn about and install newer catalog versions from the private
endpoint. The app checks occasionally (and on demand from Manage) while signed in,
compares the offered version with the installed receipt, and shows a summary prompt
(for example new and removed-upstream counts). Installing is an explicit tap. The
existing A/B OPFS install verifies hash, sizes and schema, swaps only on success,
keeps the current catalog on any failure, and never installs a lower version.

This extends today's same-origin, install-once flow: the manifest parser accepts the
new source and schema version, the bootstrap path gains an authenticated remote origin
(a compiled, validated endpoint in the style of the vault config), and `service.ts`
re-checks for offers when a catalog is already installed. The bundled older snapshot
remains a valid offline seed. Catalog work stays fully separate from the personal
library: playlists, authored climbs and backups are never read or written by the
update path.

It does **not** cover the web/PWA or iOS clients (no sign-in there yet), and does not
change how climbs display (catalog semantics).

## Epic context

- Parent epic: `epic-catalog-sync`
- Position in epic: consumer of the artifact contract and of the private endpoint.

## Inherited design decisions

- Prompt, then tap to install; current catalog stays until the new one verifies.
- Private, signed-in distribution; Android first.
- Personal library untouched by catalog updates.

## Research briefs

- [Current Kilter catalog sources](../../../.research/analysis/campaigns/kilter-current-catalog-sources/parent.md) implementation notes 1–2 (manifest resolution,
  integrity without a publisher hash — supplied by our own artifact).

## Foundation references

- `docs/SPEC.md` §2 (explicit consent before download; catalog absence leaves the
  library available) and §10 Private Library Preservation.
- `docs/ARCHITECTURE.md` Module Map 2 (A/B OPFS slots, receipts).
- Existing code: `web/src/data/catalog/bootstrap.ts`, `manifest.ts`,
  `web/src/data/sqlite/catalog-install.ts`, `catalog-receipt.ts`,
  `web/src/catalog/service.ts`; Android `CatalogAssetWebViewClient.java`,
  `scripts/android-vault-config.mjs`.

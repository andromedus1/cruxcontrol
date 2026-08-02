---
id: epic-route-creation-kilter-screenshot-import-recognition-core
kind: story
stage: done
tags: [data, ui]
parent: epic-route-creation-kilter-screenshot-import
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Screenshot Recognition Core

## Brief

Implement Unit 1 from the parent feature: pure local ring recognition, authoritative
Fullride-cell resolution, and the facts-only manifest for the 16 supplied screenshots.

## Implementation notes

- Execution capability: focused inline implementation; the detector, immutable facts,
  and definition mapping form one cohesive pure-code boundary.
- Review weight: standard (project convention); the parent feature retains the
  independent review boundary.
- Files changed: `web/src/screenshot-import/types.ts`, `ring-detector.ts`,
  `supplied-fullride-climbs.ts`, `interpret.ts`, `index.ts`, and focused tests.
- Tests added: generated RGBA fixtures cover four roles, edge cells, proportional
  scaling/translation, color noise, alpha rejection, snap thresholds, duplicate cells,
  and unsupported profiles; manifest tests lock all 16 titles, checksums, ring tuples,
  immutability, and coordinate-derived placement resolution.
- Simplification: known private inputs bypass pixel analysis by checksum and contain
  facts only; unknown inputs share the pure detector and require title confirmation.
  No placement IDs, screenshot coordinates, pixels, OCR runtime, or second climb model
  are stored in the manifest.
- Source verification: read-only checksum, title, and connected-component measurement
  of all 16 private 1080×2400 PNGs produced the checked-in 7–15 semantic ring facts;
  the PNG files were not modified or staged.
- Discrepancies from design: none.
- Adjacent issues parked: none.

---
id: epic-climb-browser-private-kilter-hold-artwork
kind: feature
stage: drafting
tags: [ui]
parent: epic-climb-browser
depends_on: [epic-climb-browser-fullride-renderer, epic-playlists]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Recognizable Fullride Hold Artwork for Private Use

## Brief

Replace the editor's overly schematic Fullride hold shapes with hold imagery that is
recognizable enough to map quickly between CruxControl and the physical board. For
the current private/local prototype, the supplied Kilter board screenshot may be used
as the visual source.

Public distribution remains gated by `idea-kilter-artwork-distribution-rights`: before
shipping these assets publicly, obtain permission, replace them with redistributable
imagery, or create sufficiently original artwork.

## Simplification opportunity

Retain the generated Fullride definition as the authority for placement identity,
coordinates, and LED mapping. Change only the renderer's visual artwork source so no
second board geometry or interaction surface is introduced.

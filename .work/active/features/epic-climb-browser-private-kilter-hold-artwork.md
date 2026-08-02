---
id: epic-climb-browser-private-kilter-hold-artwork
kind: feature
stage: implementing
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

## Design decisions

- **Private source**: use the immutable tracked `docs/kilter_fullride_7x10.png` directly
  as a Vite-bundled private/local asset. Do not modify, segment, recolor, or duplicate it.
  `idea-kilter-artwork-distribution-rights` remains the mandatory gate before any public
  artifact containing the source is distributed.
- **One calibrated underlay**: render the complete 305-hold reference once beneath the
  existing placement overlays. Do not create 305 raster nodes, crops, or a second
  placement manifest.
- **Authority**: generated definition identity, layout revision, coordinates, LED
  positions, hit testing, keyboard navigation, and light-scene projection remain
  authoritative. Raster calibration is presentation-only and may never change them.
- **Color legibility**: preserve the reference hold pixels. Selected/animated state uses
  the existing semantic marker plus a stronger translucent halo/ring in `currentColor`
  rather than tinting away the distinguishing physical silhouette.
- **Failure and compatibility**: enable the raster only for the exact Fullride definition
  ID/revision. Show the existing independently authored schematic hold artwork while the
  image is loading, after load failure, and for every other definition.
- **UI fallback**: no new mock is required. The parent selected the complete-board
  renderer, supplied this exact reference, and explicitly pinned recognizable physical
  holds. This changes the artwork layer, not screen structure, controls, or flow.

## Architectural choice

Three shapes were evaluated. A generated 305-sprite atlas would permit per-hold image
tinting, but interleaved holds overlap simple logical cells, it introduces a generated
identity manifest, and it costs hundreds of SVG image/clip nodes during phone zoom. A
generated transparent composite would theme more naturally, but background segmentation
and fringe cleanup add an image-processing toolchain and a second derived binary whose
fidelity must be audited. Rendering the raw sheet as an ordinary board background would
be fastest but would couple selection coordinates to an unverified stretch if left
implicit.

The chosen architecture is one explicit, calibrated raster-artwork adapter. A pure
resolver recognizes the exact board definition/revision and supplies the imported asset
URL, immutable source metadata, and one SVG image rectangle. `BoardRenderer` renders
that image after the panel and retains all 305 definition-positioned semantic groups over
it. Schematic artwork stays mounted until the raster emits `load`, and returns on `error`.
This preserves one decoded/rasterized image, one placement authority, every existing
interaction/accessibility contract, and a clean public-release escape hatch.

The calibration is affine and visual only. Definition coordinates form an exact 21×29
checkerboard lattice:

```typescript
column = (position.x + 40) / 4; // 0..20
row = (140 - position.y) / 4;  // 0..28
column % 2 === row % 2;
```

All 305 valid cells exist: even/even set 26 contributes 165, odd/odd set 27 contributes
140. Pixel sampling of the immutable source fits bolt centers at approximately
`x = 60.69 + 50.387 × column`, `y = 109.40 + 50.592 × row`, with roughly 7.24 px maximum
visual residual. Mapping that fit to the existing SVG centers produces an image rectangle
near `{x: 3.18, y: -0.65, width: 89.39, height: 125.24}` in the 96×128 viewBox. Tests lock
the constants and tolerate visual residual; they never promote pixels to domain truth.

## Implementation Units

### Unit 1: Private artwork resolver and lattice calibration

**Files**: new `web/src/board-renderer/fullride-private-artwork.ts`, focused tests,
and existing `web/src/board-renderer/fullride-reference.test.ts`

```typescript
export interface BoardRasterArtwork {
  readonly href: string;
  readonly source: Readonly<{
    width: 1126;
    height: 1584;
    sha256: 'a1e17430dd42eb7c81021834405a87d5a90bf9d14bca9af408553380f0a00bb0';
  }>;
  readonly imageBox: Readonly<{ x: number; y: number; width: number; height: number }>;
}

export function fullrideSheetCell(
  position: BoardPoint,
): Readonly<{ column: number; row: number }>;

export function resolveBoardRasterArtwork(
  definition: BoardDefinition,
): BoardRasterArtwork | null;
```

Import the immutable PNG through Vite's `?url` handling. Match both definition ID and
layout revision; do not branch on native provider IDs inside the generic renderer.
`fullrideSheetCell` rejects fractional, out-of-range, or parity-invalid positions and is
used only to validate/calibrate the artwork, never for hit testing or lighting.

**Acceptance Criteria**:

- [ ] All 305 placements map uniquely onto every valid in-range parity cell; invalid and
  off-lattice points fail explicitly.
- [ ] Only the exact Fullride ID/revision resolves; a synthetic/other definition returns
  `null` and retains schematics.
- [ ] Source dimensions and SHA-256 remain unchanged; build output contains one bundled
  PNG URL and never references a runtime filesystem or network URL.
- [ ] Calibration anchors at corner and center placements fall within the documented
  source residual while domain centers remain byte-for-byte unchanged.

### Unit 2: Single-image renderer composition and overlays

**Files**: `web/src/board-renderer/{BoardRenderer.tsx,BoardRenderer.css,
BoardRenderer.fullride.test.tsx,BoardRenderer.test.tsx,hold-artwork.test.tsx,index.ts}`

```typescript
type RasterArtworkStatus = 'pending' | 'ready' | 'failed';

// BoardRenderer's public props remain unchanged.
// Schematic HoldArtwork remains the complete fallback implementation.
```

Resolve artwork once per definition and render one decorative SVG `<image>` after the
panel with `preserveAspectRatio="none"`. Reset load state when the resolved asset changes.
Until `onLoad`, and after `onError`, render every existing schematic. Once ready, suppress
only the schematic silhouette/body; preserve one transparent minimum-size hit target,
selection halo/ring, role/custom marker, focus treatment, placement data, and accessible
button semantics above the raster. Pointer-nearest and keyboard behavior continue using
definition coordinates exclusively.

**Acceptance Criteria**:

- [ ] Loaded Fullride renders exactly one raster image and 305 semantic placement groups;
  fallback renders zero raster images and 305 schematic bodies.
- [ ] Pending/error states never produce a blank or unselectable board.
- [ ] Selected and animated holds retain unmistakable color halos/rings and role/custom
  markers without hiding the recognizable source silhouette; focus is distinguishable
  independently of color.
- [ ] Pointer activation, roving keyboard navigation, labels, scale 1–3, pinch/pan, and
  definition-coordinate transforms remain unchanged.
- [ ] Structural phone performance remains one raster node rather than 305; an Android
  pinch/pan smoke has no visible blanking or interaction regression.

### Unit 3: Current-state documentation and private-release boundary

**Files**: `docs/{SPEC.md,ARCHITECTURE.md}` and this feature body

Replace the current unconditional “independently authored schematic” assertion with the
truth: the private Fullride prototype uses the immutable calibrated raster underlay and
keeps definition-driven schematic fallback. State that public distribution requires
permission or replacement and that removing the resolver restores the distributable
schematic path without data migration.

**Acceptance Criteria**:

- [ ] Foundation docs describe present code and do not imply redistribution permission.
- [ ] `idea-kilter-artwork-distribution-rights` remains open and names the public gate.
- [ ] No climb, playlist, installation, definition, or IndexedDB schema changes.

## Implementation Order

1. Resolver/lattice/calibration — prove exact compatibility and image placement without
   touching interaction behavior.
2. Renderer composition/overlays — swap only the visual layer behind stable semantics.
3. Documentation and Android visual smoke — record the private boundary and verify the
   real consumer after automated contracts pass.

No child stories are created: the resolver and renderer load/fallback state form one
tightly coupled, single-stride visual feature, and documentation must describe that exact
implementation rather than advance independently.

## Testing

- Pure tests exhaust all 305 cells, parity, uniqueness, exact compatibility, calibration
  anchors, and failure cases.
- Renderer DOM tests fire image load/error and assert one-image structure, schematic
  fallback, all placement IDs/centers, role/custom/animated overlays, roving focus, and
  pointer activation.
- Existing renderer/editor/viewer suites remain regression coverage for board composition,
  hit testing, pinch/pan, and accessibility.
- Production build and PWA check prove the PNG is emitted/pre-cached. Manual compact and
  wide visual checks compare corner/center alignment at scale 1 and 2.5; Android verifies
  pinch/pan and hold selection with the private source.

## Risks

- **Calibration drift**: the sheet has small non-affine bolt-center residual, and the
  reference may later change. **Fallback**: checksum mismatch fails the immutable-source
  test; retain schematic mode rather than changing domain coordinates to chase pixels.
- **Private artwork escapes into a public artifact**: Vite intentionally bundles the
  source for local use. **Fallback**: public release remains blocked by the existing
  rights item; removing the resolver import returns the complete schematic renderer.
- **Theme contrast**: the raw source may carry light pixels or its own background.
  **Fallback**: first preserve fidelity; use panel/mix-blend/opacity CSS only after visual
  inspection, never destructive preprocessing or tinting that reduces recognition.
- **Raster load failure/offline first launch**: an asset can fail before service-worker
  control. **Fallback**: pending/error always shows the current self-contained schematics;
  the bundled asset is included in the production PWA precache.
- **Color overlay obscures shape**: an opaque fill would recreate the recognition problem.
  **Fallback**: use a restrained translucent halo plus outline/marker and verify all four
  roles and arbitrary custom colors at phone scale.

---
id: epic-universal-board-platform-domain-definition
kind: feature
stage: done
tags: [data]
parent: epic-universal-board-platform
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Namespaced Identity and Fullride Board Definition

## Brief

Define the provider-neutral identities and immutable board/layout definition model
that downstream rendering, editing, persistence, and control use. Deliver the Kilter
Fullride 7x10 as the first concrete definition, including its geometry, placements,
role metadata, angle rules, and placement-to-LED information from the verified local
catalog/reference material.

This feature prevents bare Kilter IDs and layout constants from escaping into product
features. It does not build a renderer, route editor, controller encoder, board setup
screen, or any non-Kilter definition.

## Epic context

- Parent epic: `epic-universal-board-platform`
- Position in epic: foundation feature — installation composition and catalog
  projection depend on its identity and definition vocabulary.

## Inherited design decisions

- Implement only the low-cost seams needed to keep Kilter assumptions contained;
  defer dynamic plugins and every non-Kilter adapter.
- The home Kilter Fullride 7x10 is the only required physical-board fixture.
- Board definitions are immutable and definition-driven; namespaced identity crosses
  module boundaries instead of bare vendor IDs.
- Provider-native identifiers and revisions remain available beside normalized fields.

## Research briefs

- `.research/analysis/landscapes/climbing-board-ecosystem.md` — grounds the independent
  board-definition axis and warns against assuming protocol universality.
- `docs/briefs/data-model.md` — grounds Fullride products/layouts/sizes, placement and
  hole identity, roles, coordinates, and LED mapping.
- `docs/briefs/hardware-and-protocol.md` — grounds Fullride hardware geometry and LED
  addressing constraints.
- `docs/kilter_fullride_7x10.png` — preserved visual reference for later renderer
  alignment; catalog coordinates remain authoritative.

## Foundation references

- `docs/ARCHITECTURE.md` — Board Domain & Installation Registry; namespaced immutable
  identity and three-axis composition conventions.
- `docs/SPEC.md` — Domain Model (`BoardDefinition`, `ProviderClimbId`, roles and
  layouts) and Kilter-first acceptance scope.
- `docs/PRINCIPLES.md` — Separate the three changing axes; preserve before normalizing.

## Design decisions

- **Definition availability**: the Fullride physical definition is a checked-in,
  deterministic TypeScript artifact generated from a schema-faithful Kilter SQLite
  catalog. Rendering, local drafts, and lighting therefore work without an installed
  community-climb catalog or a network connection.
- **Identity shape**: cross-module identities are immutable value objects whose
  fields remain legible (`provider`, source ID, and layout revision). Stable key
  helpers own serialization; consumers must not concatenate or parse identity strings.
- **Controllable-placement identity**: the selectable/lightable surface is the
  intersection of layout placements and the active product size's LED map. A
  definition-scoped placement ID is distinct from Kilter's placement, hole, set, and
  LED IDs; those native IDs remain as source metadata. Unjoined layout placements are
  not controls on this 7x10 definition.
- **Colors**: climb roles and light colors are independent. Four Kilter role presets
  (green start, blue middle, red/pink finish, gold/yellow foot-only) provide semantic
  defaults, while the domain color contract exposes every API-level-3 packed color
  (`0..255`, RGB 3/3/2) for unrestricted drafts, manual lighting, and later visualizers.
- **Draft validity boundary**: this feature performs structural definition validation
  only. It does not impose route rules, required starts/finishes, role counts, or
  publication constraints.
- **Angle truth**: supported angles are an explicit immutable list generated from
  `products_angles`, not inferred from a min/max range. The first fixture is expected
  to cover the documented 0–70 degree Fullride range, but the generated source owns
  the exact values.
- **Fixture authority**: catalog coordinates and joins are authoritative. The supplied
  `docs/kilter_fullride_7x10.png` is a visual alignment reference and is never sampled
  to manufacture IDs or geometry.
- **Verified Fullride subset**: the locally available schema-faithful snapshot proves
  305 controllable placements for product size 17—165 Mainline and 140 Auxiliary—each
  with one unique LED. The definition exports those 305 placements. It does not claim
  or fabricate a separate 60-foothold map unsupported by the snapshot.
- **Role discovery**: role semantics are derived from the generated product-specific
  role records (`name`/`full_name`), not legacy numeric constants. The verified source
  currently resolves start/middle/finish/foot-only to IDs 42/43/44/45.

## Architectural choice

Use a small pure `domain/boards` module with branded primitives, immutable value
objects, validation/key helpers, and an explicit in-process definition registry. The
concrete Fullride module wraps a checked-in generated data artifact. This is contracts
before implementation at the expensive boundary while avoiding a speculative plugin
system: downstream code can consume a `BoardDefinition`, but only one definition is
registered now.

Two alternatives were rejected. Querying physical geometry from the installed catalog
at runtime would couple local route creation and lighting to catalog bootstrap, directly
violating the local milestone boundary. Hand-maintaining a large JSON/TypeScript map
would be diffable but not reproducible and would invite coordinate/LED drift. A dynamic
plugin loader was also considered, but one implementation provides no evidence for its
loading or versioning abstractions; an explicit typed registry is sufficient and can
evolve additively.

The trickiest unit is the generated Fullride artifact and its validation. A placement
that joins to the wrong hole or LED can render plausibly while lighting the wrong
physical hold. Generation therefore treats placement → hole → product-size LED as an
inner-joined controllable projection under the exact product/layout/size/set scope,
fails on ambiguous mappings, reports excluded layout placements as provenance, orders
rows deterministically, and emits source metadata beside the definition identity.

## Implementation Units

### Unit 1: Board identity and color contracts

**Files**:
- `web/src/domain/boards/types.ts`
- `web/src/domain/boards/identity.ts`
- `web/src/domain/boards/colors.ts`

```typescript
// types.ts
declare const brand: unique symbol;
export type Brand<T, Name extends string> = T & { readonly [brand]: Name };

export type BoardDefinitionId = Brand<string, 'BoardDefinitionId'>;
export type LayoutRevisionId = Brand<string, 'LayoutRevisionId'>;
export type BoardPlacementId = Brand<string, 'BoardPlacementId'>;
export type ProviderId = Brand<string, 'ProviderId'>;
export type ProviderSourceId = Brand<string, 'ProviderSourceId'>;
export type ProviderClimbKey = Brand<string, 'ProviderClimbKey'>;
export type ApiLevel3Color = Brand<number, 'ApiLevel3Color'>;

export interface ProviderClimbId {
  readonly provider: ProviderId;
  readonly sourceId: ProviderSourceId;
  readonly layoutRevision: LayoutRevisionId;
}

// identity.ts — constructors reject empty/whitespace values.
export function boardDefinitionId(value: string): BoardDefinitionId;
export function layoutRevisionId(value: string): LayoutRevisionId;
export function boardPlacementId(value: string): BoardPlacementId;
export function providerId(value: string): ProviderId;
export function providerSourceId(value: string): ProviderSourceId;
export function providerClimbKey(id: ProviderClimbId): ProviderClimbKey;

// colors.ts
export interface Rgb24 {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}
export function apiLevel3Color(value: number): ApiLevel3Color;
export function packApiLevel3Color(rgb: Rgb24): ApiLevel3Color;
export function unpackApiLevel3Color(color: ApiLevel3Color): Rgb24;
export function apiLevel3ColorHex(color: ApiLevel3Color): `#${string}`;
```

**Implementation Notes**:
- Constructors are the only casts to branded primitives. IDs reject empty values;
  `ApiLevel3Color` rejects non-integers and values outside `0..255`.
- `providerClimbKey` uses length-prefixed UTF-8-safe components (or an equivalently
  unambiguous canonical encoding) and is covered by collision tests. The object remains
  the public identity; the opaque key is for maps/URLs/persistence.
- Packing clamps nothing: each RGB channel must be an integer in `0..255`, otherwise
  it throws `RangeError`. Quantization is `(r >> 5) << 5 | (g >> 5) << 2 | (b >> 6)`.
  Unpacking expands quantized channels across the full 0–255 display range using
  `round(channel * 255 / max)`; this is a preview of hardware output, not the original
  requested color.

**Acceptance Criteria**:
- [ ] Bare source climb IDs cannot satisfy a `ProviderClimbId` or `ProviderClimbKey`.
- [ ] Canonical keys differ when provider, source ID, or layout revision differs and
  cannot collide when component text contains separators or Unicode.
- [ ] All 256 API-level-3 values round-trip through constructor/unpack/repack.
- [ ] Packing accepts arbitrary valid RGB24 colors and predictably quantizes them;
  malformed IDs and out-of-range/non-integer colors fail fast.

### Unit 2: Immutable board-definition contract and validator

**Files**:
- `web/src/domain/boards/definition.ts`
- `web/src/domain/boards/validate-definition.ts`

```typescript
export type ClimbRole = 'start' | 'middle' | 'finish' | 'foot-only';

export interface BoardPoint {
  readonly x: number;
  readonly y: number;
}
export interface BoardBounds {
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly top: number;
}
export interface NativePlacementIdentity {
  readonly provider: ProviderId;
  readonly productId: ProviderSourceId;
  readonly layoutId: ProviderSourceId;
  readonly productSizeId: ProviderSourceId;
  readonly setId: ProviderSourceId;
  readonly placementId: ProviderSourceId;
  readonly holeId: ProviderSourceId;
  readonly ledPosition: number;
}
export interface BoardPlacementDefinition {
  readonly id: BoardPlacementId;
  readonly position: BoardPoint;
  readonly native: NativePlacementIdentity;
}
export interface RolePreset {
  readonly role: ClimbRole;
  readonly label: string;
  readonly sourceRoleId: ProviderSourceId;
  readonly lightColor: ApiLevel3Color;
  readonly screenColor: `#${string}`;
}
export interface BoardDefinition {
  readonly id: BoardDefinitionId;
  readonly layoutRevision: LayoutRevisionId;
  readonly manufacturer: string;
  readonly model: string;
  readonly layout: string;
  readonly size: string;
  readonly bounds: BoardBounds;
  readonly supportedAngles: readonly number[];
  readonly placements: readonly BoardPlacementDefinition[];
  readonly rolePresets: Readonly<Record<ClimbRole, RolePreset>>;
}
export interface DefinitionValidationIssue {
  readonly path: string;
  readonly code: 'invalid-bounds' | 'invalid-coordinate' | 'invalid-angle' |
    'duplicate-angle' | 'duplicate-domain-placement-id' |
    'duplicate-placement-id' | 'duplicate-hole-id' | 'duplicate-led-position' |
    'native-scope-mismatch' | 'missing-role' | 'unknown-source-role' |
    'duplicate-source-role';
  readonly message: string;
}
export function validateBoardDefinition(
  definition: BoardDefinition,
): readonly DefinitionValidationIssue[];
export function assertBoardDefinition(
  definition: BoardDefinition,
): asserts definition is BoardDefinition;
```

**Implementation Notes**:
- `BoardDefinition` is deeply readonly by contract; concrete fixtures use `as const`
  and are frozen recursively once at module initialization so runtime mutation fails.
- Coordinates remain in catalog space. Normalization/pixel transforms belong to the
  renderer; the domain only requires finite coordinates inside non-degenerate bounds.
- Every exported placement is controllable and therefore has one LED position. Domain
  placement IDs, native placement IDs, native hole IDs, and LED positions are each
  validated as unique non-negative identities within this definition. If a future
  verified board requires one-to-many mapping, add that model explicitly rather than
  weakening the Fullride invariant.
- Role preset screen colors use the locked design tokens, while `lightColor` stores
  the exact 3/3/2 value sent to API-level-3 hardware. User-facing terminology is
  green, blue, red/pink, and gold/yellow even where native catalog labels say
  cyan/magenta/orange.

**Acceptance Criteria**:
- [ ] Validation rejects malformed bounds, non-finite/out-of-bounds coordinates,
  invalid/duplicate angles, duplicate domain/native placement/hole/LED identities,
  native scope drift, and incomplete/ambiguous role presets.
- [ ] Validation does not enforce any climb composition or role-count rules.
- [ ] A consumer can enumerate geometry, source placement/hole identity, LED position,
  supported angles, and all four role presets without importing Kilter infrastructure.

### Unit 3: Deterministic Fullride definition generator and artifact

**Files**:
- `web/scripts/export-fullride-definition.py`
- `web/scripts/test_export_fullride_definition.py`
- `web/src/domain/boards/definitions/kilter-fullride-7x10.generated.ts`
- `web/src/domain/boards/definitions/kilter-fullride-7x10.ts`

```typescript
// kilter-fullride-7x10.ts
export const KILTER_PROVIDER_ID: ProviderId;
export const KILTER_FULLRIDE_7X10_REVISION: LayoutRevisionId;
export const kilterFullride7x10Definition: BoardDefinition;
```

```text
python web/scripts/export-fullride-definition.py \
  --catalog /path/to/kilter.db \
  --out web/src/domain/boards/definitions/kilter-fullride-7x10.generated.ts
```

**Implementation Notes**:
- Scope constants reuse the catalog-bootstrap evidence: product `7`, layout `8`,
  product size `17`, sets `26` and `27`. In one read-only transaction, the generator
  queries size bounds and angles; discovers the product's role records; and selects
  controllable placements with an inner join from `placements` through `holes` to
  `leds WHERE product_size_id = 17`.
- Layout placements without a size-17 LED are counted by set in provenance and excluded
  from the control/selection surface. They are not errors: the layout spans nested
  product sizes. Duplicate join results, missing native scope, or an empty controllable
  projection are errors.
- Role semantics are normalized from source names after ASCII case/space/hyphen
  normalization: `start`, `middle`, `finish`, and `foot`/`foot only`. The generator
  requires exactly one record for each semantic role and rejects unknown/ambiguous
  records. It emits the discovered native IDs and colors; no numeric role ID is coded
  into the wrapper.
- It emits sorted controllable placements, angles, and role records so identical source
  data yields byte-identical output.
- The generated header records source scope, source DB SHA-256, projection counts, and
  the generator command without a volatile timestamp. The immutable revision contains
  a short hash of the definition-bearing rows, not the continually changing climb
  catalog version.
- The wrapper applies locked user-facing labels/tokens and packs each generated native
  LED color into an API-level-3 value. It exports no raw arrays.
- Verified acceptance fixture: 305 controllable placements (165 set 26 Mainline, 140
  set 27 Auxiliary), 305 unique holes, 305 unique LED positions, product bounds
  `[-44,44] × [24,144]`, and angles `0,5,...,70`. Generated role IDs are 42–45 for the
  current source, but tests prove the semantic mapping from generated records rather
  than making those values input constants.

**Acceptance Criteria**:
- [ ] The checked-in artifact can construct the Fullride definition with no network,
  SQLite, or installed climb catalog at runtime.
- [ ] Re-running against the same source database produces no diff except an unchanged
  provenance header; a changed physical map produces a new layout revision.
- [ ] The fixture contains the complete verified controllable map, all supported
  angles, all four semantic presets, and native placement/hole/set/LED identities.
- [ ] The generated provenance reports 472 total scoped layout placements, 305 emitted
  controllable placements, and 167 excluded unjoined placements, making the projection
  boundary auditable.
- [ ] The screenshot is preserved unchanged and excluded from generation logic.

### Unit 4: Explicit definition registry

**Files**:
- `web/src/domain/boards/registry.ts`
- `web/src/domain/boards/index.ts`

```typescript
export interface BoardDefinitionRegistry {
  get(id: BoardDefinitionId): BoardDefinition | undefined;
  require(id: BoardDefinitionId): BoardDefinition;
  list(): readonly BoardDefinition[];
}
export function createBoardDefinitionRegistry(
  definitions: readonly BoardDefinition[],
): BoardDefinitionRegistry;
export const boardDefinitions: BoardDefinitionRegistry;
```

**Implementation Notes**:
- Registry construction validates each definition and rejects duplicate definition IDs
  or layout revisions. `list()` returns a stable ID-sorted, frozen array.
- The production registry contains only `kilterFullride7x10Definition`. This is an
  explicit composition root, not runtime discovery or a plugin API.
- `require` throws a domain-specific `UnknownBoardDefinitionError` carrying the ID;
  `get` supports capability probes without exceptions.

**Acceptance Criteria**:
- [ ] The production registry lists exactly the Fullride definition and resolves it by
  its typed ID/revision.
- [ ] Invalid or duplicate registrations fail during construction, before consumers run.
- [ ] No board consumer needs a Kilter constant or imports a generated fixture directly.

## Implementation Order

1. **Fullride projection check** — encode the already-verified authoritative joins and
   assert the 472/305/167 projection accounting before generating any artifact.
2. **Identity and color contracts** — establish the types and exhaustive color math.
3. **Definition contract and validation** — encode the verified invariants from the spike.
4. **Generated fixture and wrapper** — emit, validate, and check in the concrete board.
5. **Registry and barrel export** — expose the stable consumer boundary last.

No child stories are spawned. Although there are four units, the contracts,
validator, generator, fixture, and registry share one load-bearing invariant set and
should be implemented and reviewed as one cohesive stride; splitting ownership would
increase merge and assumption risk.

## Testing

### Unit tests: `web/src/domain/boards/identity.test.ts`

- Constructor rejection for empty/whitespace IDs.
- Provider climb key determinism, dimension sensitivity, separator safety, and Unicode.
- Type-level checks (`expectTypeOf`) that bare strings/source IDs cannot cross the
  identity boundary.

### Unit tests: `web/src/domain/boards/colors.test.ts`

- Exhaustive `0..255` constructor/unpack/repack round trip.
- Known protocol vectors: black `0x00`, full red `0xE0`, full green `0x1C`, full blue
  `0x03`, white `0xFF`, plus the four role presets.
- Invalid channel and packed values throw rather than clamp.

### Unit tests: `web/src/domain/boards/validate-definition.test.ts`

- A minimal valid definition passes.
- One focused mutation per validation issue proves all error codes and paths.
- No test asserts route-validity constraints: empty selections and arbitrary colors are
  explicitly outside definition validation.

### Fixture contract: `web/src/domain/boards/definitions/kilter-fullride-7x10.test.ts`

- `assertBoardDefinition` passes; definition/revision/source constants match provenance.
- Assert 305 controllable placements split 165/140 by set; unique domain placement,
  native placement, hole, and LED identities; finite bounds; every placement within
  bounds; explicit `0,5,...,70` angles; and four exact role semantics.
- Assert provenance accounts for 472 scoped placements as 305 emitted + 167 excluded.
- Assert generated source role records currently carry IDs 42/43/44/45 and exact native
  colors, while a generator fixture with different IDs but the same semantic names
  produces the same semantic-role keys.
- Assert the generated source database hash and definition-row hash against committed
  provenance so accidental hand editing or regeneration from the wrong catalog fails.
- Sample known bottom/middle/top placements from the generated artifact to catch axis or
  join reversal without snapshotting the entire array.

### Generator contract: `web/scripts/test_export_fullride_definition.py`

- Build a minimal temporary SQLite schema with nested-size unjoined placements and
  assert only product-size LED joins are emitted, with total/emitted/excluded counts.
- Replace native role IDs while retaining semantic names and prove generated semantic
  keys remain stable; reject missing, duplicated, and unknown role semantics.
- Reject ambiguous LED joins and prove row insertion order cannot change generated
  artifact bytes.

### Registry contract: `web/src/domain/boards/registry.test.ts`

- Stable listing, `get`, `require`, unknown-ID error, duplicate-ID/revision rejection,
  and runtime immutability.

### Verification

Run `python -m unittest web/scripts/test_export_fullride_definition.py`, `npm test`,
`npm run typecheck`, `npm run lint`, and regenerate the fixture once from its recorded
catalog source to prove a clean deterministic diff.

## Risks

- **Riskiest assumption — the LED join defines the selectable 7x10 surface.** The
  verified snapshot supports it exactly: 305 unique joined placements split 165/140,
  matching the documented Mainline/Auxiliary bolt-on counts, while unjoined placements
  occupy the wider nested layout. **Fallback:** if hardware smoke testing finds a
  controllable hold absent from this projection, preserve this revision and generate a
  corrected revision from newer authoritative data; do not append guessed LEDs.
- **Catalog reproducibility.** The locally available pruned snapshot is authoritative
  generator input but binary catalog distribution remains a separate policy decision.
  **Fallback:** retain the generated TypeScript artifact plus source/projection hashes;
  regeneration may use BoardLib or a user-supplied source database, while runtime and
  fixture tests remain independent of SQLite and network access.
- **Coordinate transform uncertainty.** Catalog-space geometry is trustworthy while
  renderer pixel math still needs visual calibration. **Fallback:** preserve raw bounds
  and coordinates here; renderer owns an additive transform without changing identity.
- **Source role colors versus preferred terminology.** Native cyan/magenta/amber values
  and user-facing blue/red-pink/gold-yellow language can diverge. **Fallback:** retain
  both exact packed `lightColor` and independent screen token; never infer semantics
  from color.
- **Neutral hold artwork completeness.** The generated 305-placement overlay owns
  interaction and control, not detailed silhouettes. **Fallback:** the renderer uses
  the preserved full-board reference as its neutral visual layer and overlays all 305
  selectable positions; visual artwork can improve additively without changing IDs.

## Implementation discovery

Implementation stopped at the required generator spike because the checked-in,
schema-faithful snapshot contradicts the proposed physical-hold and LED model. The
snapshot at `web/public/catalog/kilter-7x10.v1.db.gz` was decompressed to a temporary
directory and queried read-only on 2026-08-02 with the designed product/layout/size/set
scope (`7` / `8` / `17` / `{26,27}`). It reports:

- 472 scoped placements: 234 Mainline and 238 Auxiliary.
- 305 unique LEDs for product size 17, with exactly 305 scoped placements joining to
  an LED and 167 scoped placements having no LED join.
- 345 scoped placements whose hole coordinates fall inside the product-size bounds;
  this still does not match the documented 365 total holds.
- Joined LED counts of 165 Mainline and 140 Auxiliary, which exactly match the
  documented 305 bolt-on split and strongly suggest that the snapshot's 305 LED rows
  represent the bolt-on physical map only.
- Source placement-role IDs `42`, `43`, `44`, and `45`, not the designed
  `12`, `13`, `14`, and `15`; their source colors are green, cyan, magenta, and orange.
- Explicit angles `0,5,10,...,70` and size bounds `left=-44`, `right=44`,
  `bottom=24`, `top=144`.

The central contract currently requires every emitted physical hold to join to exactly
one LED while also requiring a 365-hold fixture. Those requirements cannot both be
derived from this snapshot. No fixture, IDs, coordinates, tests, or weakened validator
were fabricated. Before implementation resumes, design must determine whether the
first definition should model only the 305 verified LED-addressable bolt-on placements,
obtain a catalog/fixture that identifies the documented 60 screw-on footholds and their
LED mapping, or represent non-addressable placements explicitly. The source-role IDs
must also be corrected to the verified 42–45 values (or derived by semantic source
fields rather than hard-coded IDs).

Verification evidence: the decompressed SQLite SHA-256 was
`32b2663c7e699708dc3983d6acf8eff5dd8d458530c680c50ce7f6719c61235f`;
the committed gzip SHA-256 was
`68d6d86aad984aca5cf9967d24c818d5bdf2984631b1fe9b9fa1fd30c0edbbbf`.

## Design resolution after implementation discovery

The apparent contradiction came from treating every placement in a layout shared by
nested product sizes as a hold on product size 17. The size-specific `leds` table is
the authoritative membership relation for what this controller can address. An inner
join yields exactly 305 unique placements/holes/LEDs, split 165 Mainline and 140
Auxiliary, all within the size bounds. The remaining 167 layout placements have no
size-17 LED and are excluded with provenance rather than modeled as disabled holds.

This is the smallest evidence-backed boundary that delivers local create, render, and
light. It also corrects role handling: generated product role names establish semantic
roles, while native IDs 42–45 are retained as output evidence rather than treated as
portable constants. The prior requirement for a fabricated 365-hold map is superseded.

## Implementation notes

- Execution capability: highest/xhigh, selected by the autopilot caller for the
  foundational generated-contract and physical-mapping risk.
- Review weight: standard, from project convention.
- Files changed: `web/src/domain/boards/{types,identity,colors,definition,validate-definition,registry,index}.ts`,
  `web/src/domain/boards/definitions/kilter-fullride-7x10{.generated,}.ts`,
  `web/scripts/export-fullride-definition.py`, their focused TypeScript tests, and
  `web/scripts/test_export_fullride_definition.py`.
- Tests added: exhaustive packed-color round trips and protocol vectors; branded
  identity/key collision contracts; definition validation issue coverage; exact
  Fullride projection/provenance/immutability contracts; stable registry behavior;
  and generator projection, semantic-role, ambiguity, and determinism tests.
- Simplification: runtime consumers receive one frozen definition and registry barrel;
  raw generated arrays stay behind the Kilter wrapper, with no runtime SQLite or plugin
  abstraction.
- Discrepancies from design: none after the verified 305-placement design resolution.
- Adjacent issues parked: none.
- Verification: `python3 -m unittest web/scripts/test_export_fullride_definition.py`
  passed 5 tests; `npm test` passed 117 tests; `npm run typecheck`, `npm run lint`, and
  `npm run build` passed. Two consecutive exports from the committed decompressed
  catalog were byte-identical.

## Review (2026-08-02)

**Verdict**: Approve

**Blockers**: none unresolved. Fixed inline: scoped placements with a missing hole or
a hole owned by another product were previously folded into the excluded/no-LED
provenance count; generation now rejects that native-scope corruption, with a focused
regression test.
**Important**: none
**Nits**: none
**Rejected**: none

**Notes**: Substrate feature review at effective weight `standard`; exactly one
balanced, same-harness fresh-context pass ran. Closure followed receiver verification
of the named blocker fix without a second review pass. Direct queries against the
schema-faithful source database (SHA-256
`32b2663c7e699708dc3983d6acf8eff5dd8d458530c680c50ce7f6719c61235f`) verified 472
scoped placements, 305 controllable placements, 167 excluded placements, emitted set
counts 165/140, excluded set counts 69/98, 305 unique placement/hole/LED-row/LED-position
identities, zero out-of-bounds emitted coordinates, source role IDs 42/43/44/45, and
angles `0,5,...,70`. Two post-fix regenerations were byte-identical to each other and
the checked-in artifact (SHA-256
`2de883837c343a63c56d4147dd6ff24434ad182712828a9069394515f045e499`). Verification
passed: 6 Python generator tests, 146 web tests, typecheck, lint, and production build.
Foundation assertions were inspected and remain aligned. Auth/security, network,
concurrency, persistence migration, and UI/UX lenses were not applicable to this pure
offline domain/generator boundary.

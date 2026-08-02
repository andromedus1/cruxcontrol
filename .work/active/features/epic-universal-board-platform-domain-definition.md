---
id: epic-universal-board-platform-domain-definition
kind: feature
stage: drafting
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
- **Physical hold identity**: a definition-scoped hold ID is distinct from Kilter's
  placement, hole, set, and LED IDs. Those native IDs remain on each concrete hold as
  source metadata so catalog frames and controller commands can be projected without
  making vendor IDs the domain identity.
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
physical hold. Generation therefore joins placement → hole → LED under the exact
product/layout/size/set scope, fails on missing or ambiguous mappings, orders rows
deterministically, and emits source metadata alongside the definition-scoped identity.

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
export type HoldId = Brand<string, 'HoldId'>;
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
export function holdId(value: string): HoldId;
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
export interface NativeHoldIdentity {
  readonly provider: ProviderId;
  readonly productId: ProviderSourceId;
  readonly layoutId: ProviderSourceId;
  readonly productSizeId: ProviderSourceId;
  readonly setId: ProviderSourceId;
  readonly placementId: ProviderSourceId;
  readonly holeId: ProviderSourceId;
  readonly ledPosition: number;
}
export interface BoardHoldDefinition {
  readonly id: HoldId;
  readonly position: BoardPoint;
  readonly native: NativeHoldIdentity;
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
  readonly holds: readonly BoardHoldDefinition[];
  readonly rolePresets: Readonly<Record<ClimbRole, RolePreset>>;
}
export interface DefinitionValidationIssue {
  readonly path: string;
  readonly code: 'invalid-bounds' | 'invalid-coordinate' | 'invalid-angle' |
    'duplicate-angle' | 'duplicate-hold-id' | 'duplicate-placement-id' |
    'duplicate-led-position' | 'native-scope-mismatch' | 'missing-role' |
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
- LED positions are validated as unique non-negative integers within this concrete
  definition. If a future verified board requires shared LEDs, that evidence should
  add an explicit mapping model rather than silently weakening this invariant.
- Role preset screen colors use the locked design tokens, while `lightColor` stores
  the exact 3/3/2 value sent to API-level-3 hardware. User-facing terminology is
  green, blue, red/pink, and gold/yellow even where native catalog labels say
  cyan/magenta/orange.

**Acceptance Criteria**:
- [ ] Validation rejects malformed bounds, non-finite/out-of-bounds coordinates,
  invalid/duplicate angles, duplicate domain/native placement/LED identities, native
  scope drift, and incomplete/ambiguous role presets.
- [ ] Validation does not enforce any climb composition or role-count rules.
- [ ] A consumer can enumerate geometry, source placement/hole identity, LED position,
  supported angles, and all four role presets without importing Kilter infrastructure.

### Unit 3: Deterministic Fullride definition generator and artifact

**Files**:
- `web/scripts/export-fullride-definition.py`
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
  product size `17`, sets `26` and `27`. The generator queries `placements`, `holes`,
  `leds`, `products_angles`, `placement_roles`, and size bounds in one read-only
  transaction.
- It fails if any scoped placement has zero or multiple hole/LED matches, any native
  identity is duplicated, all four source roles are not present exactly once, or the
  resulting `BoardDefinition` invariants would fail. It emits sorted placements,
  angles, and role records so identical source data yields byte-identical output.
- The generated header records source scope, UTC generation date, source DB SHA-256,
  row counts, and the generator command. The immutable revision contains a short hash
  of the definition-bearing rows, not the continually changing climb catalog version.
- The wrapper maps source roles 12/13/14/15 to semantic roles and locked UI labels,
  and packs their native LED colors into API-level-3 values. It exports no raw arrays.
- Expected acceptance fixture: 7x10 Fullride Mainline + Auxiliary, documented 305
  bolt-on holds plus 60 screw-on footholds, with every emitted placement joined to
  exactly one physical LED. If live catalog evidence contradicts this documented
  count, stop generation and record the discrepancy rather than adjusting the test.

**Acceptance Criteria**:
- [ ] The checked-in artifact can construct the Fullride definition with no network,
  SQLite, or installed climb catalog at runtime.
- [ ] Re-running against the same source database produces no diff except an unchanged
  provenance header; a changed physical map produces a new layout revision.
- [ ] The fixture contains the complete scoped physical map, all supported angles,
  all four semantic presets, and native placement/hole/set/LED identities.
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

1. **Fullride generator spike** — run the authoritative joins and confirm counts,
   uniqueness, and source role/angle records first because a contradiction changes the
   central physical model.
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
- Assert documented hold/set counts, unique placement/hole/LED mappings, finite bounds,
  every hold within bounds, explicit sorted angles, and four exact role semantics.
- Assert the generated source database hash and definition-row hash against committed
  provenance so accidental hand editing or regeneration from the wrong catalog fails.
- Sample known bottom/middle/top placements from the generated artifact to catch axis or
  join reversal without snapshotting the entire array.

### Registry contract: `web/src/domain/boards/registry.test.ts`

- Stable listing, `get`, `require`, unknown-ID error, duplicate-ID/revision rejection,
  and runtime immutability.

### Verification

Run `npm test`, `npm run typecheck`, `npm run lint`, and regenerate the fixture once
from its recorded catalog source to prove a clean deterministic diff.

## Risks

- **Riskiest assumption — one scoped placement maps to one LED.** The brief describes
  that chain but the 450-LED kit and 365 documented holds make unused positions likely.
  The generator spike validates the join rather than equating LED-kit count with hold
  count. **Fallback:** model only joined placement LEDs; if one placement legitimately
  has multiple LEDs, stop and revise `ledPosition` to an explicit non-empty list before
  downstream contracts depend on it.
- **Catalog availability during implementation.** The pruned binary is intentionally
  uncommitted and community-catalog bootstrap is deferred. **Fallback:** use BoardLib or
  a user-supplied full catalog only as generator input; runtime remains independent. If
  no authoritative database is obtainable, land contracts/tests but do not fabricate
  or mark the concrete fixture complete.
- **Coordinate transform uncertainty.** Catalog-space geometry is trustworthy while
  renderer pixel math still needs visual calibration. **Fallback:** preserve raw bounds
  and coordinates here; renderer owns an additive transform without changing identity.
- **Source role colors versus preferred terminology.** Native cyan/magenta/amber values
  and user-facing blue/red-pink/gold-yellow language can diverge. **Fallback:** retain
  both exact packed `lightColor` and independent screen token; never infer semantics
  from color.
- **Least sure — documented hold counts.** The brief distinguishes 305 bolt-ons, 60
  screw-ons, and 450 LED positions, but the exact scoped placement count must be
  observed. A count mismatch is an evidence discrepancy, not permission to weaken the
  test silently.

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

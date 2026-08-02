---
id: epic-universal-board-platform-installation-contracts
kind: feature
stage: done
tags: [data]
parent: epic-universal-board-platform
depends_on: [epic-universal-board-platform-domain-definition]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Installation Registry and Adapter Contracts

## Brief

Define the typed composition boundary that binds a configured board installation to
one immutable board definition and compatible catalog-provider and controller-profile
ports. Capabilities are explicit so consumers can discover whether the active
installation can browse, control, create, publish, import, or sync without coupling to
Kilter-specific infrastructure.

Deliver the minimal single-installation Kilter composition needed by the first
milestone and test substitutes for downstream work. This feature does not build board
inventory/setup UI, multiple installed catalogs, a dynamic plugin loader, Bluetooth
transport behavior, Kilter packet encoding, catalog acquisition, or non-Kilter
adapters.

## Epic context

- Parent epic: `epic-universal-board-platform`
- Position in epic: composition feature — consumes the domain definition and exposes
  the stable seams used by board control and later provider work.

## Inherited design decisions

- Board definition, catalog provider, and controller profile remain independent axes
  joined by an explicit installation.
- Use explicit typed registries and adapters; do not build a dynamic plugin framework
  before multiple real implementations demonstrate the need.
- First-milestone cardinality is one configured Fullride 7x10 installation, while the
  contract avoids hard-coding that restriction into downstream consumers.
- Provider import, publish, authentication, redistribution, and controller support are
  explicit capabilities rather than inferred behavior.

## Research briefs

- `.research/analysis/landscapes/climbing-board-ecosystem.md` — grounds the three-axis
  composition and explicit capability posture.
- `docs/briefs/board-control-web-bluetooth.md` — grounds the controller/transport seam
  and hardware-free adapter testing.
- `docs/briefs/hardware-and-protocol.md` — grounds the first controller-profile family
  without placing protocol logic in the registry.

## Foundation references

- `docs/ARCHITECTURE.md` — Board Domain & Installation Registry, Catalog Providers,
  and Controller Profiles & Transports.
- `docs/SPEC.md` — Board Inventory & Setup capability and `BoardInstallation` model.
- `docs/PRINCIPLES.md` — Separate the three changing axes; isolate external systems.

## Design decisions

- **Configured support versus runtime state**: installation capabilities describe
  what the configured definition/provider/controller composition supports. Browser
  Bluetooth availability, permission, connection, and write errors remain exclusively
  in `BoardLightController.getState().transport`; the registry does not duplicate or
  flatten that state.
- **One high-level controller contract**: `BoardLightController` is the only callable
  board-control surface. A controller profile is compatibility metadata plus a
  definition-bound controller factory; it does not introduce another connect/light
  interface or wrap byte transport behavior.
- **Provider boundary for this milestone**: provider registrations declare identity,
  definition compatibility, and explicit browse/publish/import/sync support. No
  provider operation interface is invented before the catalog-domain or future sync
  features supply real methods. The local Fullride composition has no configured
  community provider and therefore reports those capabilities unavailable.
- **Creation is local domain behavior**: `create` is explicitly supported by the
  Fullride installation without a catalog provider. It means unrestricted local
  draft authoring, not provider publication.
- **Cardinality**: a small immutable registry accepts multiple installations in its
  contract but the shipped composition registers exactly one Fullride 7x10
  installation and exposes it as active. There is no selection UI, persistence,
  mutation API, or dynamic loading.
- **Compatibility validation**: composition fails fast when a definition, provider,
  or controller profile is missing or incompatible. A controller factory receives
  the resolved immutable `BoardDefinition`, ensuring definition and controller cannot
  silently diverge.

## Architectural choice

Use explicit immutable registrations and a composition function. A
`BoardInstallationConfig` stores only stable IDs, angle, and the local-creation flag;
registries resolve those IDs to a `BoardDefinition`, optional provider registration,
and optional controller profile. Composition derives a frozen capability map and,
when requested, constructs the existing `BoardLightController` through the selected
profile. The shipped composition is ordinary TypeScript wiring for one Fullride—no
service locator and no runtime plugin discovery.

Two alternatives were rejected. A single vendor adapter owning definition, catalog,
and Bluetooth would be smaller today but would make the three axes inseparable and
spread Kilter assumptions into consumers. A generic plugin framework with lifecycle,
version negotiation, and dynamic registration would preserve extensibility but is
unsupported by one implementation and adds failure modes the milestone does not need.
Storing ready-made controller instances directly in installation records was also
rejected: it mixes immutable configuration with stateful browser resources and makes
tests and reconnect lifetimes harder to control.

The trickiest unit is definition-safe composition. Capability booleans are easy to
derive incorrectly—for example, claiming control because a profile ID is present even
when it does not support the resolved definition. Composition therefore resolves and
validates every configured reference first, checks the selected angle against the
definition, and only then derives capabilities and exposes factories.

## Implementation Units

### Unit 1: Installation identity, capability, and registration contracts

**File**: `web/src/installations/contracts.ts`

```typescript
import type { BoardDefinition } from '../domain/boards/definition.ts';
import type {
  BoardDefinitionId,
  Brand,
  ProviderId,
} from '../domain/boards/types.ts';
import type { BoardLightController } from '../board-control/light-controller.ts';

export type BoardInstallationId = Brand<string, 'BoardInstallationId'>;
export type ControllerProfileId = Brand<string, 'ControllerProfileId'>;

export function boardInstallationId(value: string): BoardInstallationId;
export function controllerProfileId(value: string): ControllerProfileId;

export const INSTALLATION_CAPABILITIES = [
  'browse', 'control', 'create', 'publish', 'import', 'sync',
] as const;
export type InstallationCapabilityName =
  (typeof INSTALLATION_CAPABILITIES)[number];
export type InstallationCapability =
  | { readonly available: true }
  | {
      readonly available: false;
      readonly reason: 'not-configured' | 'not-supported';
    };
export type InstallationCapabilities = Readonly<
  Record<InstallationCapabilityName, InstallationCapability>
>;

export const CATALOG_PROVIDER_CAPABILITIES = [
  'browse', 'publish', 'import', 'sync',
] as const;
export type CatalogProviderCapability =
  (typeof CATALOG_PROVIDER_CAPABILITIES)[number];

export interface CatalogProviderRegistration {
  readonly id: ProviderId;
  readonly compatibleDefinitionIds: readonly BoardDefinitionId[];
  readonly capabilities: Readonly<Record<CatalogProviderCapability, boolean>>;
}

export interface ControllerProfile {
  readonly id: ControllerProfileId;
  readonly compatibleDefinitionIds: readonly BoardDefinitionId[];
  createController(definition: BoardDefinition): BoardLightController;
}

export interface BoardInstallationConfig {
  readonly id: BoardInstallationId;
  readonly definitionId: BoardDefinitionId;
  readonly angle: number;
  readonly localCreation: boolean;
  readonly catalogProviderId: ProviderId | null;
  readonly controllerProfileId: ControllerProfileId | null;
}

export interface ConfiguredBoardInstallation {
  readonly config: BoardInstallationConfig;
  readonly definition: BoardDefinition;
  readonly provider: CatalogProviderRegistration | null;
  readonly controllerProfile: ControllerProfile | null;
  readonly capabilities: InstallationCapabilities;
  createController(): BoardLightController | null;
}
```

**Implementation Notes**:
- Capability lists are the single sources of truth; mapped record types and iteration
  derive downstream shapes. IDs reject empty/whitespace values using the same branded
  constructor convention as board identities.
- Provider registrations deliberately contain no placeholder callbacks. Real catalog
  query and sync ports remain owned by the features that can define their operations
  from actual consumers.
- Installation contracts live in a composition module—not the core board domain—so
  domain definitions never depend on the stateful board-control application service.
- `ControllerProfile.createController` returns the existing application controller.
  A concrete profile closes over its transport factory/configuration; installation
  code never sees `BoardByteTransport` or protocol bytes.
- `createController()` returns `null` only when no controller profile is configured;
  construction errors remain explicit and are not converted into capability flags.

**Acceptance Criteria**:
- [ ] The six configured capability names and four provider capability names are
  declared once and all corresponding union/record types derive from those constants.
- [ ] No new interface duplicates connect, disconnect, light, clear, preview, byte
  writes, transport state, or transport capability.
- [ ] Invalid installation/profile IDs fail at construction, while registration
  objects and compatibility lists are immutable at the public boundary.

### Unit 2: Fail-fast registries and installation composition

**File**: `web/src/installations/registry.ts`

```typescript
import type { BoardDefinitionRegistry } from '../domain/boards/registry.ts';
import type { ProviderId } from '../domain/boards/types.ts';
import type {
  BoardInstallationConfig,
  BoardInstallationId,
  CatalogProviderRegistration,
  ConfiguredBoardInstallation,
  ControllerProfile,
  ControllerProfileId,
} from './contracts.ts';

export class InstallationConfigurationError extends Error {
  readonly code:
    | 'duplicate-installation'
    | 'duplicate-provider'
    | 'duplicate-controller-profile'
    | 'unknown-provider'
    | 'unknown-controller-profile'
    | 'incompatible-provider'
    | 'incompatible-controller-profile'
    | 'unsupported-angle';
}

export interface InstallationCompositionOptions {
  readonly definitions: BoardDefinitionRegistry;
  readonly providers?: readonly CatalogProviderRegistration[];
  readonly controllerProfiles?: readonly ControllerProfile[];
}

export interface BoardInstallationRegistry {
  get(id: BoardInstallationId): ConfiguredBoardInstallation | undefined;
  require(id: BoardInstallationId): ConfiguredBoardInstallation;
  list(): readonly ConfiguredBoardInstallation[];
}

export function configureBoardInstallation(
  config: BoardInstallationConfig,
  options: InstallationCompositionOptions,
): ConfiguredBoardInstallation;
export function createBoardInstallationRegistry(
  configs: readonly BoardInstallationConfig[],
  options: InstallationCompositionOptions,
): BoardInstallationRegistry;
```

**Implementation Notes**:
- Build provider/profile lookup maps once, rejecting duplicate IDs before resolving
  installation configs. Definition lookup delegates to `BoardDefinitionRegistry` and
  preserves its domain-specific unknown-definition error.
- Angle must be a finite member of `definition.supportedAngles`; no rounding or
  nearest-angle inference occurs.
- A configured provider/profile is compatible only when its immutable ID list contains
  the resolved definition ID. Missing configured references and incompatibilities use
  stable error codes.
- Capability derivation is pure: `create = config.localCreation`; `control = profile
  present`; provider-backed capabilities mirror the configured provider, and absent
  providers report `not-configured`. A configured provider's false capability reports
  `not-supported`.
- Freeze copied configs, registration arrays, capability entries/map, configured
  installation objects, and registry lists so caller-owned arrays cannot mutate the
  registry after validation.

**Acceptance Criteria**:
- [ ] Unknown/duplicate/incompatible registrations and unsupported angles fail before
  a configured installation is returned or any controller factory runs.
- [ ] Fullride with local creation and a controller but no provider reports exactly
  `create/control` available and browse/publish/import/sync `not-configured`.
- [ ] A configured provider can independently enable or disable browse, publish,
  import, and sync; availability is never inferred from provider identity.
- [ ] `createController()` invokes the selected profile lazily at most once with the
  exact resolved definition, then returns the same `BoardLightController` instance.
- [ ] Registry order is deterministic by installation ID and duplicate installation
  IDs are rejected.

### Unit 3: Fullride controller profile and shipped composition

**Files**:
- `web/src/installations/fullride-controller-profile.ts`
- `web/src/app/installations.ts`
- `web/src/installations/index.ts`

```typescript
// fullride-controller-profile.ts
import type { BoardByteTransport } from '../board-control/transport.ts';
import type { ControllerProfile } from './contracts.ts';

export const FULLRIDE_CONTROLLER_PROFILE_ID: ControllerProfileId;
export function createFullrideControllerProfile(
  createTransport: () => BoardByteTransport,
): ControllerProfile;

// app/installations.ts
export const HOME_FULLRIDE_INSTALLATION_ID: BoardInstallationId;
export const homeFullrideInstallationConfig: BoardInstallationConfig;
export interface AppInstallationOptions {
  readonly createTransport?: () => BoardByteTransport;
}
export function createAppInstallationRegistry(
  options?: AppInstallationOptions,
): BoardInstallationRegistry;
export const activeInstallationId: BoardInstallationId;
```

**Implementation Notes**:
- The profile is the only new control-side seam. It declares compatibility solely
  with `kilterFullride7x10Definition.id` and delegates controller construction to
  `createFullrideLightController({ definition, transport: createTransport() })`.
- The app composition root defaults to `new WebBluetoothByteTransport(
  getBrowserBluetoothPlatform(), AURORA_WEB_BLUETOOTH_CONFIG)` while accepting an
  injected transport factory for deterministic tests. It registers no catalog provider, configures
  angle `40` as a reversible local default, enables local creation, and exports one
  active installation ID. The angle is configuration, not hidden in the definition or
  controller profile.
- Avoid eager browser resource acquisition: transport/controller construction happens
  only when `createController()` is called. Web Bluetooth device selection remains an
  explicit later user action through the controller.
- The installation barrel exports contracts, registry functions, and profile factory;
  it does not export the concrete app composition as a global service locator.

**Acceptance Criteria**:
- [ ] The shipped registry contains exactly one Fullride 7x10 installation with a
  supported angle, unrestricted local creation, an Aurora controller profile, and no
  community catalog provider.
- [ ] Constructing the app registry does not access `navigator.bluetooth`, request a
  device, connect, or allocate a transport.
- [ ] The Fullride profile rejects use with another definition through composition's
  compatibility check and creates the existing light controller for Fullride.
- [ ] Domain installation modules do not import Web Bluetooth, Kilter packet encoding,
  SQLite, React, or persistence modules.

## Implementation Order

1. **Contracts** — fix the ownership boundary and exact capability vocabulary first.
2. **Registry/composition** — validate compatibility and capability derivation against
   test doubles before concrete wiring.
3. **Fullride profile and app composition** — prove the minimal real composition over
   the already-implemented transport/controller without changing those contracts.

No child stories are spawned: all three units form one small, tightly coupled
composition boundary and should fit a single implementation stride.

## Testing

### Contract and registry tests: `web/src/installations/registry.test.ts`

- Branded constructor rejection; duplicate provider/profile/installation IDs.
- Unknown definition (delegated registry error), unknown provider/profile, incompatible
  provider/profile, unsupported/non-finite angle, and no eager controller construction.
- Exact capability matrices for no provider/no controller, mixed provider booleans,
  local creation on/off, and configured controller.
- Lazy factory receives the resolved definition at most once; repeat calls return the
  same controller double unchanged.
- Deep immutability against mutation of caller-provided configs, compatibility arrays,
  registration arrays, and returned lists/capabilities.

### Concrete composition tests: `web/src/app/installations.test.ts`

- One deterministic active Fullride entry, definition/revision identity, supported
  default angle, and expected local milestone capabilities.
- App registry construction is side-effect free; injected fake transport construction
  proves the profile wires `BoardLightController` only on demand.
- Controller smoke contract: the composed controller exposes the same state/connect/
  light/clear/preview methods; tests do not restate their behavior already covered by
  `light-controller.test.ts` and transport contract tests.

## Risks

- **Capability ambiguity**: callers may confuse configured control support with live
  browser/BLE availability. — **Fallback**: keep the two typed snapshots distinct and
  require control UI to consult both installation capabilities and
  `BoardLightController.getState().transport`.
- **Controller lifetime**: a lazily memoized controller remains alive for the lifetime
  of its configured installation. — **Fallback**: a future mutable setup/session owner
  can replace the immutable registry and explicitly disconnect the old controller;
  this milestone has one installation for the app lifetime.
- **Speculative provider metadata**: real catalog/sync consumers may need richer
  operation contracts. — **Fallback**: evolve the registration additively only after
  those consumer interfaces exist; do not encode callbacks here.
- **Default angle drift**: 40 degrees may not match the physical wall setting. —
  **Fallback**: it is an explicit app config field and can move into local settings
  when setup UI/persistence is in scope.

## Dispatch rationale

Design used direct repository inspection rather than an explore sub-agent because the
surface is bounded: the completed board-definition module and already-implemented byte
transport/light controller expose the exact contracts this feature must compose. The
feature remains a standard-weight, single-stride implementation with no UI or external
side effects.

## Implementation notes

- Execution capability: high/xhigh; the scope was cohesive and bounded, while immutable
  composition, fail-fast validation, and stateful controller lifetime warranted careful
  contract work.
- Review weight: standard, from `.work/CONVENTIONS.md` and the caller.
- Files changed: `web/src/installations/contracts.ts`,
  `web/src/installations/registry.ts`,
  `web/src/installations/fullride-controller-profile.ts`,
  `web/src/installations/index.ts`, `web/src/app/installations.ts`, and their focused
  registry/composition tests.
- Tests added/removed: added 11 tests covering identity validation, exact capability
  derivation, invalid/duplicate/incompatible composition, deep immutable copies,
  deterministic order, lazy one-shot controller construction, the shipped Fullride
  composition, and its side-effect-free app setup; removed none.
- Simplification: reused `BoardDefinitionRegistry`, `BoardLightController`, and the
  existing Fullride controller factory directly; added no provider operations, plugin
  framework, transport wrapper, persistence, or global service locator.
- Discrepancies from design: none.
- Adjacent issues parked: none.
- Verification: `npm test` (24 files, 158 tests), `npm run typecheck`, `npm run lint`,
  and `npm run build` all pass.

## Review (2026-08-02)

**Verdict**: Approve

**Blockers**: none
**Important**: none
**Nits**: none
**Rejected**: none

**Notes**: Substrate feature review at effective weight `standard`, completed in exactly
one same-harness fresh-context pass over design, implementation commit `b7724d2`, actual
board-definition and controller/transport contracts, and focused tests. The pass covered
correctness, test integrity, design/foundation alignment, public contracts, lifecycle and
failure behavior, side effects, and breaking-change risk; security, persistence/migration,
and user-facing UX lenses were inapplicable because the change adds in-process typed
composition only. Adjudication confirmed immutable copied registry boundaries, fail-fast
reference and compatibility validation, configured capability semantics distinct from live
transport state, lazy one-shot controller construction with a memoized explicit failure,
and no speculative provider operations, plugin framework, global service locator, or eager
browser/device work. No fixes or follow-up items were required. Verification passed:
focused Vitest (2 files, 11 tests), full `npm test` (27 files, 168 tests), `npm run
typecheck`, `npm run lint`, and `npm run build`.

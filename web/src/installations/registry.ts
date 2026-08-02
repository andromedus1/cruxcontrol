import type { BoardDefinitionRegistry } from '../domain/boards/registry.ts';
import type { BoardDefinitionId, ProviderId } from '../domain/boards/types.ts';
import {
  CATALOG_PROVIDER_CAPABILITIES,
  type BoardInstallationConfig,
  type BoardInstallationId,
  type CatalogProviderCapability,
  type CatalogProviderRegistration,
  type ConfiguredBoardInstallation,
  type ControllerProfile,
  type ControllerProfileId,
  type InstallationCapabilities,
} from './contracts.ts';

export type InstallationConfigurationErrorCode =
  | 'duplicate-installation'
  | 'duplicate-provider'
  | 'duplicate-controller-profile'
  | 'unknown-provider'
  | 'unknown-controller-profile'
  | 'incompatible-provider'
  | 'incompatible-controller-profile'
  | 'unsupported-angle';

export class InstallationConfigurationError extends Error {
  constructor(
    readonly code: InstallationConfigurationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'InstallationConfigurationError';
  }
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

interface CompositionLookups {
  readonly definitions: BoardDefinitionRegistry;
  readonly providers: ReadonlyMap<ProviderId, CatalogProviderRegistration>;
  readonly profiles: ReadonlyMap<ControllerProfileId, ControllerProfile>;
}

const available = () => Object.freeze({ available: true as const });
const unavailable = (reason: 'not-configured' | 'not-supported') =>
  Object.freeze({ available: false as const, reason });

function copyProvider(provider: CatalogProviderRegistration): CatalogProviderRegistration {
  const capabilities = Object.freeze(
    Object.fromEntries(
      CATALOG_PROVIDER_CAPABILITIES.map((name) => [name, provider.capabilities[name]]),
    ) as Record<CatalogProviderCapability, boolean>,
  );
  return Object.freeze({
    id: provider.id,
    compatibleDefinitionIds: Object.freeze([...provider.compatibleDefinitionIds]),
    capabilities,
  });
}

function copyProfile(profile: ControllerProfile): ControllerProfile {
  return Object.freeze({
    id: profile.id,
    compatibleDefinitionIds: Object.freeze([...profile.compatibleDefinitionIds]),
    createController: profile.createController.bind(profile),
  });
}

function uniqueMap<T extends { readonly id: K }, K>(
  values: readonly T[],
  copy: (value: T) => T,
  code: InstallationConfigurationErrorCode,
  label: string,
): ReadonlyMap<K, T> {
  const result = new Map<K, T>();
  values.forEach((value) => {
    if (result.has(value.id)) {
      throw new InstallationConfigurationError(code, `Duplicate ${label} ID: ${String(value.id)}`);
    }
    result.set(value.id, copy(value));
  });
  return result;
}

function createLookups(options: InstallationCompositionOptions): CompositionLookups {
  return {
    definitions: options.definitions,
    providers: uniqueMap(
      options.providers ?? [],
      copyProvider,
      'duplicate-provider',
      'catalog provider',
    ),
    profiles: uniqueMap(
      options.controllerProfiles ?? [],
      copyProfile,
      'duplicate-controller-profile',
      'controller profile',
    ),
  };
}

function assertCompatible(
  kind: 'provider' | 'controller-profile',
  id: string,
  compatibleDefinitionIds: readonly BoardDefinitionId[],
  definitionId: BoardDefinitionId,
): void {
  if (compatibleDefinitionIds.includes(definitionId)) return;
  const code = kind === 'provider' ? 'incompatible-provider' : 'incompatible-controller-profile';
  throw new InstallationConfigurationError(
    code,
    `${kind === 'provider' ? 'Catalog provider' : 'Controller profile'} ${id} is not compatible with board definition ${definitionId}`,
  );
}

function compose(
  sourceConfig: BoardInstallationConfig,
  lookups: CompositionLookups,
): ConfiguredBoardInstallation {
  const config = Object.freeze({ ...sourceConfig });
  const definition = lookups.definitions.require(config.definitionId);
  if (!Number.isFinite(config.angle) || !definition.supportedAngles.includes(config.angle)) {
    throw new InstallationConfigurationError(
      'unsupported-angle',
      `Board definition ${definition.id} does not support angle ${String(config.angle)}`,
    );
  }

  const provider =
    config.catalogProviderId === null
      ? null
      : (lookups.providers.get(config.catalogProviderId) ?? null);
  if (config.catalogProviderId !== null && !provider) {
    throw new InstallationConfigurationError(
      'unknown-provider',
      `Unknown catalog provider: ${config.catalogProviderId}`,
    );
  }
  if (provider)
    assertCompatible('provider', provider.id, provider.compatibleDefinitionIds, definition.id);

  const controllerProfile =
    config.controllerProfileId === null
      ? null
      : (lookups.profiles.get(config.controllerProfileId) ?? null);
  if (config.controllerProfileId !== null && !controllerProfile) {
    throw new InstallationConfigurationError(
      'unknown-controller-profile',
      `Unknown controller profile: ${config.controllerProfileId}`,
    );
  }
  if (controllerProfile)
    assertCompatible(
      'controller-profile',
      controllerProfile.id,
      controllerProfile.compatibleDefinitionIds,
      definition.id,
    );

  const providerCapability = (name: CatalogProviderCapability) =>
    provider
      ? provider.capabilities[name]
        ? available()
        : unavailable('not-supported')
      : unavailable('not-configured');
  const capabilities: InstallationCapabilities = Object.freeze({
    browse: providerCapability('browse'),
    control: controllerProfile ? available() : unavailable('not-configured'),
    create: config.localCreation ? available() : unavailable('not-supported'),
    publish: providerCapability('publish'),
    import: providerCapability('import'),
    sync: providerCapability('sync'),
  });

  let controller: ReturnType<ControllerProfile['createController']> | null = null;
  let constructionError: unknown;
  let constructionFailed = false;
  let constructed = false;
  return Object.freeze({
    config,
    definition,
    provider,
    controllerProfile,
    capabilities,
    createController() {
      if (!controllerProfile) return null;
      if (!constructed) {
        constructed = true;
        try {
          controller = controllerProfile.createController(definition);
        } catch (error) {
          constructionError = error;
          constructionFailed = true;
          throw error;
        }
      }
      if (constructionFailed) throw constructionError;
      return controller;
    },
  });
}

export function configureBoardInstallation(
  config: BoardInstallationConfig,
  options: InstallationCompositionOptions,
): ConfiguredBoardInstallation {
  return compose(config, createLookups(options));
}

export function createBoardInstallationRegistry(
  configs: readonly BoardInstallationConfig[],
  options: InstallationCompositionOptions,
): BoardInstallationRegistry {
  const lookups = createLookups(options);
  const byId = new Map<BoardInstallationId, ConfiguredBoardInstallation>();
  configs.forEach((config) => {
    if (byId.has(config.id)) {
      throw new InstallationConfigurationError(
        'duplicate-installation',
        `Duplicate board installation ID: ${config.id}`,
      );
    }
    byId.set(config.id, compose(config, lookups));
  });
  const list = Object.freeze(
    [...byId.values()].sort((a, b) => a.config.id.localeCompare(b.config.id)),
  );
  return Object.freeze({
    get: (id: BoardInstallationId) => byId.get(id),
    require: (id: BoardInstallationId) => {
      const installation = byId.get(id);
      if (!installation) throw new Error(`Unknown board installation: ${id}`);
      return installation;
    },
    list: () => list,
  });
}

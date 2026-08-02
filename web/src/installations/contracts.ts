import type { BoardLightController } from '../board-control/light-controller.ts';
import type { BoardDefinition } from '../domain/boards/definition.ts';
import type { BoardDefinitionId, Brand, ProviderId } from '../domain/boards/types.ts';

export type BoardInstallationId = Brand<string, 'BoardInstallationId'>;
export type ControllerProfileId = Brand<string, 'ControllerProfileId'>;

function nonEmpty(value: string, label: string): string {
  if (value.trim().length === 0) throw new TypeError(`${label} cannot be empty`);
  return value;
}

export const boardInstallationId = (value: string): BoardInstallationId =>
  nonEmpty(value, 'Board installation ID') as BoardInstallationId;

export const controllerProfileId = (value: string): ControllerProfileId =>
  nonEmpty(value, 'Controller profile ID') as ControllerProfileId;

export const INSTALLATION_CAPABILITIES = [
  'browse',
  'control',
  'create',
  'publish',
  'import',
  'sync',
] as const;
export type InstallationCapabilityName = (typeof INSTALLATION_CAPABILITIES)[number];
export type InstallationCapability =
  | { readonly available: true }
  | { readonly available: false; readonly reason: 'not-configured' | 'not-supported' };
export type InstallationCapabilities = Readonly<
  Record<InstallationCapabilityName, InstallationCapability>
>;

export const CATALOG_PROVIDER_CAPABILITIES = ['browse', 'publish', 'import', 'sync'] as const;
export type CatalogProviderCapability = (typeof CATALOG_PROVIDER_CAPABILITIES)[number];

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

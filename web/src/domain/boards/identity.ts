import type {
  BoardDefinitionId,
  BoardPlacementId,
  LayoutRevisionId,
  ProviderClimbId,
  ProviderClimbKey,
  ProviderId,
  ProviderSourceId,
} from './types';

function nonEmpty(value: string, label: string): string {
  if (value.trim().length === 0) throw new TypeError(`${label} cannot be empty`);
  return value;
}

export const boardDefinitionId = (value: string): BoardDefinitionId =>
  nonEmpty(value, 'Board definition ID') as BoardDefinitionId;
export const layoutRevisionId = (value: string): LayoutRevisionId =>
  nonEmpty(value, 'Layout revision ID') as LayoutRevisionId;
export const boardPlacementId = (value: string): BoardPlacementId =>
  nonEmpty(value, 'Board placement ID') as BoardPlacementId;
export const providerId = (value: string): ProviderId =>
  nonEmpty(value, 'Provider ID') as ProviderId;
export const providerSourceId = (value: string): ProviderSourceId =>
  nonEmpty(value, 'Provider source ID') as ProviderSourceId;

export function providerClimbKey(id: ProviderClimbId): ProviderClimbKey {
  const components = [id.provider, id.sourceId, id.layoutRevision];
  return components
    .map((value) => `${new TextEncoder().encode(value).length}:${value}`)
    .join('') as ProviderClimbKey;
}

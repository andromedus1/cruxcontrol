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

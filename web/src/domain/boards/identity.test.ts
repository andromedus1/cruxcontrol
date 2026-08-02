import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  boardDefinitionId,
  boardPlacementId,
  layoutRevisionId,
  providerClimbKey,
  providerId,
  providerSourceId,
} from './identity';
import type { ProviderClimbId, ProviderClimbKey } from './types';

describe('board identities', () => {
  it('rejects empty identity components', () => {
    for (const constructor of [
      boardDefinitionId,
      boardPlacementId,
      layoutRevisionId,
      providerId,
      providerSourceId,
    ]) {
      expect(() => constructor(' \n ')).toThrow(TypeError);
    }
  });

  it('builds deterministic, separator-safe, UTF-8 length-prefixed keys', () => {
    const make = (provider: string, sourceId: string, revision: string): ProviderClimbId => ({
      provider: providerId(provider),
      sourceId: providerSourceId(sourceId),
      layoutRevision: layoutRevisionId(revision),
    });
    expect(providerClimbKey(make('a', 'b:c', 'é'))).toBe(providerClimbKey(make('a', 'b:c', 'é')));
    expect(providerClimbKey(make('a', 'b:c', 'é'))).not.toBe(
      providerClimbKey(make('a:b', 'c', 'é')),
    );
    expect(providerClimbKey(make('a', 'b', 'c'))).not.toBe(providerClimbKey(make('a', 'x', 'c')));
    expectTypeOf(providerClimbKey(make('a', 'b', 'c'))).toEqualTypeOf<ProviderClimbKey>();
    expectTypeOf<string>().not.toEqualTypeOf<ProviderClimbKey>();
  });
});

import { describe, expect, it } from 'vitest';
import { kilterFullride7x10Definition } from './definitions/kilter-fullride-7x10';
import { boardDefinitionId, layoutRevisionId } from './identity';
import {
  UnknownBoardDefinitionError,
  boardDefinitions,
  createBoardDefinitionRegistry,
} from './registry';

describe('board definition registry', () => {
  it('exposes the Fullride through a stable generic boundary', () => {
    expect(boardDefinitions.list()).toEqual([kilterFullride7x10Definition]);
    expect(boardDefinitions.get(kilterFullride7x10Definition.id)).toBe(
      kilterFullride7x10Definition,
    );
    expect(boardDefinitions.require(kilterFullride7x10Definition.id)).toBe(
      kilterFullride7x10Definition,
    );
    expect(Object.isFrozen(boardDefinitions.list())).toBe(true);
  });

  it('reports unknown definitions with their typed ID', () => {
    const id = boardDefinitionId('unknown');
    expect(boardDefinitions.get(id)).toBeUndefined();
    expect(() => boardDefinitions.require(id)).toThrow(UnknownBoardDefinitionError);
    try {
      boardDefinitions.require(id);
    } catch (error) {
      expect((error as UnknownBoardDefinitionError).id).toBe(id);
    }
  });

  it('rejects duplicate IDs and revisions at construction', () => {
    expect(() =>
      createBoardDefinitionRegistry([kilterFullride7x10Definition, kilterFullride7x10Definition]),
    ).toThrow(/Duplicate board definition ID/);
    const duplicateRevision = {
      ...kilterFullride7x10Definition,
      id: boardDefinitionId('another'),
      layoutRevision: layoutRevisionId(kilterFullride7x10Definition.layoutRevision),
    };
    expect(() =>
      createBoardDefinitionRegistry([kilterFullride7x10Definition, duplicateRevision]),
    ).toThrow(/Duplicate layout revision/);
  });
});

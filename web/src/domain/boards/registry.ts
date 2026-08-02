import type { BoardDefinition } from './definition';
import type { BoardDefinitionId } from './types';
import { assertBoardDefinition } from './validate-definition';
import { kilterFullride7x10Definition } from './definitions/kilter-fullride-7x10';

export interface BoardDefinitionRegistry {
  get(id: BoardDefinitionId): BoardDefinition | undefined;
  require(id: BoardDefinitionId): BoardDefinition;
  list(): readonly BoardDefinition[];
}

export class UnknownBoardDefinitionError extends Error {
  constructor(readonly id: BoardDefinitionId) {
    super(`Unknown board definition: ${id}`);
    this.name = 'UnknownBoardDefinitionError';
  }
}

export function createBoardDefinitionRegistry(
  definitions: readonly BoardDefinition[],
): BoardDefinitionRegistry {
  const byId = new Map<BoardDefinitionId, BoardDefinition>();
  const revisions = new Set<string>();
  definitions.forEach((definition) => {
    assertBoardDefinition(definition);
    if (byId.has(definition.id))
      throw new TypeError(`Duplicate board definition ID: ${definition.id}`);
    if (revisions.has(definition.layoutRevision))
      throw new TypeError(`Duplicate layout revision: ${definition.layoutRevision}`);
    byId.set(definition.id, definition);
    revisions.add(definition.layoutRevision);
  });
  const list = Object.freeze([...byId.values()].sort((a, b) => a.id.localeCompare(b.id)));
  return Object.freeze({
    get: (id: BoardDefinitionId) => byId.get(id),
    require: (id: BoardDefinitionId) => {
      const definition = byId.get(id);
      if (!definition) throw new UnknownBoardDefinitionError(id);
      return definition;
    },
    list: () => list,
  });
}

export const boardDefinitions = createBoardDefinitionRegistry([kilterFullride7x10Definition]);

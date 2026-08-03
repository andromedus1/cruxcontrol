import type { BoardDefinition } from '../domain/boards/definition';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { suppliedEntryToCandidate } from './interpret';
import { SUPPLIED_FULLRIDE_CLIMBS } from './supplied-fullride-climbs';
import type { ScreenshotImportCandidate } from './types';

export function createSuppliedFullrideCandidates(
  definition: BoardDefinition,
): readonly ScreenshotImportCandidate[] {
  if (
    definition.id !== kilterFullride7x10Definition.id ||
    definition.layoutRevision !== kilterFullride7x10Definition.layoutRevision
  ) {
    throw new TypeError('The supplied migration requires the installed Fullride 7x10 definition.');
  }
  return Object.freeze(
    SUPPLIED_FULLRIDE_CLIMBS.map((entry) => {
      const candidate = suppliedEntryToCandidate(entry.sha256, definition);
      if (!candidate || candidate.warnings.length > 0) {
        throw new TypeError(`Could not resolve supplied climb ${entry.sourceName}.`);
      }
      return candidate;
    }),
  );
}

import fullrideSheetUrl from '../../../docs/kilter_fullride_7x10.png?url';
import type { BoardDefinition, BoardPoint } from '../domain/boards/definition';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10';

export interface BoardRasterArtwork {
  readonly href: string;
  readonly source: Readonly<{
    width: 1126;
    height: 1584;
    sha256: 'a1e17430dd42eb7c81021834405a87d5a90bf9d14bca9af408553380f0a00bb0';
  }>;
  readonly imageBox: Readonly<{ x: number; y: number; width: number; height: number }>;
}

const fullrideArtwork: BoardRasterArtwork = Object.freeze({
  href: fullrideSheetUrl,
  source: Object.freeze({
    width: 1126,
    height: 1584,
    sha256: 'a1e17430dd42eb7c81021834405a87d5a90bf9d14bca9af408553380f0a00bb0',
  }),
  imageBox: Object.freeze({ x: 3.18, y: -0.65, width: 89.39, height: 125.24 }),
});

export function fullrideSheetCell(
  position: BoardPoint,
): Readonly<{ column: number; row: number }> {
  const column = (position.x + 40) / 4;
  const row = (140 - position.y) / 4;
  if (
    !Number.isInteger(column) ||
    !Number.isInteger(row) ||
    column < 0 ||
    column > 20 ||
    row < 0 ||
    row > 28 ||
    column % 2 !== row % 2
  ) {
    throw new RangeError(`Point (${position.x}, ${position.y}) is not a Fullride sheet cell`);
  }
  return Object.freeze({ column, row });
}

export function resolveBoardRasterArtwork(
  definition: BoardDefinition,
): BoardRasterArtwork | null {
  return definition.id === kilterFullride7x10Definition.id &&
    definition.layoutRevision === kilterFullride7x10Definition.layoutRevision
    ? fullrideArtwork
    : null;
}

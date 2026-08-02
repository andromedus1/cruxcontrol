import { boardDefinitionId, layoutRevisionId } from '../domain/boards/identity';
import { kilterFullride7x10Definition as fullride } from '../domain/boards/definitions/kilter-fullride-7x10';
import { fullrideSheetCell, resolveBoardRasterArtwork } from './fullride-private-artwork';

describe('private Fullride raster artwork', () => {
  it('maps all 305 placements uniquely onto the complete parity lattice', () => {
    const actual = new Set(
      fullride.placements.map(({ position }) => {
        const { column, row } = fullrideSheetCell(position);
        return `${column}:${row}`;
      }),
    );
    const expected = new Set<string>();
    for (let column = 0; column <= 20; column += 1) {
      for (let row = 0; row <= 28; row += 1) {
        if (column % 2 === row % 2) expected.add(`${column}:${row}`);
      }
    }
    expect(actual).toEqual(expected);
    expect(actual).toHaveLength(305);
  });

  it.each([
    { x: -38, y: 140 },
    { x: -40, y: 138 },
    { x: -44, y: 140 },
    { x: 44, y: 140 },
    { x: -40, y: 144 },
    { x: -40, y: 20 },
  ])('rejects invalid point $x,$y', (position) => {
    expect(() => fullrideSheetCell(position)).toThrow(RangeError);
  });

  it('resolves only the exact definition identity and revision', () => {
    const artwork = resolveBoardRasterArtwork(fullride);
    expect(artwork).toMatchObject({
      href: expect.stringMatching(/kilter_fullride_7x10\.png|^data:image\/png/),
      source: {
        width: 1126,
        height: 1584,
        sha256: 'a1e17430dd42eb7c81021834405a87d5a90bf9d14bca9af408553380f0a00bb0',
      },
      imageBox: { x: 3.18, y: -0.65, width: 89.39, height: 125.24 },
    });
    expect(
      resolveBoardRasterArtwork({ ...fullride, id: boardDefinitionId('synthetic-board') }),
    ).toBeNull();
    expect(
      resolveBoardRasterArtwork({ ...fullride, layoutRevision: layoutRevisionId('other-revision') }),
    ).toBeNull();
  });

  it('keeps fitted source anchors aligned without changing domain centers', () => {
    const centersBefore = JSON.stringify(fullride.placements.map(({ position }) => position));
    const artwork = resolveBoardRasterArtwork(fullride)!;
    const sourceCenter = (column: number, row: number) => ({
      x: 60.69 + 50.387 * column,
      y: 109.4 + 50.592 * row,
    });
    for (const [column, row] of [
      [0, 0],
      [10, 14],
      [20, 28],
    ] as const) {
      const source = sourceCenter(column, row);
      const mapped = {
        x: artwork.imageBox.x + (source.x / artwork.source.width) * artwork.imageBox.width,
        y: artwork.imageBox.y + (source.y / artwork.source.height) * artwork.imageBox.height,
      };
      expect(mapped.x).toBeCloseTo(8 + 4 * column, 2);
      expect(mapped.y).toBeCloseTo(8 + 4 * row, 2);
    }
    expect(JSON.stringify(fullride.placements.map(({ position }) => position))).toBe(centersBefore);
  });
});

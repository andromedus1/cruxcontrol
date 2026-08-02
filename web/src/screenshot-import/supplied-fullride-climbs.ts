import type { BoardDefinition, ClimbRole } from '../domain/boards/definition';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import type { SuppliedFullrideClimb, SuppliedRingFact } from './types';

const r = (role: ClimbRole, ...cells: readonly (readonly [number, number])[]) =>
  cells.map(([column, row]) => ({ column, row, role }));

const entries: readonly SuppliedFullrideClimb[] = [
  {
    sha256: '733b75155df47f08f9017ceb05a1b4dae53aa18bc961cd8d7f4a4cc7c554a595',
    sourceName: 'Screenshot_20260802-141530.png',
    name: 'Figure 5-?',
    rings: [
      ...r('finish', [12, 0]),
      ...r('middle', [19, 3], [17, 5], [20, 12], [16, 14], [14, 16]),
      ...r('foot-only', [10, 14]),
      ...r('start', [8, 18], [12, 18]),
    ],
  },
  {
    sha256: 'e9f9551469e9597009f6eaed247a65f894d20477d4c8d6a7cc45614fe31fd991',
    sourceName: 'Screenshot_20260802-141604.png',
    name: 'Wake up, matt 4',
    rings: [
      ...r('finish', [16, 0]),
      ...r('middle', [11, 3], [6, 8], [10, 8]),
      ...r('start', [0, 12], [6, 12]),
      ...r('foot-only', [0, 26], [6, 26]),
    ],
  },
  {
    sha256: 'cfa74d84937249c61b410ca467e9a7075a503ff3e0ca52f404bb4b813c8a76b6',
    sourceName: 'Screenshot_20260802-141623.png',
    name: 'Vampiric tutor 5-?',
    rings: [
      ...r('finish', [8, 0]),
      ...r('middle', [7, 5], [13, 9]),
      ...r('start', [6, 14], [11, 19]),
      ...r('foot-only', [17, 19], [1, 23]),
    ],
  },
  {
    sha256: '5a5ab98ff3b340556728e23b4fc448644d6e29d9dde220263b51c6fcdbaebb9b',
    sourceName: 'Screenshot_20260802-141642.png',
    name: 'Acid day dream 5',
    rings: [
      ...r('finish', [8, 0]),
      ...r('middle', [16, 2], [12, 8]),
      ...r('start', [15, 11], [9, 13]),
      ...r('foot-only', [5, 19], [7, 19], [7, 21], [9, 23], [20, 24], [19, 25], [9, 27]),
    ],
  },
  {
    sha256: '1696c361dea0a9b1781e2b6fdd697d3089b1c5d36fb1592efb5d12d2e05c3f29',
    sourceName: 'Screenshot_20260802-141701.png',
    name: 'Eye of the storm 2',
    rings: [
      ...r('finish', [6, 0]),
      ...r('middle', [2, 4], [6, 6], [6, 8], [10, 8], [14, 12], [10, 14]),
      ...r('foot-only', [6, 16], [0, 18], [10, 22], [16, 22], [20, 26], [10, 28]),
      ...r('start', [12, 18], [20, 18]),
    ],
  },
  {
    sha256: 'bda4ccebcc8297c586c1a449a7c6cb5d3f16150cabaf4bc10fa57bcb8cb02342',
    sourceName: 'Screenshot_20260802-141712.png',
    name: 'Dark ritual 5',
    rings: [
      ...r('finish', [10, 0]),
      ...r('middle', [14, 6], [18, 8], [14, 16]),
      ...r('start', [10, 14], [8, 20]),
      ...r('foot-only', [3, 15]),
    ],
  },
  {
    sha256: 'd53125e1a7b0e6da1e33aedccc80dcc05f18603e1e858b5c0dbae80492eb4bb8',
    sourceName: 'Screenshot_20260802-141724.png',
    name: 'Zaddy pinch 6?',
    rings: [
      ...r('finish', [11, 1], [5, 5]),
      ...r('middle', [11, 5], [6, 10], [16, 10], [12, 14]),
      ...r('start', [15, 19], [20, 18]),
      ...r('foot-only', [11, 27], [19, 27]),
    ],
  },
  {
    sha256: '85971a482ee958cd3d34f4d71fee662900a80c9510b593d0b28058ecf7104352',
    sourceName: 'Screenshot_20260802-141744.png',
    name: 'Loop lord 0',
    rings: [
      ...r('middle', [8, 12], [14, 12]),
      ...r('start', [10, 14], [10, 18]),
      ...r('finish', [6, 20], [16, 20]),
      ...r('foot-only', [0, 26], [6, 26], [14, 26], [20, 26]),
    ],
  },
  {
    sha256: '79059697e3255c94951cb17c3122bbbaca07ee8412b84434d40d74fbd1a220dd',
    sourceName: 'Screenshot_20260802-141809.png',
    name: 'Idk ok',
    rings: [
      ...r('finish', [14, 0]),
      ...r('middle', [16, 4], [8, 6], [11, 9]),
      ...r('start', [19, 9], [15, 15]),
      ...r('foot-only', [15, 23]),
    ],
  },
  {
    sha256: 'e23025168d368c1b14d71876f7444dd256be3c6ac2c8723190d235f7b8d063aa',
    sourceName: 'Screenshot_20260802-141819.png',
    name: '“do a kick flip” 4+',
    rings: [
      ...r('finish', [8, 0]),
      ...r('middle', [13, 3], [12, 8], [19, 9]),
      ...r('start', [14, 16], [16, 18]),
      ...r('foot-only', [20, 24]),
    ],
  },
  {
    sha256: 'c6d9b218f7427c62154e11b9a7cc25373159319047ac3a999e07d12209c4e7b7',
    sourceName: 'Screenshot_20260802-141834.png',
    name: 'Bird claw 6',
    rings: [
      ...r('finish', [11, 1], [8, 2]),
      ...r('middle', [17, 5], [17, 11], [12, 12]),
      ...r('start', [7, 15], [19, 17]),
      ...r('foot-only', [20, 24], [8, 28]),
    ],
  },
  {
    sha256: 'a1d4c503b8127da1499e3b4493de9a902e16ecea029d02388261a3aef38614fd',
    sourceName: 'Screenshot_20260802-141845.png',
    name: 'Robusto 6',
    rings: [
      ...r('finish', [10, 0]),
      ...r('middle', [10, 8], [4, 10], [10, 14], [6, 16]),
      ...r('start', [0, 18], [8, 18]),
      ...r('foot-only', [3, 27], [9, 27]),
    ],
  },
  {
    sha256: '2541174aa16ca85dd30c37acbcbc99653f2e974bb40e3b9255f9ff7433d9b465',
    sourceName: 'Screenshot_20260802-141855.png',
    name: 'Sewer type flow 6?',
    rings: [
      ...r('finish', [4, 0]),
      ...r('middle', [1, 3], [8, 6], [2, 8], [4, 12]),
      ...r('start', [3, 15], [8, 20]),
      ...r('foot-only', [1, 21], [11, 27], [0, 28]),
    ],
  },
  {
    sha256: 'b364174b9564cfc123c717100b2c21c1fa1df7a34b2a6d4d3e5bb3949fb182e6',
    sourceName: 'Screenshot_20260802-141907.png',
    name: 'Lil shitterz 6',
    rings: [
      ...r('finish', [4, 0]),
      ...r('middle', [7, 3], [3, 7], [9, 9], [7, 13], [13, 15]),
      ...r('start', [9, 19], [11, 19]),
      ...r('foot-only', [1, 21], [15, 23], [7, 27], [15, 27]),
    ],
  },
  {
    sha256: '0002dd4c29f4c4ef5f4e2ca1ae74f09b46897ede69f2177c235abe943b9f3ae3',
    sourceName: 'Screenshot_20260802-141921.png',
    name: 'Bizz rizz 4',
    rings: [
      ...r('finish', [10, 0]),
      ...r('middle', [4, 6], [0, 12], [6, 12], [6, 16]),
      ...r('start', [0, 18], [4, 22]),
      ...r('foot-only', [1, 21], [7, 27], [2, 28]),
    ],
  },
  {
    sha256: 'df0458289b62c67dc127d700f1e39b9266dc717377fc56a469aa22f78e3489ca',
    sourceName: 'Screenshot_20260802-141932.png',
    name: 'Chinchiller 3',
    rings: [
      ...r('finish', [10, 0]),
      ...r('middle', [14, 6], [10, 8], [14, 12], [10, 14], [14, 16]),
      ...r('start', [20, 18], [16, 22]),
      ...r('foot-only', [20, 26], [16, 28]),
    ],
  },
];

function placementCount(definition: BoardDefinition, fact: SuppliedRingFact): number {
  const x = -40 + fact.column * 4;
  const y = 140 - fact.row * 4;
  return definition.placements.filter(
    (placement) => placement.position.x === x && placement.position.y === y,
  ).length;
}

function validateManifest(
  manifest: readonly SuppliedFullrideClimb[],
  definition: BoardDefinition,
): void {
  const validRoles = new Set<ClimbRole>(['start', 'middle', 'finish', 'foot-only']);
  if (manifest.length !== 16)
    throw new TypeError('Supplied screenshot manifest must contain 16 entries');
  const hashes = new Set<string>();
  const sources = new Set<string>();
  const names = new Set<string>();
  for (const entry of manifest) {
    if (!/^[0-9a-f]{64}$/.test(entry.sha256))
      throw new TypeError(`Invalid SHA-256 for ${entry.sourceName}`);
    if (hashes.has(entry.sha256) || sources.has(entry.sourceName) || names.has(entry.name))
      throw new TypeError(`Duplicate supplied screenshot identity: ${entry.sourceName}`);
    hashes.add(entry.sha256);
    sources.add(entry.sourceName);
    names.add(entry.name);
    if (entry.sourceName.length === 0 || entry.name.length === 0)
      throw new TypeError('Supplied screenshot source and visible title must not be empty');
    if (entry.rings.length < 7 || entry.rings.length > 15)
      throw new TypeError(`Unexpected ring count for ${entry.sourceName}`);
    const cells = new Set<string>();
    for (const fact of entry.rings) {
      const key = `${fact.column}:${fact.row}`;
      if (
        fact.column < 0 ||
        fact.column > 20 ||
        fact.row < 0 ||
        fact.row > 28 ||
        fact.column % 2 !== fact.row % 2 ||
        !validRoles.has(fact.role) ||
        cells.has(key) ||
        placementCount(definition, fact) !== 1
      )
        throw new TypeError(`Invalid ring fact ${key} for ${entry.sourceName}`);
      cells.add(key);
    }
  }
}

validateManifest(entries, kilterFullride7x10Definition);

export const SUPPLIED_FULLRIDE_CLIMBS: readonly SuppliedFullrideClimb[] = Object.freeze(
  entries.map((entry) =>
    Object.freeze({
      ...entry,
      rings: Object.freeze(entry.rings.map((ring) => Object.freeze(ring))),
    }),
  ),
);

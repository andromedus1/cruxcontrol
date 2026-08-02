import { describe, expect, it } from 'vitest';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { interpretKilterScreenshot, suppliedEntryToCandidate } from './interpret';
import { SUPPLIED_FULLRIDE_CLIMBS } from './supplied-fullride-climbs';

describe('supplied Fullride screenshot facts', () => {
  it('locks exactly 16 immutable, unique, pixel-free entries with verified ring counts', () => {
    expect(SUPPLIED_FULLRIDE_CLIMBS).toHaveLength(16);
    expect(new Set(SUPPLIED_FULLRIDE_CLIMBS.map((entry) => entry.sha256))).toHaveLength(16);
    expect(new Set(SUPPLIED_FULLRIDE_CLIMBS.map((entry) => entry.sourceName))).toHaveLength(16);
    expect(new Set(SUPPLIED_FULLRIDE_CLIMBS.map((entry) => entry.name))).toHaveLength(16);
    expect(SUPPLIED_FULLRIDE_CLIMBS.map((entry) => [entry.name, entry.rings.length])).toEqual([
      ['Figure 5-?', 9],
      ['Wake up, matt 4', 8],
      ['Vampiric tutor 5-?', 7],
      ['Acid day dream 5', 12],
      ['Eye of the storm 2', 15],
      ['Dark ritual 5', 7],
      ['Zaddy pinch 6?', 10],
      ['Loop lord 0', 10],
      ['Idk ok', 7],
      ['"do a kick flip" 4+', 7],
      ['Bird claw 6', 9],
      ['Robusto 6', 9],
      ['Sewer type flow 6?', 10],
      ['Lil shitterz 6', 12],
      ['Bizz rizz 4', 10],
      ['Chinchiller 3', 10],
    ]);
    expect(JSON.stringify(SUPPLIED_FULLRIDE_CLIMBS)).not.toMatch(/data:image|\.png"\s*:/);
    expect(Object.isFrozen(SUPPLIED_FULLRIDE_CLIMBS[0].rings[0])).toBe(true);
    expect(SUPPLIED_FULLRIDE_CLIMBS.map((entry) => entry.sha256)).toEqual([
      '733b75155df47f08f9017ceb05a1b4dae53aa18bc961cd8d7f4a4cc7c554a595',
      'e9f9551469e9597009f6eaed247a65f894d20477d4c8d6a7cc45614fe31fd991',
      'cfa74d84937249c61b410ca467e9a7075a503ff3e0ca52f404bb4b813c8a76b6',
      '5a5ab98ff3b340556728e23b4fc448644d6e29d9dde220263b51c6fcdbaebb9b',
      '1696c361dea0a9b1781e2b6fdd697d3089b1c5d36fb1592efb5d12d2e05c3f29',
      'bda4ccebcc8297c586c1a449a7c6cb5d3f16150cabaf4bc10fa57bcb8cb02342',
      'd53125e1a7b0e6da1e33aedccc80dcc05f18603e1e858b5c0dbae80492eb4bb8',
      '85971a482ee958cd3d34f4d71fee662900a80c9510b593d0b28058ecf7104352',
      '79059697e3255c94951cb17c3122bbbaca07ee8412b84434d40d74fbd1a220dd',
      'e23025168d368c1b14d71876f7444dd256be3c6ac2c8723190d235f7b8d063aa',
      'c6d9b218f7427c62154e11b9a7cc25373159319047ac3a999e07d12209c4e7b7',
      'a1d4c503b8127da1499e3b4493de9a902e16ecea029d02388261a3aef38614fd',
      '2541174aa16ca85dd30c37acbcbc99653f2e974bb40e3b9255f9ff7433d9b465',
      'b364174b9564cfc123c717100b2c21c1fa1df7a34b2a6d4d3e5bb3949fb182e6',
      '0002dd4c29f4c4ef5f4e2ca1ae74f09b46897ede69f2177c235abe943b9f3ae3',
      'df0458289b62c67dc127d700f1e39b9266dc717377fc56a469aa22f78e3489ca',
    ]);
    expect(
      SUPPLIED_FULLRIDE_CLIMBS.map((entry) =>
        entry.rings.map((ring) => `${ring.role}:${ring.column},${ring.row}`).join(' '),
      ),
    ).toEqual([
      'finish:12,0 middle:19,3 middle:17,5 middle:20,12 middle:16,14 middle:14,16 foot-only:10,14 start:8,18 start:12,18',
      'finish:16,0 middle:11,3 middle:6,8 middle:10,8 start:0,12 start:6,12 foot-only:0,26 foot-only:6,26',
      'finish:8,0 middle:7,5 middle:13,9 start:6,14 start:11,19 foot-only:17,19 foot-only:1,23',
      'finish:8,0 middle:16,2 middle:12,8 start:15,11 start:9,13 foot-only:5,19 foot-only:7,19 foot-only:7,21 foot-only:9,23 foot-only:20,24 foot-only:19,25 foot-only:9,27',
      'finish:6,0 middle:2,4 middle:6,6 middle:6,8 middle:10,8 middle:14,12 middle:10,14 foot-only:6,16 foot-only:0,18 foot-only:10,22 foot-only:16,22 foot-only:20,26 foot-only:10,28 start:12,18 start:20,18',
      'finish:10,0 middle:14,6 middle:18,8 middle:14,16 start:10,14 start:8,20 foot-only:3,15',
      'finish:11,1 finish:5,5 middle:11,5 middle:6,10 middle:16,10 middle:12,14 start:15,19 start:20,18 foot-only:11,27 foot-only:19,27',
      'middle:8,12 middle:14,12 start:10,14 start:10,18 finish:6,20 finish:16,20 foot-only:0,26 foot-only:6,26 foot-only:14,26 foot-only:20,26',
      'finish:14,0 middle:16,4 middle:8,6 middle:11,9 start:19,9 start:15,15 foot-only:15,23',
      'finish:8,0 middle:13,3 middle:12,8 middle:19,9 start:14,16 start:16,18 foot-only:20,24',
      'finish:11,1 finish:8,2 middle:17,5 middle:17,11 middle:12,12 start:7,15 start:19,17 foot-only:20,24 foot-only:8,28',
      'finish:10,0 middle:10,8 middle:4,10 middle:10,14 middle:6,16 start:0,18 start:8,18 foot-only:3,27 foot-only:9,27',
      'finish:4,0 middle:1,3 middle:8,6 middle:2,8 middle:4,12 start:3,15 start:8,20 foot-only:1,21 foot-only:11,27 foot-only:0,28',
      'finish:4,0 middle:7,3 middle:3,7 middle:9,9 middle:7,13 middle:13,15 start:9,19 start:11,19 foot-only:1,21 foot-only:15,23 foot-only:7,27 foot-only:15,27',
      'finish:10,0 middle:4,6 middle:0,12 middle:6,12 middle:6,16 start:0,18 start:4,22 foot-only:1,21 foot-only:7,27 foot-only:2,28',
      'finish:10,0 middle:14,6 middle:10,8 middle:14,12 middle:10,14 middle:14,16 start:20,18 start:16,22 foot-only:20,26 foot-only:16,28',
    ]);
  });

  it('resolves every fact through definition coordinates without manifest placement IDs', () => {
    for (const entry of SUPPLIED_FULLRIDE_CLIMBS) {
      const candidate = suppliedEntryToCandidate(entry.sha256, kilterFullride7x10Definition);
      expect(candidate?.name).toBe(entry.name);
      expect(candidate?.warnings).toEqual([]);
      expect(candidate?.assignments).toHaveLength(entry.rings.length);
      for (const [index, fact] of entry.rings.entries()) {
        const assignment = candidate?.assignments[index];
        const placement = kilterFullride7x10Definition.placements.find(
          (item) => item.id === assignment?.placementId,
        );
        expect(placement?.position).toEqual({ x: -40 + fact.column * 4, y: 140 - fact.row * 4 });
        expect(assignment?.appearance).toEqual({ kind: 'role', role: fact.role });
      }
    }
  });

  it('uses supplied facts for known checksums and requires title confirmation for unknown input', () => {
    const known = SUPPLIED_FULLRIDE_CLIMBS[0];
    const knownCandidate = interpretKilterScreenshot({
      fileName: 'renamed.png',
      sha256: known.sha256,
      pixels: { width: 1, height: 1, data: new Uint8ClampedArray(4) },
      definition: kilterFullride7x10Definition,
    });
    expect(knownCandidate.name).toBe('Figure 5-?');
    expect(knownCandidate.sourceName).toBe(known.sourceName);

    const unknownCandidate = interpretKilterScreenshot({
      fileName: 'future.png',
      sha256: 'f'.repeat(64),
      pixels: { width: 600, height: 600, data: new Uint8ClampedArray(4) },
      definition: kilterFullride7x10Definition,
    });
    expect(unknownCandidate.name).toBe('');
    expect(unknownCandidate.warnings.map((warning) => warning.code)).toEqual([
      'unsupported-profile',
      'title-required',
    ]);
  });
});

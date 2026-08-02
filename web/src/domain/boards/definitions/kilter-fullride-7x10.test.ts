import { describe, expect, it } from 'vitest';
import { apiLevel3ColorHex } from '../colors';
import { assertBoardDefinition } from '../validate-definition';
import { generatedKilterFullride7x10 as generated } from './kilter-fullride-7x10.generated';
import {
  KILTER_FULLRIDE_7X10_PROVENANCE,
  KILTER_FULLRIDE_7X10_REVISION,
  KILTER_PROVIDER_ID,
  kilterFullride7x10Definition as definition,
} from './kilter-fullride-7x10';

describe('Kilter Fullride 7x10 definition', () => {
  it('matches committed source and projection provenance', () => {
    expect(() => assertBoardDefinition(definition)).not.toThrow();
    expect(KILTER_PROVIDER_ID).toBe('kilter');
    expect(KILTER_FULLRIDE_7X10_REVISION).toBe('kilter:7:8:17:f0d70b3db9a6');
    expect(KILTER_FULLRIDE_7X10_PROVENANCE).toMatchObject({
      sourceSha256: '32b2663c7e699708dc3983d6acf8eff5dd8d458530c680c50ce7f6719c61235f',
      definitionSha256: 'f0d70b3db9a607ca3929aac3a091b09ead9ea7d02451362a57073e699b849785',
      totalScoped: 472,
      emitted: 305,
      excluded: 167,
      emittedBySet: { 26: 165, 27: 140 },
      excludedBySet: { 26: 69, 27: 98 },
    });
  });

  it('contains the complete verified controllable placement map', () => {
    expect(definition.bounds).toEqual({ left: -44, right: 44, bottom: 24, top: 144 });
    expect(definition.supportedAngles).toEqual(Array.from({ length: 15 }, (_, index) => index * 5));
    expect(definition.placements).toHaveLength(305);
    for (const key of [
      'id',
      'native.placementId',
      'native.holeId',
      'native.ledPosition',
    ] as const) {
      const values = definition.placements.map((placement) =>
        key === 'id'
          ? placement.id
          : key === 'native.placementId'
            ? placement.native.placementId
            : key === 'native.holeId'
              ? placement.native.holeId
              : placement.native.ledPosition,
      );
      expect(new Set(values).size).toBe(305);
    }
    expect(definition.placements[0]).toMatchObject({
      position: { x: -40, y: 28 },
      native: { setId: '26', placementId: '4117', holeId: '3698', ledPosition: 0 },
    });
    expect(
      definition.placements.filter((placement) => placement.native.setId === '27'),
    ).toHaveLength(140);
    expect(definition.placements.some((placement) => placement.position.y >= 136)).toBe(true);
  });

  it('derives four semantics while preserving native role records and colors', () => {
    expect(generated.roles.map((role) => [role.semantic, role.sourceId, role.ledColor])).toEqual([
      ['start', 42, '00FF00'],
      ['middle', 43, '00FFFF'],
      ['finish', 44, 'FF00FF'],
      ['foot-only', 45, 'FFA500'],
    ]);
    expect(Object.keys(definition.rolePresets)).toEqual(['start', 'middle', 'finish', 'foot-only']);
    expect(apiLevel3ColorHex(definition.rolePresets.start.lightColor)).toBe('#00ff00');
    expect(definition.rolePresets.middle.label).toContain('Blue');
    expect(definition.rolePresets.finish.label).toContain('Red/Pink');
    expect(definition.rolePresets['foot-only'].label).toContain('Gold/Yellow');
  });

  it('is deeply immutable at runtime', () => {
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.placements)).toBe(true);
    expect(Object.isFrozen(definition.placements[0].native)).toBe(true);
    expect(() => {
      (definition.bounds as { left: number }).left = 0;
    }).toThrow(TypeError);
  });
});

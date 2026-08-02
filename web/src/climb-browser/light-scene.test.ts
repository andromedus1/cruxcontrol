import { describe, expect, it } from 'vitest';
import { boardPlacementId } from '../domain/boards/identity';
import { kilterFullride7x10Definition as definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { lightSceneFromAssignments } from './light-scene';
import { climbViewKey } from './types';

describe('climb browser read model', () => {
  it('requires an opaque non-empty view key', () => {
    expect(climbViewKey('local:route-1')).toBe('local:route-1');
    expect(() => climbViewKey('  ')).toThrow('must not be empty');
  });

  it('maps every role and preserves custom hardware colors in input order', () => {
    const placements = definition.placements.slice(0, 5);
    const assignments = [
      { placementId: placements[0].id, appearance: { kind: 'role' as const, role: 'start' as const } },
      { placementId: placements[1].id, appearance: { kind: 'role' as const, role: 'middle' as const } },
      { placementId: placements[2].id, appearance: { kind: 'role' as const, role: 'finish' as const } },
      { placementId: placements[3].id, appearance: { kind: 'role' as const, role: 'foot-only' as const } },
      { placementId: placements[4].id, appearance: { kind: 'custom' as const, color: 255 as never } },
    ];
    const scene = lightSceneFromAssignments(definition, assignments);
    expect(scene.map(({ color }) => color)).toEqual([
      definition.rolePresets.start.lightColor,
      definition.rolePresets.middle.lightColor,
      definition.rolePresets.finish.lightColor,
      definition.rolePresets['foot-only'].lightColor,
      255,
    ]);
    expect(Object.isFrozen(scene)).toBe(true);
    expect(Object.isFrozen(scene[0])).toBe(true);
  });

  it('accepts empty scenes and rejects duplicate or unknown placements', () => {
    expect(lightSceneFromAssignments(definition, [])).toEqual([]);
    const assignment = { placementId: definition.placements[0].id, appearance: { kind: 'custom' as const, color: 0 as never } };
    expect(() => lightSceneFromAssignments(definition, [assignment, assignment])).toThrow('duplicates');
    expect(() => lightSceneFromAssignments(definition, [{ ...assignment, placementId: boardPlacementId('missing') }])).toThrow('unknown');
  });
});

import { apiLevel3Color } from '../domain/boards/colors';
import { boardPlacementId } from '../domain/boards/identity';
import { kilterFullride7x10Definition as fullride } from '../domain/boards/definitions/kilter-fullride-7x10';
import { createAssignmentIndex } from './scene';

describe('renderer scenes', () => {
  it('accepts empty, unconventional, and custom assignments without mutating input', () => {
    expect(createAssignmentIndex(fullride, [])).toHaveLength(0);
    const assignments = fullride.placements.map((placement, index) => ({
      placementId: placement.id,
      appearance: { kind: 'custom' as const, color: apiLevel3Color(index % 256) },
    }));
    expect(createAssignmentIndex(fullride, assignments)).toHaveLength(305);
    expect(assignments[0].appearance.color).toBe(apiLevel3Color(0));
  });

  it('fails fast on duplicate and unknown placements', () => {
    const assignment = {
      placementId: fullride.placements[0].id,
      appearance: { kind: 'role' as const, role: 'start' as const },
    };
    expect(() => createAssignmentIndex(fullride, [assignment, assignment])).toThrow(/duplicates/);
    expect(() =>
      createAssignmentIndex(fullride, [
        { ...assignment, placementId: boardPlacementId('missing') },
      ]),
    ).toThrow(/unknown/);
  });
});

import { describe, expect, it } from 'vitest';
import { lightEffectGroupId, type BoardHoldAssignment, type LightEffectGroup } from '../board-renderer/types';
import { apiLevel3Color } from '../domain/boards/colors';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { renderAnimationFrame } from './frame';

const [first, second, third] = kilterFullride7x10Definition.placements;
const groupId = lightEffectGroupId('group-a');
const red = apiLevel3Color(0b111_000_00);
const green = apiLevel3Color(0b000_111_00);
const blue = apiLevel3Color(0b000_000_11);
const white = apiLevel3Color(0xff);
const black = apiLevel3Color(0);

function assignment(
  placementId: typeof first.id,
  color = white,
  effectGroupId = groupId,
): BoardHoldAssignment {
  return { placementId, appearance: { kind: 'custom', color }, effectGroupId };
}

function group(overrides: Partial<Extract<LightEffectGroup, { model?: 'assigned' }>> = {}): LightEffectGroup {
  return {
    id: groupId,
    kind: 'pulse',
    palette: [red, blue],
    periodMs: 1000,
    intensity: 1,
    ...overrides,
  };
}

function colors(
  assignments: readonly BoardHoldAssignment[],
  effectGroups: readonly LightEffectGroup[],
  elapsedMs: number,
) {
  return renderAnimationFrame({
    definition: kilterFullride7x10Definition,
    assignments,
    effectGroups,
    elapsedMs,
  }).map(({ color }) => color);
}

describe('renderAnimationFrame', () => {
  it('keeps static holds exact and preserves assignment order', () => {
    const assignments: readonly BoardHoldAssignment[] = [
      { placementId: third.id, appearance: { kind: 'custom', color: red } },
      { placementId: first.id, appearance: { kind: 'role', role: 'start' } },
    ];
    expect(renderAnimationFrame({
      definition: kilterFullride7x10Definition,
      assignments,
      effectGroups: [],
      elapsedMs: 9000,
    })).toEqual([
      { placementId: third.id, color: red },
      { placementId: first.id, color: kilterFullride7x10Definition.rolePresets.start.lightColor },
    ]);
  });

  it('pulses from full base color to black and wraps exactly', () => {
    const assignments = [assignment(first.id, white)];
    expect(colors(assignments, [group()], 0)).toEqual([white]);
    expect(colors(assignments, [group()], 500)).toEqual([black]);
    expect(colors(assignments, [group()], 1000)).toEqual([white]);
  });

  it('cycles smoothly through a palette and wraps', () => {
    const effect = group({ kind: 'color-cycle', palette: [red, green, blue] });
    const assignments = [assignment(first.id, black)];
    expect(colors(assignments, [effect], 0)).toEqual([red]);
    expect(colors(assignments, [effect], 1000 / 3)).toEqual([green]);
    expect(colors(assignments, [effect], 2000 / 3)).toEqual([blue]);
    expect(colors(assignments, [effect], 1000)).toEqual([red]);
  });

  it('phases a wave by physical horizontal position', () => {
    const effect = group({ kind: 'wave', palette: [red, blue] });
    const left = kilterFullride7x10Definition.placements.reduce((best, placement) =>
      placement.position.x < best.position.x ? placement : best,
    );
    const right = kilterFullride7x10Definition.placements.reduce((best, placement) =>
      placement.position.x > best.position.x ? placement : best,
    );
    const result = colors([assignment(left.id), assignment(right.id)], [effect], 0);
    expect(result[0]).toBe(red);
    expect(result[1]).toBe(red);
    expect(colors([assignment(left.id)], [effect], 500)[0]).toBe(blue);
  });

  it('twinkles deterministically per placement', () => {
    const effect = group({ kind: 'twinkle' });
    const assignments = [assignment(first.id), assignment(second.id), assignment(third.id)];
    const initial = colors(assignments, [effect], 375);
    expect(colors(assignments, [effect], 375)).toEqual(initial);
    expect(new Set(initial).size).toBeGreaterThan(1);
  });

  it('alternates stable placement parity at opposite pulse phases', () => {
    const effect = group({ kind: 'alternate' });
    const assignments = [assignment(first.id), assignment(second.id), assignment(third.id)];
    expect(colors(assignments, [effect], 0)).toEqual([white, black, white]);
    expect(colors(assignments, [effect], 500)).toEqual([black, white, black]);
  });

  it('handles empty and one-color palettes and blends partial intensity', () => {
    const assignments = [assignment(first.id, blue)];
    expect(colors(assignments, [group({ kind: 'color-cycle', palette: [] })], 400)).toEqual([blue]);
    expect(colors(assignments, [group({ kind: 'color-cycle', palette: [red] })], 400)).toEqual([red]);
    const halfway = colors(
      assignments,
      [group({ kind: 'color-cycle', palette: [red], intensity: 0.5 })],
      0,
    )[0]!;
    expect(halfway).not.toBe(red);
    expect(halfway).not.toBe(blue);
  });

  it('rejects non-finite elapsed time and ignores missing effect groups safely', () => {
    expect(() => colors([assignment(first.id)], [group()], Number.NaN)).toThrow(RangeError);
    expect(colors([assignment(first.id, green, lightEffectGroupId('missing'))], [], 100)).toEqual([
      green,
    ]);
  });
});

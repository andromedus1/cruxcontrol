import { describe, expect, it } from 'vitest';
import type { Row } from '../port.ts';
import { kilterFullride7x10Definition as definition } from '../../domain/boards/definitions/kilter-fullride-7x10.ts';
import { projectKilterClimb } from './kilter-projection.ts';

const base: Row = {
  source_uuid: 'synthetic-uuid',
  source_name: 'Synthetic climb',
  source_frames: 'p4117r42p4118r43p4119r44p4120r45',
  source_setter: 'fixture setter',
  source_description: 'Fixture description',
  source_layout_id: 8,
  source_frames_count: 1,
  source_is_draft: 0,
  source_is_listed: 1,
  stat_angle: 50,
  stat_display_difficulty: 18.4,
  stat_difficulty_average: 17.7,
  stat_benchmark_difficulty: 0,
  stat_ascensionist_count: 123,
  stat_quality_average: 3.25,
  grade_label: 'V4',
};

describe('projectKilterClimb', () => {
  it('maps all four native Fullride roles and retains source metadata', () => {
    const source = structuredClone(base);
    const climb = projectKilterClimb(source, definition)!;

    expect(climb.assignments.map(({ placementId, appearance }) => [
      placementId,
      appearance,
    ])).toEqual([
      [definition.placements.find((p) => p.native.placementId === '4117')!.id, { kind: 'role', role: 'start' }],
      [definition.placements.find((p) => p.native.placementId === '4118')!.id, { kind: 'role', role: 'middle' }],
      [definition.placements.find((p) => p.native.placementId === '4119')!.id, { kind: 'role', role: 'finish' }],
      [definition.placements.find((p) => p.native.placementId === '4120')!.id, { kind: 'role', role: 'foot-only' }],
    ]);
    expect(climb.angle).toBe(50);
    expect(climb.grade).toBe('V4');
    expect(climb.gradeValue).toBe(18);
    expect(climb.nativeGrades).toEqual({ scale: 'kilter-difficulty', display: 18.4, community: 17.7, benchmark: 0 });
    expect(climb.statistics).toEqual({ ascentCount: 123, quality: 3.25 });
    expect(climb.providerClimbId.sourceId).toBe('synthetic-uuid');
    expect(climb.setter).toBe('fixture setter');
    expect(climb.description).toBe('Fixture description');
    expect(source).toEqual(base);
    expect(Object.isFrozen(climb.assignments[0]!.appearance)).toBe(true);
  });

  it('keeps a usable climb when its label is absent', () => {
    expect(projectKilterClimb({ ...base, grade_label: null }, definition)).toMatchObject({
      gradeValue: 18,
      nativeGrades: { display: 18.4 },
    });
    expect(projectKilterClimb({ ...base, grade_label: null }, definition)).not.toHaveProperty('grade');
  });

  it.each([
    ['unknown role', { source_frames: 'p4117r99' }],
    ['unsupported placement', { source_frames: 'p999999r42' }],
    ['duplicate placement', { source_frames: 'p4117r42p4117r43' }],
    ['partial token', { source_frames: 'p4117r42x' }],
    ['leading zero', { source_frames: 'p04117r42' }],
    ['empty frame', { source_frames: '' }],
    ['oversized frame', { source_frames: 'p4117r42'.repeat(2049) }],
    ['wrong layout', { source_layout_id: 1 }],
    ['draft', { source_is_draft: 1 }],
    ['unlisted', { source_is_listed: 0 }],
    ['multiframe', { source_frames_count: 2 }],
    ['invalid grade', { stat_display_difficulty: Number.NaN }],
    ['negative community grade', { stat_difficulty_average: -0.1 }],
    ['invalid benchmark', { stat_benchmark_difficulty: 'bad' }],
    ['fractional ascent count', { stat_ascensionist_count: 1.5 }],
    ['negative quality', { stat_quality_average: -1 }],
  ])('rejects %s as a whole record', (_label, changes) => {
    expect(projectKilterClimb({ ...base, ...changes }, definition)).toBeNull();
  });
});

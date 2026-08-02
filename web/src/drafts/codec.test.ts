import { apiLevel3Color } from '../domain/boards/colors.ts';
import { lightEffectGroupId } from '../board-renderer/types.ts';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10.ts';
import { decodeStoredDraft, draftRevision, encodeStoredDraft, localDraftId } from './codec.ts';
import { DraftCorruptRecordError, DraftSchemaError } from './errors.ts';
import { draftContent, FIRST_DRAFT_ID } from './test-fixtures.ts';
import type { LocalClimbDraft } from './types.ts';

function draft(overrides: Partial<LocalClimbDraft> = {}): LocalClimbDraft {
  const content = draftContent();
  return {
    schemaVersion: 2,
    id: localDraftId(FIRST_DRAFT_ID),
    revision: draftRevision(1),
    ...content,
    createdAt: '2026-08-02T12:00:00.000Z',
    updatedAt: '2026-08-02T12:00:00.000Z',
    ...overrides,
    metadata: overrides.metadata ?? content.metadata ?? {},
    effectGroups: overrides.effectGroups ?? [],
  };
}

describe('local draft codec', () => {
  it('migrates valid v1 records to v2 without changing their climb content', () => {
    const current = draft({
      name: 'Old wave',
      assignments: [
        {
          placementId: kilterFullride7x10Definition.placements[0]!.id,
          appearance: { kind: 'role', role: 'start' },
        },
      ],
    });
    const v1 = {
      ...encodeStoredDraft(current),
      schemaVersion: 1,
    };
    delete (v1 as { effectGroups?: unknown }).effectGroups;
    for (const assignment of v1.assignments as unknown as { effectGroupId?: unknown }[]) {
      delete assignment.effectGroupId;
    }

    expect(decodeStoredDraft(v1)).toEqual({
      ...current,
      schemaVersion: 2,
      effectGroups: [],
      assignments: current.assignments.map(({ placementId, appearance }) => ({
        placementId,
        appearance,
      })),
    });
  });

  it('round-trips v2 effect groups and assignment membership exactly', () => {
    const placementId = kilterFullride7x10Definition.placements[0]!.id;
    const source = draft({
      assignments: [
        {
          placementId,
          appearance: { kind: 'custom', color: apiLevel3Color(181) },
          effectGroupId: lightEffectGroupId('side-wave'),
        },
      ],
      effectGroups: [
        {
          id: lightEffectGroupId('side-wave'),
          kind: 'wave',
          palette: [apiLevel3Color(181), apiLevel3Color(127), apiLevel3Color(31)],
          periodMs: 2400,
          intensity: 0.75,
        },
      ],
    });

    expect(decodeStoredDraft(encodeStoredDraft(source))).toEqual(source);
  });

  it.each([
    ['effectGroups[0].id', { effectGroups: [{ id: '', kind: 'pulse', palette: [1], periodMs: 1000, intensity: 1 }] }],
    ['effectGroups[1].id', { effectGroups: [
      { id: 'same', kind: 'pulse', palette: [1], periodMs: 1000, intensity: 1 },
      { id: 'same', kind: 'wave', palette: [2], periodMs: 1000, intensity: 1 },
    ] }],
    ['effectGroups[0].palette', { effectGroups: [{ id: 'bad', kind: 'pulse', palette: [], periodMs: 1000, intensity: 1 }] }],
    ['effectGroups[0].palette[0]', { effectGroups: [{ id: 'bad', kind: 'pulse', palette: [256], periodMs: 1000, intensity: 1 }] }],
    ['effectGroups[0].periodMs', { effectGroups: [{ id: 'bad', kind: 'pulse', palette: [1], periodMs: 249, intensity: 1 }] }],
    ['effectGroups[0].intensity', { effectGroups: [{ id: 'bad', kind: 'pulse', palette: [1], periodMs: 1000, intensity: 1.01 }] }],
    ['assignments[0].effectGroupId', {
      assignments: [{
        placementId: kilterFullride7x10Definition.placements[0]!.id,
        appearance: { kind: 'custom', color: 1 },
        effectGroupId: 'missing',
      }],
    }],
  ])('rejects corrupt v2 effect data at %s', (path, change) => {
    const wire = { ...encodeStoredDraft(draft()), ...change };
    expect(() => decodeStoredDraft(wire)).toThrowError(
      expect.objectContaining({ code: 'corrupt-record', path, record: wire }) as DraftCorruptRecordError,
    );
  });

  it('round-trips empty, Unicode, optional metadata, and unconventional role combinations immutably', () => {
    const placements = kilterFullride7x10Definition.placements;
    const source = draft({
      name: '🪨 夜の波',
      assignments: [
        { placementId: placements[0].id, appearance: { kind: 'role', role: 'finish' } },
        { placementId: placements[1].id, appearance: { kind: 'role', role: 'finish' } },
        { placementId: placements[2].id, appearance: { kind: 'role', role: 'foot-only' } },
      ],
      metadata: { grade: '', description: '自由', setterNotes: '' },
    });
    const wire = encodeStoredDraft(source);
    const decoded = decodeStoredDraft(wire);

    expect(decoded).toEqual(source);
    expect(encodeStoredDraft(decoded)).toEqual(wire);
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(Object.isFrozen(decoded.assignments)).toBe(true);
    expect(Object.isFrozen(decoded.assignments[0].appearance)).toBe(true);
    expect(Object.isFrozen(decoded.metadata)).toBe(true);
  });

  it('round-trips all four roles and every packed hardware color exactly', () => {
    const placements = kilterFullride7x10Definition.placements;
    const roles = ['start', 'middle', 'finish', 'foot-only'] as const;
    const assignments = [
      ...roles.map((role, index) => ({
        placementId: placements[index].id,
        appearance: { kind: 'role' as const, role },
      })),
      ...Array.from({ length: 256 }, (_, color) => ({
        placementId: placements[color + roles.length].id,
        appearance: { kind: 'custom' as const, color: apiLevel3Color(color) },
      })),
    ];
    expect(decodeStoredDraft(encodeStoredDraft(draft({ assignments }))).assignments).toEqual(
      assignments,
    );
  });

  it.each([
    ['id', { id: 'not-a-uuid' }],
    ['revision', { revision: 0 }],
    ['angle', { angle: Number.NaN }],
    ['createdAt', { createdAt: 'yesterday' }],
    [
      'assignments[0].appearance.color',
      { assignments: [{ placementId: 'p', appearance: { kind: 'custom', color: 256 } }] },
    ],
    ['metadata.grade', { metadata: { grade: 4 } }],
  ])('reports malformed %s with a typed path and retains the record', (path, change) => {
    const wire = { ...encodeStoredDraft(draft()), ...change };
    expect(() => decodeStoredDraft(wire)).toThrowError(
      expect.objectContaining({
        code: 'corrupt-record',
        path,
        record: wire,
      }) as DraftCorruptRecordError,
    );
  });

  it('rejects duplicate placements and unknown versions without mutating either record', () => {
    const assignment = {
      placementId: kilterFullride7x10Definition.placements[0].id,
      appearance: { kind: 'role' as const, role: 'start' as const },
    };
    const duplicate = encodeStoredDraft(draft({ assignments: [assignment, assignment] }));
    const snapshot = structuredClone(duplicate);
    expect(() => decodeStoredDraft(duplicate)).toThrowError(
      expect.objectContaining({ path: 'assignments[1].placementId' }) as DraftCorruptRecordError,
    );
    expect(duplicate).toEqual(snapshot);

    const future = { ...encodeStoredDraft(draft()), schemaVersion: 3 };
    expect(() => decodeStoredDraft(future)).toThrowError(
      expect.objectContaining({
        code: 'schema-unsupported',
        schemaVersion: 3,
        id: FIRST_DRAFT_ID,
      }) as DraftSchemaError,
    );
  });
});

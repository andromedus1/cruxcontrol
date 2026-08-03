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
    schemaVersion: 4,
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
  it('round-trips a self-contained spatial recipe and rejects assignment references to it', () => {
    const placementId = kilterFullride7x10Definition.placements[0]!.id;
    const spatial = {
      model: 'spatial' as const,
      id: lightEffectGroupId('snake-background'), recipeVersion: 1 as const,
      recipe: { kind: 'snake' as const, direction: 'forward' as const, bodyLength: 7 }, seed: 42,
      palette: [apiLevel3Color(28)], periodMs: 120_000, intensity: .8, footprint: 7,
      target: { scope: 'selected' as const, include: [placementId], exclude: [] },
    };
    const source = draft({ effectGroups: [spatial] });
    expect(decodeStoredDraft(encodeStoredDraft(source))).toEqual({ ...source, schemaVersion: 4 });
    const dangling = encodeStoredDraft({ ...source, assignments: [{ placementId, appearance: { kind: 'custom', color: apiLevel3Color(1) }, effectGroupId: spatial.id }] });
    expect(() => decodeStoredDraft(dangling)).toThrowError(expect.objectContaining({ path: 'assignments[0].effectGroupId' }));
  });
  it.each([
    ['frogger', { kind: 'frogger' as const, lanes: 4 }],
    ['pentagram', { kind: 'pentagram' as const, fadeRate: 1 }],
  ])('round-trips the %s spatial recipe', (_, recipe) => {
    const spatial = {
      model: 'spatial' as const, id: lightEffectGroupId(`effect-${recipe.kind}`), recipeVersion: 1 as const,
      recipe, seed: 17, palette: [apiLevel3Color(28), apiLevel3Color(192)], periodMs: 45_000,
      intensity: 1, footprint: 10, target: { scope: 'unused' as const, include: [], exclude: [] },
    };
    const source = draft({ effectGroups: [spatial] });
    expect(decodeStoredDraft(encodeStoredDraft(source))).toEqual(source);
  });
  it('migrates valid v1 records to active v4 drafts without changing their climb content', () => {
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
    delete (v1 as { status?: unknown }).status;
    delete (v1 as { trashedAt?: unknown }).trashedAt;
    for (const assignment of v1.assignments as unknown as { effectGroupId?: unknown }[]) {
      delete assignment.effectGroupId;
    }

    expect(decodeStoredDraft(v1)).toEqual({
      ...current,
      schemaVersion: 4,
      status: 'draft',
      effectGroups: [],
      assignments: current.assignments.map(({ placementId, appearance }) => ({
        placementId,
        appearance,
      })),
    });
  });

  it('migrates valid v2 records to active Drafts without eager lifecycle metadata', () => {
    const source = draft({ status: 'finished' });
    const v2 = { ...encodeStoredDraft(source), schemaVersion: 2 };
    delete (v2 as { status?: unknown }).status;
    delete (v2 as { trashedAt?: unknown }).trashedAt;

    expect(decodeStoredDraft(v2)).toEqual({ ...source, status: 'draft' });
  });

  it('round-trips v4 lifecycle, effect groups, and assignment membership exactly', () => {
    const placementId = kilterFullride7x10Definition.placements[0]!.id;
    const source = draft({
      status: 'finished',
      trashedAt: '2026-08-03T12:00:00.000Z',
      assignments: [
        {
          placementId,
          appearance: { kind: 'custom', color: apiLevel3Color(181) },
          effectGroupId: lightEffectGroupId('side-wave'),
        },
      ],
      effectGroups: [
        {
          model: 'assigned',
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
    [
      'effectGroups[0].id',
      { effectGroups: [{ id: '', kind: 'pulse', palette: [1], periodMs: 1000, intensity: 1 }] },
    ],
    [
      'effectGroups[1].id',
      {
        effectGroups: [
          { id: 'same', kind: 'pulse', palette: [1], periodMs: 1000, intensity: 1 },
          { id: 'same', kind: 'wave', palette: [2], periodMs: 1000, intensity: 1 },
        ],
      },
    ],
    [
      'effectGroups[0].palette',
      { effectGroups: [{ id: 'bad', kind: 'pulse', palette: [], periodMs: 1000, intensity: 1 }] },
    ],
    [
      'effectGroups[0].palette[0]',
      {
        effectGroups: [{ id: 'bad', kind: 'pulse', palette: [256], periodMs: 1000, intensity: 1 }],
      },
    ],
    [
      'effectGroups[0].periodMs',
      { effectGroups: [{ id: 'bad', kind: 'pulse', palette: [1], periodMs: 249, intensity: 1 }] },
    ],
    [
      'effectGroups[0].periodMs',
      { effectGroups: [{ id: 'bad', kind: 'pulse', palette: [1], periodMs: 180_001, intensity: 1 }] },
    ],
    [
      'effectGroups[0].intensity',
      {
        effectGroups: [{ id: 'bad', kind: 'pulse', palette: [1], periodMs: 1000, intensity: 1.01 }],
      },
    ],
    [
      'assignments[0].effectGroupId',
      {
        assignments: [
          {
            placementId: kilterFullride7x10Definition.placements[0]!.id,
            appearance: { kind: 'custom', color: 1 },
            effectGroupId: 'missing',
          },
        ],
      },
    ],
  ])('rejects corrupt v3 effect data at %s', (path, change) => {
    const wire = { ...encodeStoredDraft(draft()), ...change };
    expect(() => decodeStoredDraft(wire)).toThrowError(
      expect.objectContaining({
        code: 'corrupt-record',
        path,
        record: wire,
      }) as DraftCorruptRecordError,
    );
  });

  it.each([
    ['status', { status: 'published' }],
    ['trashedAt', { trashedAt: 'next month' }],
    ['trashedAt', { trashedAt: '2026-08-03T12:00:00Z' }],
  ])('rejects corrupt lifecycle data at %s', (path, change) => {
    const wire = { ...encodeStoredDraft(draft()), ...change };
    expect(() => decodeStoredDraft(wire)).toThrowError(
      expect.objectContaining({
        code: 'corrupt-record',
        path,
        record: wire,
      }) as DraftCorruptRecordError,
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

    const future = { ...encodeStoredDraft(draft()), schemaVersion: 5 };
    expect(() => decodeStoredDraft(future)).toThrowError(
      expect.objectContaining({
        code: 'schema-unsupported',
        schemaVersion: 5,
        id: FIRST_DRAFT_ID,
      }) as DraftSchemaError,
    );
  });
});

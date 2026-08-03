import { apiLevel3Color } from '../domain/boards/colors.ts';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10.ts';
import { decodeStoredDraft, localDraftId } from './codec.ts';
import { localDraftClimbViewKey, toClimbViewRecord } from './to-climb-view-record.ts';
import { draftContent, FIRST_DRAFT_ID } from './test-fixtures.ts';

describe('local draft viewer projection', () => {
  it('uses a stable source-neutral namespace and preserves assignments by identity', () => {
    const assignments = [
      {
        placementId: kilterFullride7x10Definition.placements[0].id,
        appearance: { kind: 'custom' as const, color: apiLevel3Color(173) },
      },
    ];
    const content = draftContent({
      name: 'Wave',
      angle: 45,
      assignments,
      metadata: { grade: 'V5', description: 'Flow', setterNotes: 'private' },
    });
    const draft = decodeStoredDraft({
      schemaVersion: 1,
      id: FIRST_DRAFT_ID,
      revision: 1,
      ...content,
      createdAt: '2026-08-02T12:00:00.000Z',
      updatedAt: '2026-08-02T12:00:00.000Z',
      updatedOrder: ['2026-08-02T12:00:00.000Z', FIRST_DRAFT_ID],
    });
    const record = toClimbViewRecord(draft);
    expect(record).toEqual({
      key: localDraftClimbViewKey(localDraftId(FIRST_DRAFT_ID)),
      name: 'Wave',
      angle: 45,
      assignments: draft.assignments,
      effectGroups: draft.effectGroups,
      origin: 'local-draft',
      grade: 'V5',
      description: 'Flow',
    });
    expect(record.assignments).toBe(draft.assignments);
    expect(record.effectGroups).toBe(draft.effectGroups);
    expect(record).not.toHaveProperty('setter');
    expect(record.key).not.toContain('provider');
  });
});

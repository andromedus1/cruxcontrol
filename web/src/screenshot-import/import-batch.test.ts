import { describe, expect, it, vi } from 'vitest';
import { draftRevision, localDraftId } from '../drafts/codec';
import type { LocalDraftRepository } from '../drafts/repository';
import { draftContent } from '../drafts/test-fixtures';
import type { DraftContent, LocalClimbDraft } from '../drafts/types';
import { createAppInstallationRegistry, activeInstallationId } from '../app/installations';
import { importScreenshotCandidates } from './import-batch';
import type { ConfirmedScreenshotCandidate } from './types';

const installation = createAppInstallationRegistry().require(activeInstallationId);
const first = installation.definition.placements[0]!.id;
const second = installation.definition.placements[1]!.id;
const assignments = Object.freeze([
  { placementId: first, appearance: { kind: 'role' as const, role: 'start' as const } },
  { placementId: second, appearance: { kind: 'role' as const, role: 'finish' as const } },
]);

function stored(content: DraftContent, id: string, trashed = false): LocalClimbDraft {
  return {
    ...content,
    schemaVersion: 3,
    id: localDraftId(id),
    revision: draftRevision(1),
    ...(trashed ? { trashedAt: '2026-08-02T00:00:00.000Z' } : {}),
    metadata: content.metadata ?? {},
    createdAt: '2026-08-02T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
  };
}

function candidate(name: string, sourceName = `${name}.png`): ConfirmedScreenshotCandidate {
  return { sourceName, name, assignments, warningsOverridden: false };
}

function repository(
  active: readonly LocalClimbDraft[] = [],
  trash: readonly LocalClimbDraft[] = [],
) {
  let next = 1;
  const create = vi.fn<LocalDraftRepository['create']>(async (content) =>
    stored(content, `10000000-0000-4000-8000-${String(next++).padStart(12, '0')}`),
  );
  return {
    create,
    value: {
      create,
      list: vi.fn<LocalDraftRepository['list']>(async (options) =>
        options?.collection === 'trash' ? trash : active,
      ),
      get: vi.fn(),
      update: vi.fn(),
      trash: vi.fn(),
      restore: vi.fn(),
      deletePermanently: vi.fn(),
    } satisfies LocalDraftRepository,
  };
}

describe('importScreenshotCandidates', () => {
  it('creates unrestricted 40° drafts with empty effects and metadata without mutating inputs', async () => {
    const repo = repository();
    const input = Object.freeze([candidate('  New climb  ')]);
    const before = JSON.stringify(input);
    const result = await importScreenshotCandidates(repo.value, installation, input);
    expect(result.created).toHaveLength(1);
    expect(repo.create).toHaveBeenCalledWith({
      ...draftContent({ installationId: activeInstallationId, name: 'New climb', assignments }),
      effectGroups: [],
      metadata: {},
      angle: 40,
    });
    expect(JSON.stringify(input)).toBe(before);
  });

  it('skips assignment-order-independent duplicates in active storage and Trash', async () => {
    const reversed = [...assignments].reverse();
    const active = stored(
      draftContent({
        installationId: activeInstallationId,
        name: 'Existing',
        assignments: reversed,
      }),
      '20000000-0000-4000-8000-000000000001',
    );
    const trash = stored(
      draftContent({ installationId: activeInstallationId, name: 'Deleted', assignments }),
      '20000000-0000-4000-8000-000000000002',
      true,
    );
    const repo = repository([active], [trash]);
    const result = await importScreenshotCandidates(repo.value, installation, [
      candidate('Existing'),
      candidate('Deleted'),
    ]);
    expect(result.created).toEqual([]);
    expect(result.skipped).toEqual([
      'Existing — already imported',
      'Deleted — already in Trash; restore it instead',
    ]);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('continues after partial failures and makes same-batch repeats idempotent', async () => {
    const repo = repository();
    repo.create.mockRejectedValueOnce(new Error('storage full'));
    const result = await importScreenshotCandidates(repo.value, installation, [
      candidate('First'),
      candidate('Second'),
      candidate('Second', 'again.png'),
    ]);
    expect(result.created.map(({ name }) => name)).toEqual(['Second']);
    expect(result.skipped).toEqual(['Second — already imported']);
    expect(result.failures).toEqual([{ sourceName: 'First.png', message: 'storage full' }]);
  });
});

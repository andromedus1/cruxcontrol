import { describe, expect, it, vi } from 'vitest';
import { activeInstallationId, createAppInstallationRegistry } from '../app/installations';
import { draftRevision, localDraftId } from '../drafts/codec';
import type { LocalDraftRepository } from '../drafts/repository';
import type { DraftContent, LocalClimbDraft } from '../drafts/types';
import { importScreenshotCandidates } from './import-batch';
import { createSuppliedFullrideCandidates } from './supplied-batch';
import { SUPPLIED_FULLRIDE_CLIMBS } from './supplied-fullride-climbs';

const installation = createAppInstallationRegistry().require(activeInstallationId);

function memoryRepository(): LocalDraftRepository {
  const stored: LocalClimbDraft[] = [];
  let sequence = 1;
  return {
    create: vi.fn(async (content: DraftContent) => {
      const draft: LocalClimbDraft = {
        ...content,
        schemaVersion: 3,
        id: localDraftId(`40000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`),
        revision: draftRevision(1),
        metadata: content.metadata ?? {},
        createdAt: '2026-08-02T00:00:00.000Z',
        updatedAt: '2026-08-02T00:00:00.000Z',
      };
      stored.push(draft);
      return draft;
    }),
    list: vi.fn(async (options) =>
      options?.collection === 'trash'
        ? stored.filter(({ trashedAt }) => Boolean(trashedAt))
        : stored.filter(({ trashedAt }) => !trashedAt),
    ),
    get: vi.fn(async (id) => stored.find((draft) => draft.id === id) ?? null),
    update: vi.fn(),
    trash: vi.fn(),
    restore: vi.fn(),
    deletePermanently: vi.fn(),
    purgeExpiredTrash: vi.fn(),
  };
}

describe('supplied 16-climb migration', () => {
  it('constructs exactly the checksum-linked names and role/placement tuples without pixels', () => {
    const candidates = createSuppliedFullrideCandidates(installation.definition);
    expect(candidates).toHaveLength(16);
    expect(candidates.map(({ name }) => name)).toEqual(
      SUPPLIED_FULLRIDE_CLIMBS.map(({ name }) => name),
    );
    expect(candidates.map(({ assignments }) => assignments.length)).toEqual(
      SUPPLIED_FULLRIDE_CLIMBS.map(({ rings }) => rings.length),
    );
    expect(candidates.every(({ warnings }) => warnings.length === 0)).toBe(true);
  });

  it('imports all 16 as ordinary 40° drafts, then skips all 16 on repeat', async () => {
    const repository = memoryRepository();
    const confirmed = createSuppliedFullrideCandidates(installation.definition).map(
      (candidate) => ({
        sourceName: candidate.sourceName,
        name: candidate.name,
        assignments: candidate.assignments,
        warningsOverridden: false,
      }),
    );
    const first = await importScreenshotCandidates(repository, installation, confirmed);
    expect(first).toMatchObject({ skipped: [], failures: [] });
    expect(first.created).toHaveLength(16);
    expect(first.created.every(({ status, angle }) => status === 'draft' && angle === 40)).toBe(
      true,
    );
    expect(
      first.created.every(
        ({ effectGroups, metadata }) =>
          effectGroups.length === 0 && Object.keys(metadata).length === 0,
      ),
    ).toBe(true);
    expect(first.created.map(({ name }) => name)).toEqual(
      SUPPLIED_FULLRIDE_CLIMBS.map(({ name }) => name),
    );

    const repeated = await importScreenshotCandidates(repository, installation, confirmed);
    expect(repeated.created).toEqual([]);
    expect(repeated.failures).toEqual([]);
    expect(repeated.skipped).toHaveLength(16);
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { activeInstallationId, createAppInstallationRegistry } from '../app/installations';
import { CruxControlWorkspace } from '../app/CruxControlWorkspace';
import { MockBoardByteTransport } from '../board-control/mock-byte-transport';
import { IndexedDbLocalDraftRepository } from '../drafts/indexeddb-repository';
import { openDraftDatabase } from '../drafts/open-draft-database';
import { FIRST_DRAFT_ID } from '../drafts/test-fixtures';
import { RouteEditorWorkspace } from './RouteEditorWorkspace';

const presets = [
  ['Fireflies', 'fireflies', 8], ['Shooting stars', 'shooting-stars', 6],
  ['Jellyfish', 'jellyfish', 9], ['Embers', 'embers', 10],
] as const;

describe('sparse effect editing and persistence', () => {
  it.each(presets)('creates, edits, and reopens the %s preset', async (label, kind, reserve) => {
    const factory = new IDBFactory();
    const database = await openDraftDatabase(factory);
    const drafts = new IndexedDbLocalDraftRepository(database, {
      createId: () => FIRST_DRAFT_ID, now: () => new Date('2026-09-05T12:00:00.000Z'),
    });
    const installation = createAppInstallationRegistry({ createTransport: () => new MockBoardByteTransport() })
      .require(activeInstallationId);
    const runtime = {
      installation,
      drafts,
      controller: installation.createController(),
      close: vi.fn(),
      playlists: {
        create: vi.fn(), get: vi.fn(), list: vi.fn().mockResolvedValue([]),
        update: vi.fn(), delete: vi.fn(),
      },
    };

    const view = render(<CruxControlWorkspace runtime={runtime} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create your first climb' }));
    await screen.findByRole('heading', { name: 'Untitled climb' });
    fireEvent.click(screen.getByRole('radio', { name: /Advanced Light/ }));
    fireEvent.change(screen.getByLabelText('red channel'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('green channel'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('blue channel'), { target: { value: '3' } });

    fireEvent.click(screen.getByRole('button', { name: `${label} ${reserve} lights` }));
    expect(screen.queryByLabelText('Effect shape')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Effect direction')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Effect footprint')).toHaveValue(reserve);
    expect(screen.getByLabelText('Effect cycle time')).toHaveValue('120000');
    const oldColor = screen.getByRole('button', { name: /Remove color/ });
    fireEvent.click(screen.getByRole('button', { name: 'Add current color' }));
    fireEvent.click(oldColor);
    fireEvent.change(screen.getByLabelText('Effect cycle time'), { target: { value: '61000' } });
    fireEvent.change(screen.getByLabelText('Effect intensity'), { target: { value: '40' } });

    const expectedEffect = expect.objectContaining({
      recipe: { kind }, recipeVersion: 2, footprint: reserve,
      palette: [0x83], periodMs: 61_000, intensity: .4,
    });
    await waitFor(async () => {
      expect(document.querySelector('.save-chip')).toHaveTextContent('saved');
      const persisted = await drafts.list({ installationId: installation.config.id });
      expect(persisted).toHaveLength(1);
      expect(persisted[0]!.effectGroups).toEqual([expectedEffect]);
    }, { timeout: 8_000, interval: 100 });
    const stored = await drafts.list({ installationId: installation.config.id });
    expect(stored).toHaveLength(1);
    expect(stored[0]!.effectGroups).toEqual([expectedEffect]);

    view.unmount();
    database.close();
    const reopened = await openDraftDatabase(factory);
    const repository = new IndexedDbLocalDraftRepository(reopened);
    const values = await repository.list({ installationId: installation.config.id });
    expect(values).toEqual(stored);
    const editor = render(
      <RouteEditorWorkspace
        definition={installation.definition}
        draft={values[0]!}
        repository={repository}
        onBack={vi.fn()}
      />,
    );
    const group = values[0]!.effectGroups[0]!;
    fireEvent.change(screen.getByLabelText('Effect group'), { target: { value: group.id } });
    expect(screen.getByLabelText('Effect cycle time')).toHaveValue('61000');
    expect(screen.getByLabelText('Effect intensity')).toHaveValue('40');
    expect(screen.getByRole('button', { name: 'Remove color #9200FF' })).toBeInTheDocument();
    editor.unmount();
    reopened.close();
  }, 10_000);
});

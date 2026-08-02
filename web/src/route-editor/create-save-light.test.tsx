import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { MockBoardByteTransport } from '../board-control/mock-byte-transport';
import { IndexedDbLocalDraftRepository } from '../drafts/indexeddb-repository';
import { openDraftDatabase } from '../drafts/open-draft-database';
import { FIRST_DRAFT_ID } from '../drafts/test-fixtures';
import { activeInstallationId, createAppInstallationRegistry } from '../app/installations';
import type { CruxControlRuntime } from '../app/create-runtime';
import { CruxControlWorkspace } from '../app/CruxControlWorkspace';

describe('create-save-light integration', () => {
  it('persists and lights unrestricted semantic/custom assignments through the real seams', async () => {
    const factory = new IDBFactory();
    const database = await openDraftDatabase(factory);
    const drafts = new IndexedDbLocalDraftRepository(database, {
      createId: () => FIRST_DRAFT_ID,
      now: () => new Date('2026-08-02T12:00:00.000Z'),
    });
    const transport = new MockBoardByteTransport();
    const installation = createAppInstallationRegistry({ createTransport: () => transport }).require(activeInstallationId);
    const runtime: CruxControlRuntime = {
      installation,
      drafts,
      controller: installation.createController(),
      close: vi.fn(),
    };
    const view = render(<CruxControlWorkspace runtime={runtime} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create your first climb' }));
    await screen.findByRole('heading', { name: 'Untitled climb' });

    const apply = (ordinal: number) => fireEvent.keyDown(
      screen.getByRole('button', { name: new RegExp(`^Hold ${ordinal},`) }),
      { key: 'Enter' },
    );
    apply(1);
    fireEvent.click(screen.getByRole('radio', { name: /Middle/ })); apply(2);
    fireEvent.click(screen.getByRole('radio', { name: /Finish/ })); apply(3);
    fireEvent.click(screen.getByRole('radio', { name: /Foot-only/ })); apply(4);
    fireEvent.click(screen.getByRole('radio', { name: /Advanced Light/ }));
    fireEvent.change(screen.getByLabelText('red channel'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('green channel'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('blue channel'), { target: { value: '3' } });
    apply(5);

    fireEvent.click(screen.getByRole('button', { name: 'Save now' }));
    await waitFor(() => expect(document.querySelector('.save-chip')).toHaveTextContent('saved'));
    fireEvent.click(screen.getByRole('button', { name: 'Connect & light' }));
    await waitFor(() => expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(1));

    const stored = await drafts.list({ installationId: installation.config.id });
    expect(stored).toHaveLength(1);
    expect(stored[0]?.assignments.map(({ appearance }) => appearance)).toEqual([
      { kind: 'role', role: 'start' },
      { kind: 'role', role: 'middle' },
      { kind: 'role', role: 'finish' },
      { kind: 'role', role: 'foot-only' },
      { kind: 'custom', color: 255 },
    ]);

    view.unmount();
    database.close();
    const reopened = await openDraftDatabase(factory);
    const reopenedDrafts = new IndexedDbLocalDraftRepository(reopened);
    expect(await reopenedDrafts.list({ installationId: installation.config.id })).toEqual(stored);
    reopened.close();
  });
});

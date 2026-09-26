import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BoardLightController, BoardLightState } from '../board-control/light-controller.ts';
import { kilterFullride7x10Definition as definition } from '../domain/boards/definitions/kilter-fullride-7x10.ts';
import { climbViewKey, type ClimbViewRecord } from '../climb-browser/types.ts';
import { localDraftId } from '../drafts/codec.ts';
import { playlistId, playlistReferenceKey, playlistRevision } from './codec.ts';
import { PlaylistPlayThrough } from './PlaylistPlayThrough.tsx';
import type { ResolvedPlaylistEntry } from './resolve.ts';
import { providerReference } from './test-fixtures.ts';
import type { LocalPlaylist } from './types.ts';

const FIRST_ID = localDraftId('00000000-0000-4000-8000-000000000081');
const SECOND_ID = localDraftId('00000000-0000-4000-8000-000000000082');
const THIRD_ID = localDraftId('00000000-0000-4000-8000-000000000083');

function climb(id: typeof FIRST_ID, name: string, placementIndex: number): ClimbViewRecord {
  return {
    key: climbViewKey(`local:${id}`),
    name,
    angle: 40,
    origin: 'local-draft',
    assignments: [
      {
        placementId: definition.placements[placementIndex]!.id,
        appearance: { kind: 'role', role: 'start' },
      },
    ],
  };
}

function entry(
  id: typeof FIRST_ID,
  name: string,
  placementIndex: number,
  availability: ResolvedPlaylistEntry['availability'] = 'available',
): ResolvedPlaylistEntry {
  return {
    reference: { kind: 'local', id },
    key: `local:${id}`,
    climb: availability === 'missing' ? null : climb(id, name, placementIndex),
    availability,
  };
}

function playlist(entries: readonly ResolvedPlaylistEntry[]): LocalPlaylist {
  return {
    schemaVersion: 1,
    id: playlistId('00000000-0000-4000-8000-000000000091'),
    revision: playlistRevision(1),
    name: 'Evening circuit',
    notes: '',
    entries: entries.map(({ reference }) => reference),
    createdAt: '2026-08-02T12:00:00.000Z',
    updatedAt: '2026-08-02T12:00:00.000Z',
  };
}

function controllerWith(state: BoardLightState): BoardLightController {
  return {
    getState: () => state,
    subscribe: () => () => undefined,
    requestAndConnect: vi.fn().mockResolvedValue({ id: 'board', name: 'Homewall' }),
    reconnect: vi.fn().mockResolvedValue({ id: 'board', name: 'Homewall' }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    light: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    preview: vi.fn().mockResolvedValue({ status: 'applied' }),
  };
}

const disconnectedState: BoardLightState = {
  transport: { status: 'disconnected', device: null },
  operation: 'idle',
  lastAppliedScene: null,
  error: null,
};

describe('PlaylistPlayThrough', () => {
  it('moves keyboard focus to the enabled sibling at both navigation boundaries and announces the climb', () => {
    const entries = [entry(FIRST_ID, 'First climb', 0), entry(SECOND_ID, 'Second climb', 1)];
    render(<PlaylistPlayThrough playlist={playlist(entries)} entries={entries} definition={definition} compatibilityIssue={() => null} onExit={vi.fn()} />);
    const next = screen.getByRole('button', { name: 'Next' });
    const previous = screen.getByRole('button', { name: 'Previous' });
    next.focus();
    fireEvent.click(next);
    expect(next).toBeDisabled();
    expect(previous).toHaveFocus();
    expect(screen.getByText('2 of 2').closest('[role="status"]')).toHaveTextContent('Second climb');
    fireEvent.click(previous);
    expect(previous).toBeDisabled();
    expect(next).toHaveFocus();
  });

  it('does not steal focus from other controls when navigation changes without owning focus', () => {
    const entries = [entry(FIRST_ID, 'First climb', 0), entry(SECOND_ID, 'Second climb', 1)];
    render(<PlaylistPlayThrough playlist={playlist(entries)} entries={entries} definition={definition} compatibilityIssue={() => null} onExit={vi.fn()} />);
    const exit = screen.getByRole('button', { name: 'Exit play-through' });
    exit.focus();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(exit).toHaveFocus();
  });

  it('traverses exact order and preserves unavailable rows without controller actions', () => {
    const first = entry(FIRST_ID, 'First climb', 0);
    const trashed = entry(SECOND_ID, 'Trashed climb', 1, 'trashed');
    const missing = entry(THIRD_ID, '', 2, 'missing');
    const unresolvedProvider: ResolvedPlaylistEntry = {
      reference: providerReference,
      key: playlistReferenceKey(providerReference),
      climb: null,
      availability: 'missing',
    };
    const entries = [trashed, first, missing, unresolvedProvider];
    const controller = controllerWith(disconnectedState);
    const onExit = vi.fn();

    render(
      <PlaylistPlayThrough
        playlist={playlist(entries)}
        entries={entries}
        definition={definition}
        controller={controller}
        compatibilityIssue={() => null}
        onExit={onExit}
      />,
    );

    expect(screen.getByText('1 of 4')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Trashed climb' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByText(/Restore it before viewing or lighting it/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Light this climb' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('2 of 4')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'First climb' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Light this climb' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('3 of 4')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: `Missing local climb ${THIRD_ID}` }),
    ).toBeInTheDocument();
    expect(screen.getByText(`Reference: local:${THIRD_ID}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('4 of 4')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'kilter climb 12345' })).toBeInTheDocument();
    expect(
      screen.getByText(/provider climb is not installed or could not be resolved/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByText('3 of 4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Exit play-through' }));
    expect(onExit).toHaveBeenCalledOnce();
    expect(controller.requestAndConnect).not.toHaveBeenCalled();
    expect(controller.light).not.toHaveBeenCalled();
    expect(controller.clear).not.toHaveBeenCalled();
    expect(controller.preview).not.toHaveBeenCalled();
  });

  it('automatically lights the first climb and the next selected climb', async () => {
    const first = entry(FIRST_ID, 'First climb', 0);
    const second = entry(SECOND_ID, 'Second climb', 1);
    const entries = [first, second];
    const controller = controllerWith({
      ...disconnectedState,
      transport: { status: 'connected', device: { id: 'board', name: 'Homewall' } },
    });

    render(
      <PlaylistPlayThrough
        playlist={playlist(entries)}
        entries={entries}
        definition={definition}
        controller={controller}
        compatibilityIssue={() => null}
        onExit={vi.fn()}
      />,
    );

    await waitFor(() => expect(controller.preview).toHaveBeenCalledWith([{ placementId: definition.placements[0]!.id, color: definition.rolePresets.start.lightColor }]));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(controller.preview).toHaveBeenCalledTimes(2));
    expect(controller.preview).toHaveBeenLastCalledWith([
      {
        placementId: definition.placements[1]!.id,
        color: definition.rolePresets.start.lightColor,
      },
    ]);
  });

  it('keeps a stable current key through reorder and falls back by bounded index on removal', () => {
    const first = entry(FIRST_ID, 'First climb', 0);
    const second = entry(SECOND_ID, 'Second climb', 1);
    const third = entry(THIRD_ID, 'Third climb', 2);
    const initial = [first, second, third];
    const view = render(
      <PlaylistPlayThrough
        playlist={playlist(initial)}
        entries={initial}
        definition={definition}
        compatibilityIssue={() => null}
        onExit={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Second climb' })).toBeInTheDocument();

    const reordered = [third, second, first];
    view.rerender(
      <PlaylistPlayThrough
        playlist={playlist(reordered)}
        entries={reordered}
        definition={definition}
        compatibilityIssue={() => null}
        onExit={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Second climb' })).toBeInTheDocument();
    expect(screen.getByText('2 of 3')).toBeInTheDocument();

    const removed = [third, first];
    view.rerender(
      <PlaylistPlayThrough
        playlist={playlist(removed)}
        entries={removed}
        definition={definition}
        compatibilityIssue={() => null}
        onExit={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'First climb' })).toBeInTheDocument();
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
  });

  it('shows board incompatibility without a preview or light action', () => {
    const incompatible = entry(FIRST_ID, 'Wrong board', 0);
    render(
      <PlaylistPlayThrough
        playlist={playlist([incompatible])}
        entries={[incompatible]}
        definition={definition}
        compatibilityIssue={() => 'uses a different layout revision'}
        onExit={vi.fn()}
      />,
    );
    expect(screen.getByText('This climb uses a different layout revision.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Board preview')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Light this climb' })).not.toBeInTheDocument();
  });
});

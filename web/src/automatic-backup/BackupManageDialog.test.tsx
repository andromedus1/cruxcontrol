import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AutomaticBackup } from './coordinator.ts';
import { BackupManageDialog } from './BackupManageDialog.tsx';
import type { BackupStatus, OnlineBackupReview } from './types.ts';
import type { VaultListing, VaultSnapshot } from '../private-vault/types.ts';
import type { LibraryRestoreOutcome } from '../library-backup/service.ts';

const account = { uid: 'test-user', email: 'climber@example.test' };
const snapshot: VaultSnapshot = {
  slot: '00000',
  bytes: 1024,
  sha256: 'a'.repeat(64),
  generation: 'server-generation',
  createdAt: '2026-10-11T10:00:00.000Z',
  exportedAt: '2026-10-11T09:59:00.000Z',
  counts: { climbs: 2, finished: 1, drafts: 1, trash: 0, playlists: 1 },
};
const listing: VaultListing = {
  snapshots: [snapshot],
  capacity: { slots: 512, bytesPerSlot: 25 * 1024 * 1024 },
};
const onlineReview: OnlineBackupReview = {
  snapshot,
  backup: { exportedAt: snapshot.exportedAt, drafts: [], playlists: [] },
  review: {
    add: { climbs: 2, playlists: 1 },
    unchanged: { climbs: 0, playlists: 0 },
    conflicts: [],
    trashClimbs: 0,
    unavailableLocalReferences: 0,
  },
};
const protectedStatus: BackupStatus = {
  phase: 'protected',
  account,
  revision: 4,
  protectedRevision: { revision: 4, snapshot, verifiedAt: '2026-10-11T10:01:00.000Z' },
  localSaveFailed: false,
  error: null,
};

function automaticBackup(
  initial: BackupStatus = protectedStatus,
  overrides: Partial<Pick<AutomaticBackup, 'history' | 'review' | 'restore' | 'useLocalLibrary' | 'retry' | 'signIn' | 'signOut'>> = {},
) {
  let current = initial;
  const listeners = new Set<() => void>();
  const publish = (next: BackupStatus) => {
    current = next;
    listeners.forEach((listener) => listener());
  };
  const api = {
    getSnapshot: () => current,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    start: vi.fn(),
    setForeground: vi.fn(),
    retry: vi.fn(async () => undefined),
    signIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => { publish({ ...current, phase: 'signed-out', account: null }); }),
    history: vi.fn(async () => listing),
    review: vi.fn(async () => onlineReview),
    restore: vi.fn(async (): Promise<LibraryRestoreOutcome> => ({
      status: 'complete',
      drafts: { added: 2, unchanged: 0 },
      playlists: { added: 1, unchanged: 0 },
    })),
    useLocalLibrary: vi.fn(async () => undefined),
    close: vi.fn(),
  } satisfies AutomaticBackup;
  return Object.assign(api, overrides, { publish });
}

function renderManage(
  automatic = automaticBackup(),
  props: Partial<React.ComponentProps<typeof BackupManageDialog>> = {},
) {
  const onClose = vi.fn();
  const onRestored = vi.fn(async () => undefined);
  const onRecoveryBusyChange = vi.fn();
  const result = render(
    <BackupManageDialog
      automaticBackup={automatic}
      localCounts={{ climbs: 12, lists: 3 }}
      recoveryBlockReason={null}
      onClose={onClose}
      onPortableBackup={vi.fn()}
      onRestored={onRestored}
      onRecoveryBusyChange={onRecoveryBusyChange}
      {...props}
    />,
  );
  return { ...result, automatic, onClose, onRestored, onRecoveryBusyChange };
}

describe('BackupManageDialog', () => {
  it('loads history once for a connected account, and a failed load does not loop or trap retry', async () => {
    const history = vi.fn().mockRejectedValue(new Error('raw SDK credential error'));
    const automatic = automaticBackup(protectedStatus, { history });
    renderManage(automatic);

    await waitFor(() => expect(history).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Backup history could not be loaded/)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(history).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/raw SDK credential error/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh history' }));
    await waitFor(() => expect(history).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: 'Close private backup' })).toBeEnabled();
  });

  it('shows server copy details and an honest capacity count without exposing internal slot IDs', async () => {
    const full = { ...listing, snapshots: Array.from({ length: 512 }, (_, index) => ({
      ...snapshot,
      slot: String(index).padStart(5, '0'),
      generation: `generation-${index}`,
    })) };
    const automatic = automaticBackup({ ...protectedStatus, phase: 'capacity' }, { history: vi.fn(async () => full) });
    renderManage(automatic);

    expect(await screen.findByText('0 of 512 backup copies available. Each copy can be up to 25.0 MiB. Full storage pauses new copies; CruxControl keeps the existing history.')).toBeInTheDocument();
    expect(screen.getByText(/Connected as climber@example.test/)).toBeInTheDocument();
    expect(screen.getByText(/Last checked/)).toBeInTheDocument();
    expect(screen.queryByText(/00000/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry online backup' })).toBeInTheDocument();
  });

  it('reviews a retained copy, blocks recovery during local work, and never replaces existing records', async () => {
    const automatic = automaticBackup();
    renderManage(automatic, { recoveryBlockReason: 'Finish saving your climb and return to the library before recovery.' });
    const reviewButton = await screen.findByRole('button', { name: /Review backup saved/ });
    fireEvent.click(reviewButton);

    expect(await screen.findByRole('heading', { name: 'Review recovery' })).toBeInTheDocument();
    expect(screen.getAllByText('Finish saving your climb and return to the library before recovery.')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Restore 2 climbs and 1 lists' })).toBeDisabled();
    expect(screen.getByText(/original remains retained/)).toBeInTheDocument();
    expect(automatic.review).toHaveBeenCalledWith(snapshot);
    expect(automatic.restore).not.toHaveBeenCalled();
  });

  it('shows conflicts as blocked and does not offer an overwrite path', async () => {
    const conflictingReview = {
      ...onlineReview,
      review: { ...onlineReview.review, conflicts: [{ kind: 'climb' as const, id: 'climb-1' as never, name: 'Existing climb' }] },
    };
    const automatic = automaticBackup(protectedStatus, { review: vi.fn(async () => conflictingReview) });
    renderManage(automatic);
    fireEvent.click(await screen.findByRole('button', { name: /Review backup saved/ }));

    expect(await screen.findByText('Recovery is paused. Nothing was added.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Restore/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Both versions remain unchanged/)).toBeInTheDocument();
  });

  it('refreshes the workspace after commit and retries only the refresh', async () => {
    const onRestored = vi.fn()
      .mockRejectedValueOnce(new Error('view read failed'))
      .mockResolvedValueOnce(undefined);
    const automatic = automaticBackup();
    const onRecoveryBusyChange = vi.fn();
    renderManage(automatic, { onRestored, onRecoveryBusyChange });
    fireEvent.click(await screen.findByRole('button', { name: /Review backup saved/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Restore 2 climbs and 1 lists' }));

    expect(await screen.findByRole('heading', { name: 'Recovery saved' })).toBeInTheDocument();
    expect(await screen.findByText(/the library view could not refresh/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry library refresh' }));
    await waitFor(() => expect(onRestored).toHaveBeenCalledTimes(2));
    expect(automatic.restore).toHaveBeenCalledOnce();
    expect(onRecoveryBusyChange.mock.calls).toEqual([[true], [false]]);
  });

  it('cannot close during the atomic restore', async () => {
    let resolveRestore!: (value: LibraryRestoreOutcome) => void;
    const automatic = automaticBackup(protectedStatus, {
      restore: vi.fn(() => new Promise<LibraryRestoreOutcome>((resolve) => { resolveRestore = resolve; })),
    });
    const rendered = renderManage(automatic);
    fireEvent.click(await screen.findByRole('button', { name: /Review backup saved/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Restore 2 climbs and 1 lists' }));
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(rendered.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Close private backup' })).toBeDisabled();

    resolveRestore({ status: 'complete', drafts: { added: 2, unchanged: 0 }, playlists: { added: 1, unchanged: 0 } });
    await screen.findByRole('heading', { name: 'Recovery saved' });
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(rendered.onClose).toHaveBeenCalledOnce();
  });

  it('allows Escape dismissal while a queued history request is still pending', async () => {
    let resolveHistory!: (value: VaultListing) => void;
    const history = vi.fn(() => new Promise<VaultListing>((resolve) => { resolveHistory = resolve; }));
    const automatic = automaticBackup(protectedStatus, { history });
    const rendered = renderManage(automatic);
    await waitFor(() => expect(history).toHaveBeenCalledOnce());

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(rendered.onClose).toHaveBeenCalledOnce();
    resolveHistory(listing);
  });
});

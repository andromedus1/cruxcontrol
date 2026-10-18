import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AutomaticBackup } from './coordinator.ts';
import { BackupStatusLine } from './BackupStatusLine.tsx';
import type { BackupStatus } from './types.ts';

const base: BackupStatus = {
  phase: 'protected',
  account: { uid: 'user', email: 'climber@example.test' },
  revision: 8,
  protectedRevision: {
    revision: 8,
    verifiedAt: '2026-10-11T10:00:00.000Z',
    snapshot: {
      slot: '00000', bytes: 512, sha256: 'a'.repeat(64), generation: 'g1',
      createdAt: '2026-10-11T09:59:00.000Z', exportedAt: '2026-10-11T09:58:00.000Z',
      counts: { climbs: 5, finished: 3, drafts: 1, trash: 1, playlists: 2 },
    },
  },
  localSaveFailed: false,
  error: null,
};

function automaticBackup(status: BackupStatus): AutomaticBackup {
  return {
    getSnapshot: () => status,
    subscribe: () => () => undefined,
    start: vi.fn(),
    setForeground: vi.fn(),
    retry: vi.fn(async () => undefined),
    signIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    history: vi.fn(),
    review: vi.fn(),
    restore: vi.fn(),
    useLocalLibrary: vi.fn(async () => undefined),
    close: vi.fn(),
  };
}

describe('BackupStatusLine', () => {
  it('states when the current saved revision has a verified online copy', () => {
    render(<BackupStatusLine automaticBackup={automaticBackup(base)} onManage={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('All saved changes backed up');
    expect(screen.getByRole('status')).toHaveTextContent('5 climbs and 2 lists');
    expect(screen.getByRole('button', { name: 'Manage' })).toBeInTheDocument();
  });

  it('does not call a failed local save protected and opens Manage on demand', () => {
    const onManage = vi.fn();
    render(<BackupStatusLine automaticBackup={automaticBackup({ ...base, localSaveFailed: true })} onManage={onManage} />);
    expect(screen.getByRole('status')).toHaveTextContent('A recent save did not finish');
    expect(screen.getByRole('status')).not.toHaveTextContent('All saved changes backed up');
    fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
    expect(onManage).toHaveBeenCalledOnce();
  });
});

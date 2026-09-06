import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AppUpdateService, AppUpdateSnapshot } from './update-service.ts';
import { AppUpdateControl } from './AppUpdateControl.tsx';

function service(snapshot: AppUpdateSnapshot): AppUpdateService {
  let current = snapshot;
  const listeners = new Set<(next: AppUpdateSnapshot) => void>();
  return {
    getSnapshot: () => current,
    subscribe(listener) {
      listeners.add(listener);
      listener(current);
      return () => listeners.delete(listener);
    },
    start: vi.fn(() => Promise.resolve()),
    apply: vi.fn(() => Promise.resolve()),
    setBlocked: vi.fn(),
    dismiss: vi.fn(() => {
      current = { ...current, dismissed: true };
      for (const listener of listeners) listener(current);
    }),
    reopen: vi.fn(() => {
      current = { ...current, dismissed: false };
      for (const listener of listeners) listener(current);
    }),
    reload: vi.fn(),
    dispose: vi.fn(),
  };
}

const waiting: AppUpdateSnapshot = {
  status: 'waiting',
  phase: 'waiting',
  message: 'Disconnect the board when your session is finished before updating.',
  updateAvailable: true,
  blockedReason: 'Disconnect the board when your session is finished before updating.',
  canApply: false,
  dismissed: false,
};

describe('AppUpdateControl', () => {
  it('explains a board blocker and offers an explicit disconnect action', async () => {
    const updateService = service(waiting);
    const disconnect = vi.fn();
    render(<AppUpdateControl service={updateService} boardConnected onDisconnectBoard={disconnect} />);
    expect(screen.getByText(waiting.message)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update and reload' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect board' }));
    await waitFor(() => expect(disconnect).toHaveBeenCalledTimes(1));
  });

  it('keeps an accessible update entry after Later dismisses the banner', () => {
    const updateService = service({ ...waiting, blockedReason: null, canApply: true, message: 'Your library is saved. Reload when you are ready.' });
    render(<AppUpdateControl service={updateService} />);
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(updateService.dismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Update available' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Update available' }));
    expect(updateService.reopen).toHaveBeenCalledTimes(1);
  });
});

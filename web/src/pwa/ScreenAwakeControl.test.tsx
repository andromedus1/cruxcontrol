import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScreenAwakeControl } from './ScreenAwakeControl';

class ScreenLock extends EventTarget {
  released = false;
  release = vi.fn(async () => {
    this.released = true;
    this.dispatchEvent(new Event('release'));
  });
}

function setup(request = vi.fn(async () => new ScreenLock())) {
  vi.stubGlobal('navigator', { wakeLock: { request } });
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const view = render(<ScreenAwakeControl />);
  return { ...view, request, visibility, toggle: screen.getByRole('checkbox', { name: 'Keep screen awake' }) };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ScreenAwakeControl', () => {
  it('is opt-in and releases its screen lock when switched off', async () => {
    const lock = new ScreenLock();
    const { request, toggle } = setup(vi.fn(async () => lock));
    expect(toggle).not.toBeChecked();
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(toggle);
    await screen.findByText(/^Screen awake\./);
    expect(request).toHaveBeenCalledExactlyOnceWith('screen');
    fireEvent.click(toggle);
    await waitFor(() => expect(lock.release).toHaveBeenCalledOnce());
    expect(screen.getByText(/^Prevent automatic screen timeout/)).toBeInTheDocument();
  });

  it('releases while hidden and reacquires on return without forgetting the choice', async () => {
    const first = new ScreenLock();
    const second = new ScreenLock();
    const request = vi.fn(async () => second).mockResolvedValueOnce(first);
    const { toggle, visibility } = setup(request);
    fireEvent.click(toggle);
    await screen.findByText(/^Screen awake\./);
    act(() => {
      visibility.mockReturnValue('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(first.release).toHaveBeenCalledOnce();
    expect(toggle).toBeChecked();
    expect(screen.getByText(/paused while CruxControl is hidden/)).toBeInTheDocument();
    act(() => {
      visibility.mockReturnValue('visible');
      document.dispatchEvent(new Event('visibilitychange'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await screen.findByText(/^Screen awake\./);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('reports device release and waits for explicit retry instead of looping', async () => {
    const first = new ScreenLock();
    const request = vi.fn(async () => new ScreenLock()).mockResolvedValueOnce(first);
    const { toggle } = setup(request);
    fireEvent.click(toggle);
    await screen.findByText(/^Screen awake\./);
    await act(() => first.release());
    expect(screen.getByText(/device released/)).toBeInTheDocument();
    expect(request).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Retry screen awake' }));
    await screen.findByText(/^Screen awake\./);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('reports denial without claiming an active lock and supports retry', async () => {
    const request = vi.fn(async () => new ScreenLock())
      .mockRejectedValueOnce(new DOMException('Power saving', 'NotAllowedError'));
    const { toggle } = setup(request);
    fireEvent.click(toggle);
    await screen.findByText(/device could not keep it awake/);
    expect(request).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Retry screen awake' }));
    await screen.findByText(/^Screen awake\./);
  });

  it.each(['disable', 'unmount'] as const)('releases a late acquisition after %s', async (action) => {
    const lock = new ScreenLock();
    let resolve!: (lock: ScreenLock) => void;
    const request = vi.fn(() => new Promise<ScreenLock>((done) => { resolve = done; }));
    const { toggle, unmount } = setup(request);
    fireEvent.click(toggle);
    expect(screen.getByText('Keeping the screen awake…')).toBeInTheDocument();
    if (action === 'disable') fireEvent.click(toggle);
    else unmount();
    await act(async () => resolve(lock));
    expect(lock.release).toHaveBeenCalledOnce();
    expect(screen.queryByText(/^Screen awake\./)).not.toBeInTheDocument();
  });

  it('disposes a stale hidden-page acquisition without replacing the returned-page lock', async () => {
    const stale = new ScreenLock();
    const current = new ScreenLock();
    let resolve!: (lock: ScreenLock) => void;
    const request = vi.fn(async () => current)
      .mockImplementationOnce(() => new Promise<ScreenLock>((done) => { resolve = done; }));
    const { toggle, visibility, unmount } = setup(request);
    fireEvent.click(toggle);
    act(() => {
      visibility.mockReturnValue('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
      visibility.mockReturnValue('visible');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await screen.findByText(/^Screen awake\./);
    await act(async () => resolve(stale));
    expect(stale.release).toHaveBeenCalledOnce();
    expect(current.release).not.toHaveBeenCalled();
    expect(screen.getByText(/^Screen awake\./)).toBeInTheDocument();
    unmount();
    expect(current.release).toHaveBeenCalledOnce();
  });

  it('does not claim a lock that the device released before acquisition completed', async () => {
    const lock = new ScreenLock();
    await lock.release();
    const { toggle } = setup(vi.fn(async () => lock));
    fireEvent.click(toggle);
    await screen.findByText(/device released/);
    expect(screen.queryByText(/^Screen awake\./)).not.toBeInTheDocument();
  });

  it('shows an unavailable control when the browser lacks the API', () => {
    vi.stubGlobal('navigator', {});
    render(<ScreenAwakeControl />);
    expect(screen.getByRole('checkbox', { name: 'Keep screen awake' })).toBeDisabled();
    expect(screen.getByText(/unavailable in this browser/)).toBeInTheDocument();
  });
});

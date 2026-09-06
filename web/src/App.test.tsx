import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App.tsx';
import { createAppInstallationRegistry, activeInstallationId } from './app/installations';
import type { CruxControlRuntime } from './app/create-runtime';
import { createAppUpdateService } from './pwa/update-service.ts';

class TestRegistration extends EventTarget {
  active: ServiceWorker | null = null;
  waiting: ServiceWorker | null = null;
  installing: ServiceWorker | null = null;
}

class TestServiceWorkerContainer extends EventTarget {
  controller: ServiceWorker | null = null;
  readonly register = vi.fn();
}

function testRuntime(): CruxControlRuntime {
  return {
    installation: createAppInstallationRegistry().require(activeInstallationId),
    drafts: {
      create: vi.fn(),
      get: vi.fn(),
      list: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      trash: vi.fn(),
      restore: vi.fn(),
      deletePermanently: vi.fn(),
    },
    playlists: {
      create: vi.fn(),
      get: vi.fn(),
      list: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      delete: vi.fn(),
    },
    controller: null,
    close: vi.fn(),
  };
}

describe('App', () => {
  it('renders the honest local workspace without fabricated climbs', async () => {
    const runtime: CruxControlRuntime = {
      installation: createAppInstallationRegistry().require(activeInstallationId),
      drafts: {
        create: vi.fn(),
        get: vi.fn(),
        list: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
        trash: vi.fn(),
        restore: vi.fn(),
        deletePermanently: vi.fn(),
      },
      playlists: {
        create: vi.fn(),
        get: vi.fn(),
        list: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
        delete: vi.fn(),
      },
      controller: null,
      close: vi.fn(),
    };
    render(<App createRuntime={() => Promise.resolve(runtime)} />);
    expect(await screen.findByRole('heading', { name: 'My Climbs' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No finished climbs yet' })).toBeInTheDocument();
  });

  it('keeps a registration error visible through mounted workspace blocker changes and retries in place', async () => {
    const container = new TestServiceWorkerContainer();
    const registration = new TestRegistration();
    container.register.mockRejectedValueOnce(new Error('Service worker script unavailable.'));
    container.register.mockResolvedValueOnce(registration as unknown as ServiceWorkerRegistration);
    const locks = {
      request: vi.fn(async (_name: string, _options: LockOptions, callback: (lock: Lock) => Promise<unknown>) =>
        callback({ name: 'cruxcontrol-app', mode: 'shared' } as Lock),
      ),
    } as unknown as LockManager;
    const service = createAppUpdateService({
      container: container as unknown as ServiceWorkerContainer,
      locks,
    });
    const runtime = testRuntime();
    const createRuntime = vi.fn(async () => runtime);

    try {
      render(
        <App
          createRuntime={createRuntime}
          updateService={service}
          startupAdmission={service.start()}
        />,
      );

      expect(await screen.findByRole('heading', { name: 'My Climbs' })).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Service worker script unavailable.');
      expect(screen.getByText('CruxControl update error')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Lists.*0 lists/ }));
      fireEvent.change(screen.getByLabelText('New list'), { target: { value: 'Warmups' } });
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent('Service worker script unavailable.'),
      );
      fireEvent.change(screen.getByLabelText('New list'), { target: { value: '' } });
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent('Service worker script unavailable.'),
      );

      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      await waitFor(() => expect(container.register).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByText('CruxControl update error')).toBeNull());
      expect(createRuntime).toHaveBeenCalledOnce();
      expect(screen.getByRole('heading', { name: 'Lists' })).toBeInTheDocument();
    } finally {
      service.dispose();
    }
  });
});

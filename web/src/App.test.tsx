import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App.tsx';
import { createAppInstallationRegistry, activeInstallationId } from './app/installations';
import type { CruxControlRuntime } from './app/create-runtime';

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
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogStorageStatus } from '../data/catalog/bootstrap-port.ts';
import type { CatalogDownloadProgress, CatalogManifest } from '../data/catalog/manifest.ts';
import type { CatalogReceipt } from '../data/sqlite/catalog-receipt.ts';
import type { CatalogService, CatalogServiceSnapshot } from './service.ts';
import { CatalogManageDialog } from './CatalogManageDialog.tsx';

const offer: CatalogManifest = {
  schemaVersion: 2,
  version: 1,
  board: 'kilter-fullride-7x10',
  file: 'kilter-7x10.v1.db.gz',
  compression: 'gzip',
  sha256: 'a'.repeat(64),
  bytesGzipped: 5_100_000,
  bytesRaw: 12_400_000,
  generatedOn: '2026-10-09',
  source: 'legacy-aurora-kilter',
  sourceDataThrough: null,
  generatedFrom: 'synthetic fixture',
  filter: 'layout_id=8',
};
const installedReceipt: CatalogReceipt = {
  schemaVersion: 1,
  slot: 'a',
  manifest: offer,
  installedAt: '2026-10-10T00:00:00.000Z',
};

function snapshot(
  storage: CatalogStorageStatus = { status: 'empty' },
  extra: Partial<CatalogServiceSnapshot> = {},
): CatalogServiceSnapshot {
  return {
    storage,
    operation: 'idle',
    offer: null,
    progress: null,
    error: null,
    queries: null,
    ...extra,
  };
}

function serviceFor(initial: CatalogServiceSnapshot) {
  let current = initial;
  const listeners = new Set<() => void>();
  const service: CatalogService = {
    getSnapshot: () => current,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    start: vi.fn(async () => undefined),
    loadOffer: vi.fn(async () => undefined),
    installOffer: vi.fn(async () => undefined),
    cancelDownload: vi.fn(),
    retryOpen: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
  return {
    service,
    publish(next: CatalogServiceSnapshot) {
      current = next;
      for (const listener of [...listeners]) listener();
    },
  };
}

describe('CatalogManageDialog', () => {
  it('loads metadata only, then requires explicit consent to fetch and install the displayed offer', async () => {
    const value = serviceFor(snapshot());
    const onClose = vi.fn();
    render(<CatalogManageDialog service={value.service} onClose={onClose} statusAnnouncement="Checking catalog details." />);
    await waitFor(() => expect(value.service.loadOffer).toHaveBeenCalledOnce());
    expect(value.service.installOffer).not.toHaveBeenCalled();
    // Before any manifest is read the dialog claims no particular source.
    expect(screen.getByRole('heading', { name: 'Kilter catalog' })).toBeInTheDocument();
    expect(screen.queryByText(/Source freshness: unknown/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Boardsesh/)).not.toBeInTheDocument();

    act(() => value.publish(snapshot({ status: 'empty' }, { offer })));
    expect(screen.getByRole('heading', { name: 'Legacy Kilter catalog' })).toBeInTheDocument();
    expect(screen.getByText(/Source freshness: unknown/)).toBeInTheDocument();
    expect(screen.getByText(/not the current Kilter library/)).toBeInTheDocument();
    expect(screen.getByText(/5.1 MB download · 12.4 MB catalog data/)).toBeInTheDocument();
    expect(screen.getByText(/Snapshot generated:/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Download 5.1 MB' }));
    expect(value.service.installOffer).toHaveBeenCalledOnce();
    expect(value.service.cancelDownload).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows bounded progress and only offers cancellation before verification and activation', () => {
    const progress: CatalogDownloadProgress = { receivedBytes: 2_550_000, totalBytes: offer.bytesGzipped };
    const value = serviceFor(snapshot({ status: 'empty' }, {
      operation: 'downloading',
      offer,
      progress,
    }));
    render(<CatalogManageDialog service={value.service} onClose={() => undefined} statusAnnouncement="Catalog download 50% received." />);
    const content = screen.getByRole('dialog').querySelector('.catalog-manage-dialog__content');
    expect(content).not.toHaveAttribute('aria-live');
    expect(screen.getByRole('status')).toHaveTextContent('Catalog download 50% received.');
    expect(screen.getByRole('progressbar', { name: 'Legacy Kilter catalog download' })).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('Downloading Legacy Kilter…')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel download' }));
    expect(value.service.cancelDownload).toHaveBeenCalledOnce();

    act(() => value.publish(snapshot({ status: 'empty' }, { operation: 'installing', offer })));
    expect(screen.getByText('Verifying and installing the catalog…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel download' })).not.toBeInTheDocument();
  });

  it('shows receipt dates and sizes without inferring source freshness or offering replacement', () => {
    const value = serviceFor(snapshot({ status: 'ready', receipt: installedReceipt }));
    render(<CatalogManageDialog service={value.service} onClose={() => undefined} statusAnnouncement="1 climb loaded on page 1." />);
    expect(screen.getByText('Available offline on this device.')).toBeInTheDocument();
    expect(screen.getByText(/Snapshot generated:/)).toBeInTheDocument();
    expect(screen.getByText(/Installed on this device:/)).toBeInTheDocument();
    expect(screen.getByText(/Source freshness: unknown/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download|Retry|Check again/ })).not.toBeInTheDocument();
    expect(value.service.loadOffer).not.toHaveBeenCalled();
  });

  it('describes an installed Boardsesh catalog as unofficial community data with its version and dates', () => {
    const { sourceDataThrough: _legacyOnly, ...identity } = offer as Extract<CatalogManifest, { schemaVersion: 2 }>;
    const boardsesh: CatalogManifest = {
      ...identity,
      schemaVersion: 3,
      version: 2,
      file: 'kilter-7x10.v2.db.gz',
      generatedOn: '2026-10-19',
      source: 'boardsesh-kilter',
      sourceBuiltAt: '2026-10-18T22:00:00.000Z',
      sourceWatermarks: {},
      layoutRevision: 'kilter:7:8:17:f0d70b3db9a6',
      qualityScale: { min: 0, max: 5 },
      climbCount: 13_299,
      removedUpstreamCount: 33,
      changes: { added: 40, removed: 33, restored: 0 },
    };
    const value = serviceFor(snapshot({ status: 'ready', receipt: { ...installedReceipt, manifest: boardsesh } }));
    render(<CatalogManageDialog service={value.service} onClose={() => undefined} statusAnnouncement="" />);
    const dialog = screen.getByRole('dialog', { name: 'Kilter community catalog' });
    expect(dialog).toHaveTextContent('Kilter community climbs via Boardsesh. Not official Kilter data');
    expect(dialog).toHaveTextContent('each climb credits its setter');
    expect(dialog).toHaveTextContent('Catalog version 2, built Oct 19, 2026 from the Boardsesh snapshot of Oct 18, 2026.');
    expect(dialog).toHaveTextContent('13,299 climbs, including 33 removed upstream and kept so your lists keep working.');
    expect(dialog).toHaveTextContent('Ratings use a 0–5 scale. Sends count distinct climbers and can go down as well as up between catalog versions.');
    expect(dialog).not.toHaveTextContent(/Older offline snapshot|Source freshness: unknown|Snapshot generated/);
    expect(screen.getByText(/Installed on this device:/)).toBeInTheDocument();

    act(() => value.publish(snapshot({ status: 'ready', receipt: {
      ...installedReceipt,
      manifest: { ...boardsesh, removedUpstreamCount: null, changes: null },
    } })));
    expect(dialog).toHaveTextContent('13,299 climbs.');
    expect(dialog).not.toHaveTextContent('removed upstream');
  });

  it('keeps metadata retry, same-offer download retry, busy recovery, and unsupported copy distinct', () => {
    const failedCheck = serviceFor(snapshot({ status: 'empty' }, {
      error: { code: 'manifest', message: 'Catalog details could not be loaded.' },
    }));
    const first = render(<CatalogManageDialog service={failedCheck.service} onClose={() => undefined} statusAnnouncement="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(failedCheck.service.loadOffer).toHaveBeenCalledOnce();
    first.unmount();

    const failedDownload = serviceFor(snapshot({ status: 'empty' }, {
      offer,
      error: { code: 'network', message: 'The catalog download failed.' },
    }));
    render(<CatalogManageDialog service={failedDownload.service} onClose={() => undefined} statusAnnouncement="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry download' }));
    expect(failedDownload.service.installOffer).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Check again' })).not.toBeInTheDocument();

    act(() => failedDownload.publish(snapshot({ status: 'unavailable', code: 'busy', message: 'Another tab owns it.' })));
    expect(screen.getByText(/Another CruxControl tab currently owns this catalog/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry catalog' }));
    expect(failedDownload.service.retryOpen).toHaveBeenCalledOnce();

    act(() => failedDownload.publish(snapshot({ status: 'unavailable', code: 'unsupported', message: 'OPFS unavailable.' })));
    expect(screen.getByText(/Offline catalog storage is unavailable in this browser/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry catalog' })).not.toBeInTheDocument();
    expect(screen.getByText(/Your local climbs and lists remain usable/)).toBeInTheDocument();
  });
});

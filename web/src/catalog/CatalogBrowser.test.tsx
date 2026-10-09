import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MockBoardByteTransport } from '../board-control/mock-byte-transport.ts';
import { createFullrideLightController } from '../board-control/light-controller.ts';
import { lightSceneFromAssignments } from '../climb-browser/light-scene.ts';
import { providerClimbViewKey } from '../climb-browser/types.ts';
import { kilterFullride7x10Definition as definition, KILTER_PROVIDER_ID } from '../domain/boards/definitions/kilter-fullride-7x10.ts';
import { providerSourceId } from '../domain/boards/identity.ts';
import type { CatalogManifest } from '../data/catalog/manifest.ts';
import type { CatalogReceipt } from '../data/sqlite/catalog-receipt.ts';
import type { CatalogQueryPort, CatalogClimb, CatalogClimbQuery, CatalogCursor, CatalogPage, CatalogRead } from './types.ts';
import type { CatalogService, CatalogServiceSnapshot } from './service.ts';
import { CatalogBrowser } from './CatalogBrowser.tsx';

const manifest: CatalogManifest = {
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
const receipt: CatalogReceipt = { schemaVersion: 1, slot: 'a', manifest, installedAt: '2026-10-10T00:00:00.000Z' };
const cursorOne = 'cursor-one' as CatalogCursor;

function climb(name: string, source: string, angle = 40): CatalogClimb {
  const providerClimbId = Object.freeze({
    provider: KILTER_PROVIDER_ID,
    sourceId: providerSourceId(source),
    layoutRevision: definition.layoutRevision,
  });
  return Object.freeze({
    key: providerClimbViewKey(providerClimbId),
    name,
    angle,
    assignments: Object.freeze([
      { placementId: definition.placements[0]!.id, appearance: { kind: 'role' as const, role: 'start' as const } },
      { placementId: definition.placements[1]!.id, appearance: { kind: 'role' as const, role: 'middle' as const } },
      { placementId: definition.placements[2]!.id, appearance: { kind: 'role' as const, role: 'finish' as const } },
      { placementId: definition.placements[3]!.id, appearance: { kind: 'role' as const, role: 'foot-only' as const } },
    ]),
    origin: 'provider',
    grade: 'V1',
    setter: 'Synthetic setter',
    description: 'A complete synthetic route.',
    providerClimbId,
    gradeValue: 12,
    nativeGrades: { scale: 'kilter-difficulty', display: 12, community: 12, benchmark: null },
    statistics: { ascentCount: 4, quality: 2.4 },
  });
}

function page(climbs: readonly CatalogClimb[], nextCursor: CatalogCursor | null = null): CatalogRead<CatalogPage> {
  return { status: 'ready', value: { climbs, nextCursor, excludedCount: 0 } };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function queryPort(options: {
  query?: CatalogQueryPort['query'];
  grades?: CatalogQueryPort['grades'];
} = {}): CatalogQueryPort {
  return {
    provenance: { source: 'Legacy Kilter (Aurora)', snapshotId: manifest.sha256, retrievedAt: null, coverage: null },
    query: options.query ?? (async () => page([])),
    get: async () => ({ status: 'ready', value: null }),
    grades: options.grades ?? (async () => ({ status: 'ready', value: [
      { value: 12, label: 'V1' }, { value: 18, label: 'V4' },
    ] })),
  };
}

function serviceFor(adapter: CatalogQueryPort, initial?: Partial<CatalogServiceSnapshot>) {
  let snapshot: CatalogServiceSnapshot = {
    storage: { status: 'ready', receipt },
    operation: 'idle',
    offer: null,
    progress: null,
    error: null,
    queries: adapter,
    ...initial,
  };
  const listeners = new Set<() => void>();
  const service: CatalogService = {
    getSnapshot: () => snapshot,
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
      snapshot = next;
      for (const listener of [...listeners]) listener();
    },
  };
}

function renderBrowser(adapter: CatalogQueryPort, props: { controller?: ReturnType<typeof createFullrideLightController> | null } = {}) {
  const service = serviceFor(adapter);
  const manageChanged = vi.fn();
  const view = render(
    <CatalogBrowser
      service={service.service}
      definition={definition}
      defaultAngle={40}
      controller={props.controller ?? null}
      onManageOpenChange={manageChanged}
    />,
  );
  return { ...view, ...service, manageChanged };
}

afterEach(() => vi.useRealTimers());

describe('CatalogBrowser', () => {
  it('loads grade choices once and sends adapter labels, exact grade bounds, and configured angles', async () => {
    vi.useFakeTimers();
    const route = climb('Echo Chamber', 'echo');
    const query = vi.fn(async (input: CatalogClimbQuery) => {
      const matches = (input.angle === 40)
        && (!input.name || route.name.toLowerCase().includes(input.name.toLowerCase()))
        && (input.minGrade === undefined || (input.minGrade === 12 && input.maxGrade === 12));
      return page(matches ? [route] : []);
    });
    const grades = vi.fn(async () => ({ status: 'ready' as const, value: [
      { value: 12, label: 'V1' }, { value: 18, label: 'V4' },
    ] }));
    const adapter = queryPort({ query, grades });
    renderBrowser(adapter);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByRole('button', { name: /Echo Chamber/ })).toBeInTheDocument();
    expect(query).toHaveBeenCalledWith({ angle: 40, name: '', limit: 25 });
    expect(grades).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Grade')).toHaveDisplayValue('All grades');

    fireEvent.change(screen.getByLabelText('Grade'), { target: { value: '12' } });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(query).toHaveBeenLastCalledWith({ angle: 40, name: '', minGrade: 12, maxGrade: 12, limit: 25 });
    fireEvent.change(screen.getByLabelText('Angle'), { target: { value: '45' } });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(query).toHaveBeenLastCalledWith({ angle: 45, name: '', minGrade: 12, maxGrade: 12, limit: 25 });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'echo' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(199); });
    expect(query).toHaveBeenCalledTimes(3);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); await Promise.resolve(); await Promise.resolve(); });
    expect(query).toHaveBeenLastCalledWith({ angle: 45, name: 'echo', minGrade: 12, maxGrade: 12, limit: 25 });
    expect(grades).toHaveBeenCalledOnce();
  });

  it('debounces name input, clears selection immediately, and ignores late reads from earlier filters', async () => {
    vi.useFakeTimers();
    const first = climb('Echo Chamber', 'echo');
    const late = climb('Old angle response', 'late', 45);
    const current = climb('Current angle response', 'current', 55);
    const secondRead = deferred<CatalogRead<CatalogPage>>();
    const query = vi.fn<CatalogQueryPort['query']>()
      .mockResolvedValueOnce(page([first]))
      .mockReturnValueOnce(secondRead.promise)
      .mockResolvedValueOnce(page([current]))
      .mockResolvedValueOnce(page([current]));
    const adapter = queryPort({ query });
    renderBrowser(adapter);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const routeButton = screen.getByRole('button', { name: /Echo Chamber/ });
    fireEvent.click(routeButton);
    expect(screen.getByRole('heading', { name: 'Echo Chamber' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Angle'), { target: { value: '45' } });
    expect(screen.queryByRole('heading', { name: 'Echo Chamber' })).not.toBeInTheDocument();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(query).toHaveBeenCalledTimes(2);
    fireEvent.change(screen.getByLabelText('Angle'), { target: { value: '55' } });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(query).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('button', { name: /Current angle response/ })).toBeInTheDocument();
    await act(async () => { secondRead.resolve(page([late])); await secondRead.promise; });
    expect(screen.getByRole('button', { name: /Current angle response/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Old angle response/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'current' } });
    expect(screen.queryByRole('button', { name: /Current angle response/ })).not.toBeInTheDocument();
    expect(query).toHaveBeenCalledTimes(3);
    await act(async () => { await vi.advanceTimersByTimeAsync(199); });
    expect(query).toHaveBeenCalledTimes(3);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(query).toHaveBeenCalledTimes(4);
    expect(query).toHaveBeenLastCalledWith({ angle: 55, name: 'current', limit: 25 });
  });

  it('keeps Next enabled on an empty continuable page and reissues bounded cursor history', async () => {
    const second = climb('Cursor result', 'cursor-result');
    const query = vi.fn<CatalogQueryPort['query']>()
      .mockResolvedValueOnce(page([], cursorOne))
      .mockResolvedValueOnce(page([second]))
      .mockResolvedValueOnce(page([], cursorOne));
    renderBrowser(queryPort({ query }));
    await screen.findByRole('heading', { name: 'No compatible climbs on this page' });
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    expect(screen.getByText('Page 1 · 0 climbs on this page')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('button', { name: /Cursor result/ });
    expect(query).toHaveBeenLastCalledWith({ angle: 40, name: '', limit: 25, cursor: cursorOne });
    expect(screen.getByText('Page 2 · 1 climb on this page')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await screen.findByRole('heading', { name: 'No compatible climbs on this page' });
    expect(query).toHaveBeenCalledTimes(3);
    expect(query).toHaveBeenLastCalledWith({ angle: 40, name: '', limit: 25 });
  });

  it('passes a complete provider route through the real viewer and lighting controller', async () => {
    const route = climb('Complete scene', 'complete-scene');
    const adapter = queryPort({ query: async () => page([route]) });
    const transport = new MockBoardByteTransport();
    const controller = createFullrideLightController({ definition, transport });
    await controller.requestAndConnect();
    renderBrowser(adapter, { controller });
    fireEvent.click(await screen.findByRole('button', { name: /Complete scene/ }));
    expect(screen.getByText('Legacy Kilter · read only')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Complete scene' })).toBeInTheDocument();
    await waitFor(() => expect(transport.operations.filter(({ type }) => type === 'write')).toHaveLength(1), { timeout: 4_000 });
    expect(controller.getState().lastAppliedScene).toEqual(lightSceneFromAssignments(definition, route.assignments));
    expect(controller.getState().lastAppliedScene).toHaveLength(4);
  });

  it('returns focus from Manage and reports its open admission state', async () => {
    const route = climb('Selectable route', 'selectable');
    const query = vi.fn(async () => page([route]));
    const service = serviceFor(queryPort({ query }));
    const manageChanged = vi.fn();
    render(
      <CatalogBrowser
        service={service.service}
        definition={definition}
        defaultAngle={40}
        controller={null}
        onManageOpenChange={manageChanged}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Selectable route/ }));
    const manage = screen.getByRole('button', { name: 'Manage' });
    fireEvent.click(manage);
    const dialog = await screen.findByRole('dialog', { name: 'Legacy Kilter catalog' });
    await waitFor(() => expect(manageChanged).toHaveBeenLastCalledWith(true));
    expect(screen.queryByRole('heading', { name: 'Selectable route' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Legacy Kilter catalog' })).toHaveFocus();
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Legacy Kilter catalog' })).not.toBeInTheDocument());
    await waitFor(() => expect(manage).toHaveFocus());
    expect(screen.getByRole('button', { name: /Selectable route/ })).toBeInTheDocument();
    expect(query).toHaveBeenCalledOnce();
    expect(manageChanged).toHaveBeenLastCalledWith(false);
  });
});

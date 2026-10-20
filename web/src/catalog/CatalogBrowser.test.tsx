import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBackNavigation } from '../app/back-navigation.ts';
import { backNavigationContext } from '../app/use-back-action.ts';
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
    ratingScale: { min: 0, max: 3 },
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
  it('loads grades for the filter sheet and queries its committed bounds with angle and sort', async () => {
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
    expect(query).toHaveBeenCalledWith({ angle: 40, name: '', sort: 'rating', limit: 25 });
    expect(grades).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Angle')).toHaveDisplayValue('40°');
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const dialog = screen.getByRole('dialog', { name: 'Filter climbs' });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(dialog).not.toBeInTheDocument();
    expect(query).toHaveBeenLastCalledWith({ angle: 40, name: '', minGrade: 12, maxGrade: 12, sort: 'rating', limit: 25 });
    fireEvent.change(screen.getByLabelText('Angle'), { target: { value: '45' } });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(query).toHaveBeenLastCalledWith({ angle: 45, name: '', minGrade: 12, maxGrade: 12, sort: 'rating', limit: 25 });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'echo' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(199); });
    expect(query).toHaveBeenCalledTimes(3);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); await Promise.resolve(); await Promise.resolve(); });
    expect(query).toHaveBeenLastCalledWith({ angle: 45, name: 'echo', minGrade: 12, maxGrade: 12, sort: 'rating', limit: 25 });
    expect(grades).toHaveBeenCalledOnce();
  });

  it('keeps filter edits in the sheet until Apply and rejects invalid ranges', async () => {
    const query = vi.fn(async () => page([]));
    renderBrowser(queryPort({ query }));
    await screen.findByText('Page 1 · 0 climbs on this page');
    const trigger = screen.getByRole('button', { name: 'Filters' });
    fireEvent.click(trigger);
    let dialog = screen.getByRole('dialog', { name: 'Filter climbs' });
    fireEvent.change(screen.getByLabelText('Minimum rating'), { target: { value: '2.5' } });
    fireEvent.change(screen.getByLabelText('Minimum sends'), { target: { value: '10' } });
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog', { name: 'Filter climbs' })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(query).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Remove minimum rating filter' })).not.toBeInTheDocument();

    fireEvent.click(trigger);
    dialog = screen.getByRole('dialog', { name: 'Filter climbs' });
    expect(screen.getByLabelText('Minimum rating')).toHaveValue(null);
    expect(screen.getByLabelText('Minimum sends')).toHaveValue(null);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '18' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '12' } });
    fireEvent.submit(dialog.querySelector('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('Check the grade range');
    expect(screen.getByRole('dialog', { name: 'Filter climbs' })).toBeInTheDocument();
    expect(query).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByLabelText('From')).toHaveValue('');
    expect(screen.getByLabelText('To')).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Minimum rating'), { target: { value: '4' } });
    fireEvent.submit(dialog.querySelector('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('rating from 0 to 3');
    expect(query).toHaveBeenCalledOnce();
  });

  it('discards sheet edits on native Back while preserving the selected climb beneath it', async () => {
    const back = createBackNavigation();
    const query = vi.fn(async () => page([climb('Selected route', 'selected')]));
    const { service } = serviceFor(queryPort({ query }));
    render(
      <backNavigationContext.Provider value={back}>
        <CatalogBrowser
          service={service}
          definition={definition}
          defaultAngle={40}
          controller={null}
          onManageOpenChange={vi.fn()}
        />
      </backNavigationContext.Provider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Selected route/ }));
    const trigger = screen.getByRole('button', { name: 'Filters' });
    fireEvent.click(trigger);
    fireEvent.change(screen.getByLabelText('Minimum rating'), { target: { value: '2.5' } });
    act(() => { expect(back.dispatch()).toBe(true); });
    expect(screen.queryByRole('dialog', { name: 'Filter climbs' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Selected route' })).toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(query).toHaveBeenCalledOnce();
    fireEvent.click(trigger);
    expect(screen.getByLabelText('Minimum rating')).toHaveValue(null);
    act(() => { expect(back.dispatch()).toBe(true); });
    act(() => { expect(back.dispatch()).toBe(true); });
    expect(screen.queryByRole('heading', { name: 'Selected route' })).not.toBeInTheDocument();
  });

  it('shows catalog statistics and removes one applied filter while clearing the selection', async () => {
    const route = climb('Statistics route', 'statistics');
    const query = vi.fn(async () => page([route]));
    renderBrowser(queryPort({ query }));
    fireEvent.click(await screen.findByRole('button', { name: /Statistics route/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const dialog = screen.getByRole('dialog', { name: 'Filter climbs' });
    fireEvent.change(screen.getByLabelText('Minimum rating'), { target: { value: '2.1' } });
    fireEvent.change(screen.getByLabelText('Minimum sends'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Setter'), { target: { value: 'Synthetic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await screen.findByRole('button', { name: /Statistics route/ });
    expect(dialog).not.toBeInTheDocument();
    expect(query).toHaveBeenLastCalledWith({
      angle: 40,
      name: '',
      minRating: 2.1,
      minAscents: 4,
      setter: 'Synthetic',
      sort: 'rating',
      limit: 25,
    });
    expect(screen.getByText('★ 2.4 / 3 · 4 sends')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove minimum rating filter' })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Remove minimum rating filter'));
    expect(screen.queryByRole('heading', { name: 'Statistics route' })).not.toBeInTheDocument();
    await screen.findByRole('button', { name: /Statistics route/ });
    expect(query).toHaveBeenLastCalledWith({
      angle: 40,
      name: '',
      minAscents: 4,
      setter: 'Synthetic',
      sort: 'rating',
      limit: 25,
    });

    fireEvent.click(screen.getByRole('button', { name: /Statistics route/ }));
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'name' } });
    expect(screen.queryByRole('heading', { name: 'Statistics route' })).not.toBeInTheDocument();
    await screen.findByRole('button', { name: /Statistics route/ });
    expect(query).toHaveBeenLastCalledWith({
      angle: 40,
      name: '',
      minAscents: 4,
      setter: 'Synthetic',
      sort: 'name',
      limit: 25,
    });
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
    expect(query).toHaveBeenLastCalledWith({ angle: 55, name: 'current', sort: 'rating', limit: 25 });
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
    expect(query).toHaveBeenLastCalledWith({ angle: 40, name: '', sort: 'rating', limit: 25, cursor: cursorOne });
    expect(screen.getByText('Page 2 · 1 climb on this page')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await screen.findByRole('heading', { name: 'No compatible climbs on this page' });
    expect(query).toHaveBeenCalledTimes(3);
    expect(query).toHaveBeenLastCalledWith({ angle: 40, name: '', sort: 'rating', limit: 25 });
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

  it('returns setup focus to Manage when installation removes the setup trigger', async () => {
    const adapter = queryPort();
    const service = serviceFor(adapter, {
      storage: { status: 'empty' },
      queries: null,
    });
    render(
      <CatalogBrowser
        service={service.service}
        definition={definition}
        defaultAngle={40}
        controller={null}
        onManageOpenChange={() => undefined}
      />,
    );

    expect(screen.getByText('Set up the offline catalog to search and preview compatible climbs.')).toBeInTheDocument();
    const setup = screen.getByRole('button', { name: 'Set up offline catalog' });
    fireEvent.click(setup);
    const dialog = await screen.findByRole('dialog', { name: 'Kilter catalog' });
    expect(screen.getAllByRole('status')).toHaveLength(1);
    act(() => service.publish({
      ...service.service.getSnapshot(),
      storage: { status: 'ready', receipt },
      offer: null,
      queries: adapter,
    }));
    expect(screen.queryByRole('button', { name: 'Set up offline catalog' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Manage' })).toHaveFocus());
  });
});

const boardseshManifest: CatalogManifest = {
  schemaVersion: 3,
  version: 2,
  board: 'kilter-fullride-7x10',
  file: 'kilter-7x10.v2.db.gz',
  compression: 'gzip',
  sha256: 'b'.repeat(64),
  bytesGzipped: 4_970_000,
  bytesRaw: 11_770_000,
  generatedOn: '2026-10-19',
  source: 'boardsesh-kilter',
  sourceBuiltAt: '2026-10-19T18:38:11.515Z',
  sourceWatermarks: {},
  layoutRevision: 'kilter:7:8:17:f0d70b3db9a6',
  qualityScale: { min: 0, max: 5 },
  climbCount: 13_299,
  removedUpstreamCount: 33,
  changes: null,
  generatedFrom: 'synthetic fixture',
  filter: 'layout_id=8',
};
const boardseshReceipt: CatalogReceipt = {
  schemaVersion: 1, slot: 'b', manifest: boardseshManifest, installedAt: '2026-10-20T00:00:00.000Z',
};

function boardseshPort(query: CatalogQueryPort['query']): CatalogQueryPort {
  return {
    ...queryPort({ query }),
    provenance: { source: 'Kilter community climbs via Boardsesh', snapshotId: boardseshManifest.sha256, retrievedAt: null, coverage: null },
    ratingScale: { min: 0, max: 5 },
  };
}

function renderBoardsesh(adapter: CatalogQueryPort) {
  const service = serviceFor(adapter, { storage: { status: 'ready', receipt: boardseshReceipt } });
  render(
    <CatalogBrowser
      service={service.service}
      definition={definition}
      defaultAngle={40}
      controller={null}
      onManageOpenChange={() => undefined}
    />,
  );
  return service;
}

describe('CatalogBrowser with a Boardsesh-derived catalog', () => {
  it('names the community source, credits setters and badges climbs removed upstream', async () => {
    const removed = { ...climb('Gone upstream', 'gone'), upstreamRemovedOn: '2026-10-26' };
    const present = climb('Still listed', 'listed');
    renderBoardsesh(boardseshPort(async () => page([removed, present])));
    const source = screen.getByRole('region', { name: 'Catalog source' });
    expect(source).toHaveTextContent(/Kilter community climbs via Boardsesh · updated Oct 19, 2026/);
    expect(source).toHaveTextContent('Not official Kilter data · setters credited');
    expect(source).not.toHaveTextContent(/Legacy|Older offline snapshot/);

    const removedRow = await screen.findByRole('button', { name: /Gone upstream/ });
    expect(screen.getByLabelText('Filter Kilter community climbs')).toBeInTheDocument();
    const presentRow = screen.getByRole('button', { name: /Still listed/ });
    expect(removedRow).toHaveTextContent('Removed upstream');
    expect(presentRow).not.toHaveTextContent('Removed upstream');
    expect(removedRow).toHaveTextContent('set by Synthetic setter');
    expect(removedRow).toHaveTextContent('★ 2.4 / 5 · 4 sends');

    fireEvent.click(removedRow);
    const detail = screen.getByRole('heading', { name: 'Gone upstream' }).closest('article')!;
    expect(detail).toHaveTextContent('Kilter community via Boardsesh · read only');
    expect(detail).toHaveTextContent('Removed upstream');
    expect(detail).toHaveTextContent('No longer listed upstream since Oct 26, 2026. It stays searchable, playable and in your lists.');
    expect(detail).toHaveTextContent('Set bySynthetic setter');

    fireEvent.click(presentRow);
    const presentDetail = screen.getByRole('heading', { name: 'Still listed' }).closest('article')!;
    expect(presentDetail).not.toHaveTextContent('Removed upstream');
  });

  it('validates and summarizes the minimum rating on the declared 0–5 scale', async () => {
    const query = vi.fn<CatalogQueryPort['query']>(async () => page([climb('Five point', 'five')]));
    renderBoardsesh(boardseshPort(query));
    await screen.findByRole('button', { name: /Five point/ });
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const dialog = screen.getByRole('dialog', { name: 'Filter climbs' });
    expect(dialog).toHaveTextContent('Kilter community');
    expect(dialog).toHaveTextContent(
      'Rating uses a 0–5 scale. Sends count distinct climbers at this angle and can go down as well as up between catalog versions.',
    );
    const rating = screen.getByLabelText('Minimum rating');
    expect(rating).toHaveAttribute('max', '5');
    fireEvent.change(rating, { target: { value: '5.5' } });
    fireEvent.submit(dialog.querySelector('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('rating from 0 to 5');
    expect(query).toHaveBeenCalledOnce();

    fireEvent.change(rating, { target: { value: '4.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(query).toHaveBeenLastCalledWith({
      angle: 40, name: '', minRating: 4.5, sort: 'rating', limit: 25,
    }));
    expect(screen.getByRole('button', { name: 'Remove minimum rating filter' })).toHaveTextContent('Rating ≥ 4.5 / 5');
  });

  it('keeps the legacy three-star hint for the legacy snapshot', async () => {
    renderBrowser(queryPort({ query: async () => page([climb('Legacy route', 'legacy')]) }));
    await screen.findByRole('button', { name: /Legacy route/ });
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByRole('dialog', { name: 'Filter climbs' }))
      .toHaveTextContent('Rating uses a three-star scale. Sends count distinct climbers at this angle.');
    expect(screen.getByLabelText('Minimum rating')).toHaveAttribute('max', '3');
  });

  it('drops a committed rating outside the scale of a newly installed catalog instead of failing the query', async () => {
    const boardseshQuery = vi.fn<CatalogQueryPort['query']>(async () => page([climb('Five point', 'five')]));
    const service = renderBoardsesh(boardseshPort(boardseshQuery));
    await screen.findByRole('button', { name: /Five point/ });
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.change(screen.getByLabelText('Minimum rating'), { target: { value: '4.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(boardseshQuery).toHaveBeenLastCalledWith(expect.objectContaining({ minRating: 4.5 })));

    const legacyQuery = vi.fn<CatalogQueryPort['query']>(async () => page([climb('Three star', 'three')]));
    act(() => service.publish({
      ...service.service.getSnapshot(),
      storage: { status: 'ready', receipt },
      queries: queryPort({ query: legacyQuery }),
    }));
    await screen.findByRole('button', { name: /Three star/ });
    expect(legacyQuery).toHaveBeenLastCalledWith({ angle: 40, name: '', sort: 'rating', limit: 25 });
    expect(screen.queryByRole('button', { name: 'Remove minimum rating filter' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Catalog source' })).toHaveTextContent('Older offline snapshot · no live updates');
    expect(screen.getByText('★ 2.4 / 3 · 4 sends')).toBeInTheDocument();
  });
});

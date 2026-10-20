import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBackNavigation } from '../app/back-navigation.ts';
import { backNavigationContext } from '../app/use-back-action.ts';
import { MockBoardByteTransport } from '../board-control/mock-byte-transport.ts';
import { createFullrideLightController } from '../board-control/light-controller.ts';
import { lightSceneFromAssignments } from '../climb-browser/light-scene.ts';
import { providerClimbViewKey } from '../climb-browser/types.ts';
import { kilterFullride7x10Definition as definition, KILTER_PROVIDER_ID } from '../domain/boards/definitions/kilter-fullride-7x10.ts';
import { providerSourceId } from '../domain/boards/identity.ts';
import type { BoardseshCatalogManifest, CatalogManifest } from '../data/catalog/manifest.ts';
import type { CatalogReceipt } from '../data/sqlite/catalog-receipt.ts';
import type { CatalogQueryPort, CatalogClimb, CatalogClimbQuery, CatalogCursor, CatalogPage, CatalogRead } from './types.ts';
import {
  INITIAL_CATALOG_UPDATE,
  type CatalogService,
  type CatalogServiceSnapshot,
  type CatalogUpdateState,
} from './service.ts';
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
    update: INITIAL_CATALOG_UPDATE,
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
    checkForUpdate: vi.fn(async () => undefined),
    installUpdate: vi.fn(async () => undefined),
    dismissUpdate: vi.fn(),
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

describe('CatalogBrowser update banner', () => {
  const { sourceDataThrough: _legacyOnly, ...identity } = manifest as Extract<CatalogManifest, { schemaVersion: 2 }>;
  const updateOffer: BoardseshCatalogManifest = {
    ...identity,
    schemaVersion: 3,
    version: 3,
    file: 'kilter-7x10.v3.db.gz',
    generatedOn: '2026-10-19',
    source: 'boardsesh-kilter',
    sourceBuiltAt: '2026-10-19T18:38:11.515Z',
    sourceWatermarks: {},
    layoutRevision: definition.layoutRevision,
    qualityScale: { min: 0, max: 5 },
    climbCount: 13_299,
    removedUpstreamCount: 23,
    changes: { added: 1261, removed: 23, restored: 0 },
  };
  const available: CatalogUpdateState = {
    ...INITIAL_CATALOG_UPDATE,
    availability: 'available',
    offer: updateOffer,
    changes: updateOffer.changes,
  };

  function renderWith(initial: Partial<CatalogServiceSnapshot>) {
    const value = serviceFor(queryPort(), initial);
    render(
      <CatalogBrowser
        service={value.service}
        definition={definition}
        defaultAngle={40}
        controller={null}
        onManageOpenChange={() => undefined}
      />,
    );
    return value;
  }

  it('runs the cadence-gated update check after the catalog opens', async () => {
    const value = renderWith({});
    await waitFor(() => expect(value.service.checkForUpdate).toHaveBeenCalledOnce());
    expect(value.service.start).toHaveBeenCalledOnce();
    expect(value.service.checkForUpdate).toHaveBeenCalledWith();
    expect(screen.queryByRole('region', { name: 'Catalog update' })).not.toBeInTheDocument();
  });

  it('summarizes a newer catalog as a polite status with Later and Install', async () => {
    const value = renderWith({ update: available });
    const banner = screen.getByRole('region', { name: 'Catalog update' });
    expect(within(banner).getByRole('status')).toHaveTextContent('New catalog: 1,261 new climbs · 23 removed');
    fireEvent.click(within(banner).getByRole('button', { name: 'Install' }));
    expect(value.service.installUpdate).toHaveBeenCalledOnce();
    fireEvent.click(within(banner).getByRole('button', { name: 'Later' }));
    expect(value.service.dismissUpdate).toHaveBeenCalledOnce();

    act(() => value.publish({ ...value.service.getSnapshot(), update: { ...available, dismissed: true } }));
    expect(screen.queryByRole('region', { name: 'Catalog update' })).not.toBeInTheDocument();
    await screen.findByText('No climbs match these filters');
  });

  it('shows update progress without actions, then a retryable failure that keeps the current catalog', () => {
    const value = renderWith({
      update: available,
      operation: 'downloading',
      progress: { receivedBytes: 2_550_000, totalBytes: 5_100_000 },
    });
    const banner = screen.getByRole('region', { name: 'Catalog update' });
    expect(banner).toHaveTextContent('Downloading catalog version 3… 50%');
    expect(within(banner).getByRole('progressbar', { name: 'Catalog version 3 download' })).toHaveAttribute('aria-valuenow', '50');
    expect(within(banner).queryByRole('button')).not.toBeInTheDocument();
    expect(within(banner).queryByRole('status')).not.toBeInTheDocument();

    act(() => value.publish({
      ...value.service.getSnapshot(),
      operation: 'idle',
      progress: null,
      update: {
        ...available,
        error: { code: 'network', message: 'The catalog service could not be reached.', action: 'install' },
      },
    }));
    expect(within(banner).getByRole('status')).toHaveTextContent(
      'Catalog update failed. The catalog service could not be reached. Your current catalog is still installed.',
    );
    fireEvent.click(within(banner).getByRole('button', { name: 'Retry' }));
    expect(value.service.installUpdate).toHaveBeenCalledOnce();
  });

  it('shows nothing for signed-out, unconfigured or check-only states', () => {
    for (const update of [
      { ...INITIAL_CATALOG_UPDATE, availability: 'signed-out' as const },
      { ...INITIAL_CATALOG_UPDATE, availability: 'unconfigured' as const },
      { ...INITIAL_CATALOG_UPDATE, error: { code: 'network' as const, message: 'Offline.', action: 'check' as const } },
    ]) {
      const view = render(
        <CatalogBrowser
          service={serviceFor(queryPort(), { update }).service}
          definition={definition}
          defaultAngle={40}
          controller={null}
          onManageOpenChange={() => undefined}
        />,
      );
      expect(screen.queryByRole('region', { name: 'Catalog update' })).not.toBeInTheDocument();
      expect(screen.queryByText(/Sign in to get catalog updates/)).not.toBeInTheDocument();
      view.unmount();
    }
  });
});

describe('CatalogBrowser climb-to-climb navigation', () => {
  const cursorTwo = 'cursor-two' as CatalogCursor;
  const alpha = climb('Alpha', 'alpha');
  const bravo = climb('Bravo', 'bravo');
  const charlie = climb('Charlie', 'charlie');
  const delta = climb('Delta', 'delta');

  async function openClimb(name: string) {
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) }));
    expect(screen.getByRole('heading', { name })).toBeInTheDocument();
  }
  const position = () => within(screen.getByRole('navigation', { name: 'Climb navigation' })).getByRole('status');

  it('moves within the page in result order and shows "+" while later pages exist', async () => {
    const query = vi.fn<CatalogQueryPort['query']>().mockResolvedValue(page([alpha, bravo], cursorOne));
    renderBrowser(queryPort({ query }));
    await openClimb('Alpha');
    expect(position()).toHaveTextContent('1 of 2+');
    fireEvent.click(screen.getByRole('button', { name: 'Next climb' }));
    expect(screen.getByRole('heading', { name: 'Bravo' })).toBeInTheDocument();
    expect(position()).toHaveTextContent('2 of 2+');
    expect(query).toHaveBeenCalledOnce();
  });

  it('crosses forward to the next page without closing the detail, then back to the previous page', async () => {
    const nextPage = deferred<CatalogRead<CatalogPage>>();
    const query = vi.fn<CatalogQueryPort['query']>()
      .mockResolvedValueOnce(page([alpha, bravo], cursorOne))
      .mockReturnValueOnce(nextPage.promise)
      .mockResolvedValueOnce(page([alpha, bravo], cursorOne));
    renderBrowser(queryPort({ query }));
    await openClimb('Bravo');
    fireEvent.click(screen.getByRole('button', { name: 'Next climb' }));
    expect(query).toHaveBeenLastCalledWith({ angle: 40, name: '', sort: 'rating', limit: 25, cursor: cursorOne });
    // The current climb stays up while the next page is read.
    expect(screen.getByRole('heading', { name: 'Bravo' })).toBeInTheDocument();
    await act(async () => { nextPage.resolve(page([charlie, delta])); await nextPage.promise; });
    expect(screen.getByRole('heading', { name: 'Charlie' })).toBeInTheDocument();
    expect(position()).toHaveTextContent('3 of 4');
    expect(screen.getByText('Page 2 · 2 climbs on this page')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Charlie/ })).toHaveAttribute('aria-current', 'true');
    // The page the move read is shown as read; it is not queried a second time.
    expect(query).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: 'Previous climb' }));
    expect(await screen.findByRole('heading', { name: 'Bravo' })).toBeInTheDocument();
    expect(query).toHaveBeenLastCalledWith({ angle: 40, name: '', sort: 'rating', limit: 25 });
    expect(position()).toHaveTextContent('2 of 2+');
    expect(screen.getByText('Page 1 · 2 climbs on this page')).toBeInTheDocument();
  });

  it('continues past pages whose routes were all excluded, counting earlier pages in the position', async () => {
    const query = vi.fn<CatalogQueryPort['query']>()
      .mockResolvedValueOnce(page([alpha], cursorOne))
      .mockResolvedValueOnce({ status: 'ready', value: { climbs: [], nextCursor: cursorTwo, excludedCount: 25 } })
      .mockResolvedValueOnce(page([delta]));
    renderBrowser(queryPort({ query }));
    await openClimb('Alpha');
    fireEvent.click(screen.getByRole('button', { name: 'Next climb' }));
    expect(await screen.findByRole('heading', { name: 'Delta' })).toBeInTheDocument();
    expect(query).toHaveBeenLastCalledWith({ angle: 40, name: '', sort: 'rating', limit: 25, cursor: cursorTwo });
    expect(screen.getByText('Page 3 · 1 climb on this page')).toBeInTheDocument();
    expect(position()).toHaveTextContent('2 of 2');
  });

  it('stops at the end of the results with "Last climb", including when only empty pages follow', async () => {
    const query = vi.fn<CatalogQueryPort['query']>()
      .mockResolvedValueOnce(page([alpha, bravo], cursorOne))
      .mockResolvedValueOnce(page([], null));
    renderBrowser(queryPort({ query }));
    await openClimb('Bravo');
    fireEvent.click(screen.getByRole('button', { name: 'Next climb' }));
    await waitFor(() => expect(position()).toHaveTextContent('Last climb'));
    expect(screen.getByRole('heading', { name: 'Bravo' })).toBeInTheDocument();
    expect(screen.getByText('Page 1 · 2 climbs on this page')).toBeInTheDocument();
    // The total is now known, so the next attempt does not read again.
    expect(position()).toHaveTextContent(/^2 of 2 · Last climb$/);
    expect(screen.getByRole('button', { name: 'Next climb' })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Next climb' }));
    expect(query).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: 'Previous climb' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous climb' }));
    expect(screen.getByRole('heading', { name: 'Alpha' })).toBeInTheDocument();
    expect(position()).toHaveTextContent('First climb');
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('cancels a pending page move when the search changes and ignores its late response', async () => {
    const nextPage = deferred<CatalogRead<CatalogPage>>();
    const query = vi.fn<CatalogQueryPort['query']>()
      .mockResolvedValueOnce(page([alpha, bravo], cursorOne))
      .mockReturnValueOnce(nextPage.promise)
      .mockResolvedValueOnce(page([delta]));
    renderBrowser(queryPort({ query }));
    await openClimb('Bravo');
    fireEvent.click(screen.getByRole('button', { name: 'Next climb' }));
    fireEvent.change(screen.getByLabelText('Angle'), { target: { value: '45' } });
    expect(screen.queryByRole('heading', { name: 'Bravo' })).not.toBeInTheDocument();
    await screen.findByRole('button', { name: /Delta/ });
    await act(async () => { nextPage.resolve(page([charlie])); await nextPage.promise; });
    expect(screen.queryByRole('button', { name: /Charlie/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Charlie' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Delta' })).not.toBeInTheDocument();
    expect(screen.getByText('Page 1 · 1 climb on this page')).toBeInTheDocument();
  });

  it('cancels a pending page move when the detail is closed', async () => {
    const nextPage = deferred<CatalogRead<CatalogPage>>();
    const query = vi.fn<CatalogQueryPort['query']>()
      .mockResolvedValueOnce(page([alpha, bravo], cursorOne))
      .mockReturnValueOnce(nextPage.promise);
    renderBrowser(queryPort({ query }));
    await openClimb('Bravo');
    fireEvent.click(screen.getByRole('button', { name: 'Next climb' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close climb details' }));
    await act(async () => { nextPage.resolve(page([charlie])); await nextPage.promise; });
    expect(screen.queryByRole('heading', { name: 'Charlie' })).not.toBeInTheDocument();
    expect(screen.getByText('Page 1 · 2 climbs on this page')).toBeInTheDocument();
  });

  it('keeps manual page buttons clearing the selection', async () => {
    const query = vi.fn<CatalogQueryPort['query']>()
      .mockResolvedValueOnce(page([alpha], cursorOne))
      .mockResolvedValueOnce(page([charlie]));
    renderBrowser(queryPort({ query }));
    await openClimb('Alpha');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('button', { name: /Charlie/ });
    expect(screen.queryByRole('heading', { name: 'Charlie' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Alpha' })).not.toBeInTheDocument();
    await openClimb('Charlie');
    expect(position()).toHaveTextContent('2 of 2');
  });

  it('shows the page error state when a page move cannot read the next page', async () => {
    const query = vi.fn<CatalogQueryPort['query']>()
      .mockResolvedValueOnce(page([alpha], cursorOne))
      .mockRejectedValue(new Error('Catalog read failed.'));
    renderBrowser(queryPort({ query }));
    await openClimb('Alpha');
    fireEvent.click(screen.getByRole('button', { name: 'Next climb' }));
    expect(await screen.findByRole('heading', { name: 'Climbs could not be loaded' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry search' })).toBeInTheDocument();
    expect(query).toHaveBeenLastCalledWith({ angle: 40, name: '', sort: 'rating', limit: 25, cursor: cursorOne });
  });
});

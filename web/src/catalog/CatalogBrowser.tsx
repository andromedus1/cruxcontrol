import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { BoardLightController } from '../board-control/light-controller.ts';
import type { BoardDefinition } from '../domain/boards/definition.ts';
import type { CatalogClimbQuery, CatalogCursor, CatalogPage, CatalogSort } from './types.ts';
import type { CatalogClimb } from './types.ts';
import type { CatalogService } from './service.ts';
import type { ClimbViewKey } from '../climb-browser/types.ts';
import { LocalClimbViewer } from '../climb-browser/LocalClimbViewer.tsx';
import { listNavigation } from '../climb-browser/navigation.ts';
import { CatalogManageDialog } from './CatalogManageDialog.tsx';
import { CatalogFilterDialog, EMPTY_CATALOG_FILTERS, type CatalogFilterValues } from './CatalogFilterDialog.tsx';
import { catalogSourceCopy, catalogUpdateSummary } from './presentation.ts';
import './catalog.css';

export interface CatalogBrowserProps {
  readonly service: CatalogService;
  readonly definition: BoardDefinition;
  readonly defaultAngle: number;
  readonly controller: BoardLightController | null;
  readonly onManageOpenChange: (open: boolean) => void;
  readonly onManageLists?: (climb: CatalogClimb) => void;
}

type QueryStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
type GradeStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

interface PageHistory {
  readonly adapter: object | null;
  cursors: Array<CatalogCursor | null>;
  /** Climbs shown on each visited page, for the position across pages. */
  rowCounts: number[];
  /** Page index after which only empty pages remain, once a move has found that out. */
  endsAt: number | null;
}

/** A page a climb-to-climb move already read, applied with its selection by the page query. */
interface PrimedPage {
  readonly adapter: object;
  readonly pageIndex: number;
  readonly page: CatalogPage;
  readonly selectedKey: ClimbViewKey;
}

const EMPTY_ROWS: readonly CatalogClimb[] = Object.freeze([]);
const PAGE_SIZE = 25;

function newPageHistory(adapter: object | null): PageHistory {
  return { adapter, cursors: [null], rowCounts: [], endsAt: null };
}

function catalogQuery(input: {
  readonly angle: number;
  readonly name: string;
  readonly filters: CatalogFilterValues;
  readonly sort: CatalogSort;
  readonly cursor?: CatalogCursor | null;
}): CatalogClimbQuery {
  const { filters, cursor } = input;
  return {
    angle: input.angle,
    name: input.name,
    ...(filters.minGrade === null ? {} : { minGrade: filters.minGrade }),
    ...(filters.maxGrade === null ? {} : { maxGrade: filters.maxGrade }),
    ...(filters.minRating === null ? {} : { minRating: filters.minRating }),
    ...(filters.minAscents === null ? {} : { minAscents: filters.minAscents }),
    ...(filters.setter ? { setter: filters.setter } : {}),
    sort: input.sort,
    limit: PAGE_SIZE,
    ...(cursor === undefined || cursor === null ? {} : { cursor }),
  };
}

export function CatalogBrowser({
  service,
  definition,
  defaultAngle,
  controller,
  onManageOpenChange,
  onManageLists,
}: CatalogBrowserProps): React.JSX.Element {
  const snapshot = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  const [rows, setRows] = useState<readonly CatalogClimb[]>(EMPTY_ROWS);
  const [rowsAdapter, setRowsAdapter] = useState<object | null>(null);
  const [page, setPage] = useState<CatalogPage | null>(null);
  const [pageNumber, setPageNumber] = useState(0);
  const [queryStatus, setQueryStatus] = useState<QueryStatus>('idle');
  const [queryError, setQueryError] = useState('');
  const [gradeOptions, setGradeOptions] = useState<readonly { value: number; label: string }[]>([]);
  const [gradeAdapter, setGradeAdapter] = useState<object | null>(null);
  const [gradeStatus, setGradeStatus] = useState<GradeStatus>('idle');
  const [search, setSearch] = useState({ value: '', settled: true });
  const [filters, setFilters] = useState<CatalogFilterValues>(EMPTY_CATALOG_FILTERS);
  const [sort, setSort] = useState<CatalogSort>('rating');
  const [angle, setAngle] = useState(defaultAngle);
  const [selectedKey, setSelectedKey] = useState<ClimbViewKey | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [manageOpen, setManageOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const queries = snapshot.queries;
  const sourceCopy = catalogSourceCopy(
    snapshot.storage?.status === 'ready' ? snapshot.storage.receipt.manifest : snapshot.offer,
  );
  const ratingScale = queries?.ratingScale ?? null;
  // A committed minimum rating outside a newly installed catalog's scale is dropped
  // rather than sent to an adapter that would reject it.
  const activeFilters = useMemo(() => (
    filters.minRating !== null && ratingScale
      && (filters.minRating < ratingScale.min || filters.minRating > ratingScale.max)
      ? { ...filters, minRating: null }
      : filters
  ), [filters, ratingScale]);
  const currentQueries = useRef(queries);
  currentQueries.current = queries;
  const queryGeneration = useRef(0);
  const gradeGeneration = useRef(0);
  const pageHistory = useRef<PageHistory>(newPageHistory(queries));
  const primedPage = useRef<PrimedPage | null>(null);
  const pageMove = useRef(0);
  const pageMoveActive = useRef(false);
  const [, setHistoryRevision] = useState(0);
  const manageTrigger = useRef<HTMLButtonElement | null>(null);
  const manageButton = useRef<HTMLButtonElement | null>(null);
  const filterTrigger = useRef<HTMLButtonElement | null>(null);
  const wasManageOpen = useRef(false);
  const wasFilterOpen = useRef(false);
  const openFrame = useRef<number | null>(null);
  const mounted = useRef(true);

  if (pageHistory.current.adapter !== queries) {
    pageHistory.current = newPageHistory(queries);
  }
  const activePageNumber = queries ? Math.min(pageNumber || 1, pageHistory.current.cursors.length) : 1;
  const visibleRows = queries && rowsAdapter === queries ? rows : EMPTY_ROWS;
  const visiblePage = queries && rowsAdapter === queries ? page : null;
  const visibleSelectedKey = queries && rowsAdapter === queries ? selectedKey : null;
  const climbLabel = sourceCopy.climbLabel;
  const viewRows = useMemo(() => visibleRows.map((climb) => ({
    ...climb,
    sourceLabel: climbLabel,
  })), [visibleRows, climbLabel]);
  const metricsByKey = useMemo(
    () => new Map(visibleRows.map((climb) => [climb.key, climb] as const)),
    [visibleRows],
  );

  useEffect(() => {
    mounted.current = true;
    // Opening the catalog is one of the cadence-gated update check points.
    void service.start().then(() => {
      if (mounted.current) return service.checkForUpdate();
    }).catch(() => undefined);
    return () => {
      mounted.current = false;
      queryGeneration.current += 1;
      gradeGeneration.current += 1;
      if (openFrame.current !== null) cancelAnimationFrame(openFrame.current);
      openFrame.current = null;
      pageMove.current += 1;
      onManageOpenChange(false);
    };
  }, [service, onManageOpenChange]);

  useEffect(() => {
    onManageOpenChange(manageOpen);
    if (wasManageOpen.current && !manageOpen) {
      requestAnimationFrame(() => {
        const trigger = manageTrigger.current;
        if (trigger?.isConnected) trigger.focus();
        else manageButton.current?.focus();
      });
    }
    wasManageOpen.current = manageOpen;
  }, [manageOpen, onManageOpenChange]);

  useEffect(() => {
    if (wasFilterOpen.current && !filterOpen) {
      requestAnimationFrame(() => {
        if (filterTrigger.current?.isConnected) filterTrigger.current.focus();
      });
    }
    wasFilterOpen.current = filterOpen;
  }, [filterOpen]);

  useEffect(() => {
    const queryAdapter = queries;
    const generation = ++gradeGeneration.current;
    setGradeOptions([]);
    setGradeAdapter(null);
    setGradeStatus(queryAdapter ? 'loading' : 'idle');
    if (!queryAdapter) return () => { gradeGeneration.current += 1; };
    void queryAdapter.grades().then((result) => {
      if (generation !== gradeGeneration.current || currentQueries.current !== queryAdapter) return;
      if (result.status === 'unavailable') {
        setGradeStatus('unavailable');
        setGradeAdapter(queryAdapter);
        return;
      }
      setGradeOptions(result.value);
      setGradeAdapter(queryAdapter);
      setGradeStatus('ready');
    }).catch(() => {
      if (generation !== gradeGeneration.current || currentQueries.current !== queryAdapter) return;
      setGradeStatus('error');
      setGradeAdapter(queryAdapter);
    });
    return () => { gradeGeneration.current += 1; };
  }, [queries]);

  useEffect(() => {
    if (search.settled) return undefined;
    const value = search.value;
    const timer = window.setTimeout(() => {
      setSearch((current) => current.value === value ? { ...current, settled: true } : current);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const queryAdapter = queries;
    const generation = ++queryGeneration.current;
    if (!queryAdapter || snapshot.storage?.status !== 'ready' || snapshot.operation === 'installing') {
      setQueryStatus('idle');
      return () => { queryGeneration.current += 1; };
    }
    if (!search.settled) {
      setQueryStatus('loading');
      setRows(EMPTY_ROWS);
      setPage(null);
      setRowsAdapter(null);
      return () => { queryGeneration.current += 1; };
    }

    const currentPageIndex = Math.max(0, Math.min(activePageNumber - 1, pageHistory.current.cursors.length - 1));
    const cursor = pageHistory.current.cursors[currentPageIndex] ?? undefined;
    const primed = primedPage.current;
    primedPage.current = null;
    if (primed && primed.adapter === queryAdapter && primed.pageIndex === currentPageIndex) {
      // A climb-to-climb move already read this page; show it with its climb selected
      // so the open detail never closes between pages.
      setRows(primed.page.climbs);
      setRowsAdapter(queryAdapter);
      setPage(primed.page);
      setPageNumber(currentPageIndex + 1);
      setQueryStatus('ready');
      setQueryError('');
      setSelectedKey(primed.selectedKey);
      return () => { queryGeneration.current += 1; };
    }
    setQueryStatus('loading');
    setQueryError('');
    setRows(EMPTY_ROWS);
    setPage(null);
    setRowsAdapter(queryAdapter);
    setSelectedKey(null);
    void queryAdapter.query(
      catalogQuery({ angle, name: search.value, filters: activeFilters, sort, cursor }),
    ).then((result) => {
      if (generation !== queryGeneration.current || currentQueries.current !== queryAdapter) return;
      if (result.status === 'unavailable') {
        setRows(EMPTY_ROWS);
        setPage(null);
        setQueryStatus('unavailable');
        return;
      }
      if (pageHistory.current.adapter === queryAdapter) {
        pageHistory.current.rowCounts[currentPageIndex] = result.value.climbs.length;
      }
      setRows(result.value.climbs);
      setRowsAdapter(queryAdapter);
      setPage(result.value);
      setPageNumber(currentPageIndex + 1);
      setQueryStatus('ready');
      setQueryError('');
    }).catch((cause: unknown) => {
      if (generation !== queryGeneration.current || currentQueries.current !== queryAdapter) return;
      setRows(EMPTY_ROWS);
      setPage(null);
      setQueryStatus('error');
      setQueryError(cause instanceof Error ? cause.message : 'The catalog could not be read.');
    });
    return () => { queryGeneration.current += 1; };
  }, [
    queries,
    snapshot.storage?.status,
    snapshot.operation,
    angle,
    search.value,
    search.settled,
    activeFilters,
    sort,
    activePageNumber,
    retryCount,
  ]);

  const cancelPageMove = () => {
    pageMove.current += 1;
    pageMoveActive.current = false;
    primedPage.current = null;
  };

  const invalidateQuery = () => {
    cancelPageMove();
    queryGeneration.current += 1;
    setRows(EMPTY_ROWS);
    setRowsAdapter(null);
    setPage(null);
    setQueryStatus('loading');
    setQueryError('');
    setSelectedKey(null);
  };

  const resetPaging = () => {
    pageHistory.current = newPageHistory(queries);
    setPageNumber(1);
  };

  /**
   * Moves from the first or last climb of this page to the neighboring page with
   * climbs, skipping pages whose routes were all excluded. Resolves false when no
   * climb exists in that direction. Query, page or source changes cancel it.
   */
  const movePage = async (direction: 'previous' | 'next'): Promise<boolean> => {
    const adapter = queries;
    const fromPage = visiblePage;
    if (!adapter || !fromPage || pageMoveActive.current) return true;
    const token = ++pageMove.current;
    pageMoveActive.current = true;
    const generation = queryGeneration.current;
    const history = pageHistory.current;
    const fromIndex = activePageNumber - 1;
    const request = { angle, name: search.value, filters: activeFilters, sort };
    const stale = () => !mounted.current
      || pageMove.current !== token
      || queryGeneration.current !== generation
      || currentQueries.current !== adapter
      || pageHistory.current !== history;
    const commit = (next: PageHistory, pageIndex: number, page: CatalogPage, selectedKey: ClimbViewKey) => {
      pageHistory.current = next;
      primedPage.current = { adapter, pageIndex, page, selectedKey };
      setPageNumber(pageIndex + 1);
    };
    // A read that fails mid-move falls back to an ordinary page change, which shows
    // the existing unavailable, error and retry states for that page.
    let reading: { readonly next: PageHistory; readonly pageIndex: number } | null = null;
    const showPage = (next: PageHistory, pageIndex: number) => {
      invalidateQuery();
      pageHistory.current = next;
      setPageNumber(pageIndex + 1);
    };
    try {
      if (direction === 'next') {
        const cursors = history.cursors.slice(0, fromIndex + 1);
        const rowCounts = history.rowCounts.slice(0, fromIndex + 1);
        let cursor = fromPage.nextCursor;
        while (cursor) {
          cursors.push(cursor);
          const pageIndex = cursors.length - 1;
          const next: PageHistory = { adapter, cursors, rowCounts, endsAt: null };
          reading = { next, pageIndex };
          const result = await adapter.query(catalogQuery({ ...request, cursor }));
          if (stale()) return true;
          if (result.status === 'unavailable') {
            showPage(next, pageIndex);
            return true;
          }
          rowCounts[pageIndex] = result.value.climbs.length;
          const target = result.value.climbs[0];
          if (target) {
            commit(next, pageIndex, result.value, target.key);
            return true;
          }
          cursor = result.value.nextCursor;
        }
        // Only empty pages follow: this page holds the last climb.
        history.endsAt = fromIndex;
        setHistoryRevision((revision) => revision + 1);
        return false;
      }
      const rowCounts = [...history.rowCounts];
      for (let pageIndex = fromIndex - 1; pageIndex >= 0; pageIndex -= 1) {
        const next: PageHistory = { ...history, rowCounts };
        reading = { next, pageIndex };
        const result = await adapter.query(catalogQuery({ ...request, cursor: history.cursors[pageIndex] }));
        if (stale()) return true;
        if (result.status === 'unavailable') {
          showPage(next, pageIndex);
          return true;
        }
        rowCounts[pageIndex] = result.value.climbs.length;
        const target = result.value.climbs.at(-1);
        if (target) {
          commit(next, pageIndex, result.value, target.key);
          return true;
        }
      }
      return false;
    } catch {
      if (!stale() && reading) showPage(reading.next, reading.pageIndex);
      return true;
    } finally {
      if (pageMove.current === token) pageMoveActive.current = false;
    }
  };

  const openManage = (event: React.MouseEvent<HTMLButtonElement>) => {
    manageTrigger.current = event.currentTarget;
    cancelPageMove();
    setSelectedKey(null);
    if (visibleSelectedKey) {
      if (openFrame.current !== null) cancelAnimationFrame(openFrame.current);
      openFrame.current = requestAnimationFrame(() => {
        openFrame.current = null;
        if (mounted.current) setManageOpen(true);
      });
    } else {
      setManageOpen(true);
    }
  };

  const statusLabel = (() => {
    if (snapshot.operation === 'opening') return 'Checking catalog…';
    if (snapshot.operation === 'checking-offer') return 'Checking source details…';
    if (snapshot.operation === 'downloading') {
      const progress = snapshot.progress;
      return progress && progress.totalBytes > 0
        ? `Downloading ${Math.min(100, Math.floor(progress.receivedBytes / progress.totalBytes * 100))}%`
        : 'Downloading';
    }
    if (snapshot.operation === 'installing') return 'Finishing install';
    if (snapshot.storage?.status === 'ready') return 'Available offline';
    if (snapshot.storage?.status === 'unavailable') {
      return snapshot.storage.code === 'busy' ? 'In use in another tab' : 'Catalog unavailable';
    }
    if (snapshot.offer) return 'Not installed';
    if (snapshot.error) return 'Download unavailable';
    return 'Not installed';
  })();

  const progressPercent = snapshot.progress && snapshot.progress.totalBytes > 0
    ? Math.min(100, Math.floor(snapshot.progress.receivedBytes / snapshot.progress.totalBytes * 100))
    : null;
  const progressAnnouncement = progressPercent === null
    ? 'Catalog download started.'
    : `Catalog download ${Math.floor(progressPercent / 10) * 10}% received.`;
  const statusAnnouncement = snapshot.operation === 'opening'
    ? 'Checking for an installed catalog.'
    : snapshot.operation === 'checking-offer'
      ? 'Checking catalog details.'
      : snapshot.operation === 'downloading'
        ? progressAnnouncement
        : snapshot.operation === 'installing'
          ? 'Verifying and installing the catalog.'
          : queryStatus === 'loading'
            ? 'Loading catalog climbs.'
            : queryStatus === 'ready'
              ? `${visibleRows.length} ${visibleRows.length === 1 ? 'climb' : 'climbs'} loaded on page ${activePageNumber}.`
              : queryStatus === 'error' ? queryError : '';

  let emptyTitle = 'Loading catalog';
  let emptyDescription = 'Checking whether the offline catalog is available on this device.';
  if (snapshot.operation === 'installing' && snapshot.storage?.status === 'ready') {
    emptyTitle = 'Updating catalog';
    emptyDescription = 'The new catalog version is being verified. Your current catalog stays installed unless it passes.';
  } else if (snapshot.operation === 'installing') {
    emptyTitle = 'Finishing catalog setup';
    emptyDescription = 'The snapshot is being verified and installed before its climbs can be browsed.';
  } else if (snapshot.storage?.status === 'unavailable') {
    emptyTitle = 'Catalog is unavailable';
    emptyDescription = snapshot.storage.code === 'busy'
      ? 'Another CruxControl tab currently owns this catalog. Your local climbs and lists remain usable.'
      : 'Offline catalog storage is unavailable here. Your local climbs and lists remain usable.';
  } else if (snapshot.storage?.status === 'empty') {
    emptyTitle = snapshot.operation === 'downloading' ? 'Your catalog is on its way' : 'Install the catalog to browse';
    emptyDescription = snapshot.operation === 'downloading'
      ? 'You can keep using your local climbs and lists while the catalog downloads.'
      : sourceCopy.setupDescription;
  } else if (queryStatus === 'loading' || snapshot.operation === 'opening') {
    emptyTitle = 'Loading climbs';
    emptyDescription = 'Searching this page of the installed catalog.';
  } else if (queryStatus === 'unavailable') {
    emptyTitle = 'Catalog is unavailable';
    emptyDescription = 'The local catalog is not ready. Your authored library remains separate.';
  } else if (queryStatus === 'error') {
    emptyTitle = 'Climbs could not be loaded';
    emptyDescription = queryError || 'The catalog read failed. Retry to search this page again.';
  } else if (visiblePage?.climbs.length === 0 && visiblePage.nextCursor) {
    emptyTitle = 'No compatible climbs on this page';
    emptyDescription = 'Continue to the next catalog page to keep searching.';
  } else if (queryStatus === 'ready') {
    emptyTitle = 'No climbs match these filters';
    emptyDescription = 'Try another name, angle, rating, or send count.';
  }

  const gradeName = (value: number) => gradeOptions.find((option) => option.value === value)?.label ?? ('Grade ' + value);
  const gradeSummary = activeFilters.minGrade !== null && activeFilters.maxGrade !== null
    ? activeFilters.minGrade === activeFilters.maxGrade
      ? 'Grade ' + gradeName(activeFilters.minGrade)
      : gradeName(activeFilters.minGrade) + '–' + gradeName(activeFilters.maxGrade)
    : activeFilters.minGrade !== null
      ? 'Grade ≥ ' + gradeName(activeFilters.minGrade)
      : activeFilters.maxGrade !== null
        ? 'Grade ≤ ' + gradeName(activeFilters.maxGrade)
        : '';
  const filterChipCount = Number(Boolean(gradeSummary))
    + Number(activeFilters.minRating !== null)
    + Number(activeFilters.minAscents !== null)
    + Number(Boolean(activeFilters.setter));
  const removeFilter = (change: Partial<CatalogFilterValues>) => {
    invalidateQuery();
    resetPaging();
    setFilters((current) => ({ ...current, ...change }));
  };

  const update = snapshot.update;
  const updateOffer = snapshot.storage?.status === 'ready' ? update.offer : null;
  const updating = updateOffer !== null
    && (snapshot.operation === 'downloading' || snapshot.operation === 'installing');
  const updateFailed = updateOffer !== null && update.error?.action === 'install' && snapshot.operation === 'idle';
  const updateBannerText = !updateOffer
    ? ''
    : updating
      ? snapshot.operation === 'installing'
        ? `Verifying and installing catalog version ${updateOffer.version}…`
        : progressPercent === null
          ? `Downloading catalog version ${updateOffer.version}…`
          : `Downloading catalog version ${updateOffer.version}… ${progressPercent}%`
      : updateFailed
        ? `Catalog update failed. ${update.error!.message} Your current catalog is still installed.`
        : `New catalog: ${catalogUpdateSummary(updateOffer.version, update.changes)}`;
  const updateBanner = updateOffer && !update.dismissed && (
    <section className="catalog-update-banner" aria-label="Catalog update">
      {/* Download progress is announced by the shared status line; the banner announces offers and failures. */}
      <p
        className="catalog-update-banner__text"
        role={manageOpen || updating ? undefined : 'status'}
        aria-live={manageOpen || updating ? undefined : 'polite'}
      >
        {updateBannerText}
      </p>
      {updating && (
        <div
          className="catalog-progress"
          role="progressbar"
          aria-label={`Catalog version ${updateOffer.version} download`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={snapshot.operation === 'installing' ? 100 : progressPercent ?? 0}
        >
          <span style={{ width: `${snapshot.operation === 'installing' ? 100 : progressPercent ?? 0}%` }} />
        </div>
      )}
      {!updating && (
        <div className="catalog-update-banner__actions">
          <button className="catalog-button catalog-button--ghost" type="button" onClick={() => service.dismissUpdate()}>
            Later
          </button>
          <button
            className="catalog-button catalog-button--primary"
            type="button"
            disabled={snapshot.operation !== 'idle' || update.checking}
            onClick={() => void service.installUpdate()}
          >
            {updateFailed ? 'Retry' : 'Install'}
          </button>
        </div>
      )}
    </section>
  );

  const sourceHeader = (
    <>
      <section className="catalog-source-row" aria-label="Catalog source">
        <div className="catalog-source-row__copy">
          <div className="catalog-source-row__title">
            <strong>{sourceCopy.headline}</strong>
            <span className={`catalog-badge ${snapshot.storage?.status === 'ready' ? 'catalog-badge--ready' : ''}`}>
              {statusLabel}
            </span>
          </div>
          <p>{sourceCopy.summary}</p>
        </div>
        <button ref={manageButton} className="catalog-button catalog-button--secondary" type="button" onClick={openManage}>
          Manage
        </button>
      </section>
      {updateBanner}

      {snapshot.storage?.status === 'ready' && snapshot.queries && (
        <form className="catalog-filters" onSubmit={(event) => event.preventDefault()} aria-label={`Filter ${sourceCopy.name} climbs`}>
          <label className="catalog-field catalog-field--name">
            <span>Name</span>
            <input
              className="catalog-input"
              type="search"
              maxLength={200}
              value={search.value}
              onChange={(event) => {
                invalidateQuery();
                resetPaging();
                setSearch({ value: event.target.value, settled: false });
              }}
              placeholder="Search climb names"
            />
          </label>
          <label className="catalog-field">
            <span>Angle</span>
            <select
              className="catalog-input"
              value={angle}
              onChange={(event) => {
                invalidateQuery();
                resetPaging();
                setAngle(Number(event.target.value));
              }}
            >
              {definition.supportedAngles.map((value) => <option key={value} value={value}>{value}°</option>)}
            </select>
          </label>
        </form>
      )}
      {snapshot.storage?.status === 'ready' && snapshot.queries && (
        <>
          <div className="catalog-sort-row">
            <label className="catalog-field">
              <span>Sort by</span>
              <select
                className="catalog-input"
                value={sort}
                onChange={(event) => {
                  invalidateQuery();
                  resetPaging();
                  setSort(event.target.value as CatalogSort);
                }}
              >
                <option value="rating">Highest rated</option>
                <option value="sends">Most sends</option>
                <option value="grade-asc">Easiest first</option>
                <option value="grade-desc">Hardest first</option>
                <option value="name">Name A–Z</option>
              </select>
            </label>
            <button
              ref={filterTrigger}
              className="catalog-button catalog-button--primary"
              type="button"
              onClick={() => setFilterOpen(true)}
            >
              Filters{filterChipCount > 0 ? ' (' + filterChipCount + ')' : ''}
            </button>
          </div>
          {gradeStatus === 'error' && (
            <p className="catalog-field__help">Grade choices could not be loaded.</p>
          )}
          {filterChipCount > 0 && (
            <div className="catalog-filter-chips" aria-label="Active filters">
              {gradeSummary && (
                <button className="catalog-filter-chip" type="button" aria-label="Remove grade filter"
                  onClick={() => removeFilter({ minGrade: null, maxGrade: null })}>
                  <span>{gradeSummary}</span><span aria-hidden="true">×</span>
                </button>
              )}
              {activeFilters.minRating !== null && ratingScale && (
                <button className="catalog-filter-chip" type="button" aria-label="Remove minimum rating filter"
                  onClick={() => removeFilter({ minRating: null })}>
                  <span>Rating ≥ {activeFilters.minRating} / {ratingScale.max}</span><span aria-hidden="true">×</span>
                </button>
              )}
              {activeFilters.minAscents !== null && (
                <button className="catalog-filter-chip" type="button" aria-label="Remove minimum sends filter"
                  onClick={() => removeFilter({ minAscents: null })}>
                  <span>Sends ≥ {activeFilters.minAscents}</span><span aria-hidden="true">×</span>
                </button>
              )}
              {activeFilters.setter && (
                <button className="catalog-filter-chip" type="button" aria-label="Remove setter filter"
                  onClick={() => removeFilter({ setter: '' })}>
                  <span>Setter: {activeFilters.setter}</span><span aria-hidden="true">×</span>
                </button>
              )}
            </div>
          )}
        </>
      )}
    </>
  );

  const pageFooter = (
    <>
      {queryStatus === 'error' && (
        <button className="catalog-button catalog-button--secondary" type="button" onClick={() => {
          invalidateQuery();
          setRetryCount((count) => count + 1);
        }}>
          Retry search
        </button>
      )}
      {queryStatus === 'ready' && visiblePage && (
        <footer className="catalog-page-footer">
          {visiblePage.excludedCount > 0 && (
            <p className="catalog-page-footer__note">
              {visiblePage.excludedCount} route{visiblePage.excludedCount === 1 ? '' : 's'} on this page were excluded because their complete hold sequence is not compatible with this board.
            </p>
          )}
          <nav className="catalog-pagination" aria-label="Catalog pages">
            <span>Page {activePageNumber} · {visibleRows.length} {visibleRows.length === 1 ? 'climb' : 'climbs'} on this page</span>
            <div>
              <button className="catalog-button catalog-button--secondary" type="button" disabled={activePageNumber <= 1} onClick={() => {
                invalidateQuery();
                setPageNumber((current) => Math.max(1, current - 1));
              }}>Previous</button>
              <button className="catalog-button catalog-button--secondary" type="button" disabled={!visiblePage.nextCursor} onClick={() => {
                if (!visiblePage.nextCursor) return;
                invalidateQuery();
                const nextPage = activePageNumber;
                const cursors = pageHistory.current.cursors.slice(0, nextPage);
                cursors[nextPage] = visiblePage.nextCursor;
                const rowCounts = pageHistory.current.rowCounts.slice(0, nextPage);
                pageHistory.current = { adapter: queries, cursors, rowCounts, endsAt: null };
                setPageNumber(nextPage + 1);
              }}>Next</button>
            </div>
          </nav>
        </footer>
      )}
      {snapshot.storage?.status !== 'ready' && (
        <section className="catalog-gate">
          <button className="catalog-button catalog-button--primary" type="button" onClick={openManage}>
            {snapshot.operation === 'downloading' ? 'View download' : snapshot.storage?.status === 'empty' ? 'Set up offline catalog' : 'Catalog details'}
          </button>
        </section>
      )}
      {!manageOpen && (
        <p className="catalog-announcement" role="status" aria-live="polite" aria-atomic="true">
          {statusAnnouncement}
        </p>
      )}
    </>
  );

  const activePageIndex = activePageNumber - 1;
  const rowsBefore = pageHistory.current.rowCounts
    .slice(0, activePageIndex)
    .reduce((sum, count) => sum + (count ?? 0), 0);
  const morePages = Boolean(visiblePage?.nextCursor) && pageHistory.current.endsAt !== activePageIndex;
  const navigation = queryStatus === 'ready' && visibleSelectedKey !== null
    ? listNavigation(visibleRows.map(({ key }) => key), visibleSelectedKey, (key) => {
        cancelPageMove();
        setSelectedKey(key);
      }, {
        offset: rowsBefore,
        more: morePages,
        onNextBeyond: () => movePage('next'),
        onPreviousBeyond: activePageIndex > 0 ? () => movePage('previous') : undefined,
      })
    : null;

  return (
    <>
      <LocalClimbViewer
        definition={definition}
        climbs={viewRows}
        selectedKey={visibleSelectedKey}
        onSelectedKeyChange={(key) => {
          // Closing the detail or choosing a row ends any climb-to-climb page move.
          cancelPageMove();
          if (key === null) setSelectedKey(null);
          else if (visibleRows.some((row) => row.key === key)) setSelectedKey(key);
        }}
        controller={controller}
        navigationOverride={navigation}
        heading="Kilter"
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        listHeader={sourceHeader}
        listFooter={pageFooter}
        renderRowMetadata={(climb) => {
          const catalogClimb = metricsByKey.get(climb.key);
          return catalogClimb && ratingScale ? (
            <span className="catalog-row-metrics">
              ★ {catalogClimb.statistics.quality.toFixed(1)} / {ratingScale.max} · {catalogClimb.statistics.ascentCount} sends
            </span>
          ) : null;
        }}
        onManageLists={onManageLists ? (key) => {
          const climb = visibleRows.find((row) => row.key === key);
          if (climb) onManageLists(climb);
        } : undefined}
      />
      {manageOpen && (
        <CatalogManageDialog
          service={service}
          onClose={() => setManageOpen(false)}
          statusAnnouncement={statusAnnouncement}
        />
      )}
      {filterOpen && ratingScale && (
        <CatalogFilterDialog
          initial={activeFilters}
          grades={gradeAdapter === queries ? gradeOptions : []}
          ratingScale={ratingScale}
          source={sourceCopy}
          onApply={(nextFilters) => {
            invalidateQuery();
            resetPaging();
            setFilters(nextFilters);
          }}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </>
  );
}

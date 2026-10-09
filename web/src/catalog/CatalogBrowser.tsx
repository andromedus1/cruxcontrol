import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { BoardLightController } from '../board-control/light-controller.ts';
import type { BoardDefinition } from '../domain/boards/definition.ts';
import type { CatalogCursor, CatalogPage } from './types.ts';
import type { CatalogClimb } from './types.ts';
import type { CatalogService } from './service.ts';
import type { ClimbViewKey } from '../climb-browser/types.ts';
import { LocalClimbViewer } from '../climb-browser/LocalClimbViewer.tsx';
import { CatalogManageDialog } from './CatalogManageDialog.tsx';
import './catalog.css';

export interface CatalogBrowserProps {
  readonly service: CatalogService;
  readonly definition: BoardDefinition;
  readonly defaultAngle: number;
  readonly controller: BoardLightController | null;
  readonly onManageOpenChange: (open: boolean) => void;
}

type QueryStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
type GradeStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

interface PageHistory {
  readonly adapter: object | null;
  cursors: Array<CatalogCursor | null>;
}

const EMPTY_ROWS: readonly CatalogClimb[] = Object.freeze([]);

function formatSize(bytes: number): string {
  const formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
  if (bytes < 1_000) return `${formatter.format(bytes)} B`;
  if (bytes < 1_000_000) return `${formatter.format(bytes / 1_000)} KB`;
  return `${formatter.format(bytes / 1_000_000)} MB`;
}

export function CatalogBrowser({
  service,
  definition,
  defaultAngle,
  controller,
  onManageOpenChange,
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
  const [grade, setGrade] = useState('all');
  const [angle, setAngle] = useState(defaultAngle);
  const [selectedKey, setSelectedKey] = useState<ClimbViewKey | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [manageOpen, setManageOpen] = useState(false);
  const queries = snapshot.queries;
  const currentQueries = useRef(queries);
  currentQueries.current = queries;
  const queryGeneration = useRef(0);
  const gradeGeneration = useRef(0);
  const pageHistory = useRef<PageHistory>({ adapter: queries, cursors: [null] });
  const manageTrigger = useRef<HTMLButtonElement | null>(null);
  const openFrame = useRef<number | null>(null);
  const mounted = useRef(true);

  if (pageHistory.current.adapter !== queries) {
    pageHistory.current = { adapter: queries, cursors: [null] };
  }
  const activePageNumber = queries ? Math.min(pageNumber || 1, pageHistory.current.cursors.length) : 1;
  const activeGrade = gradeAdapter === queries && gradeOptions.some(({ value }) => String(value) === grade)
    ? grade
    : 'all';
  const visibleRows = queries && rowsAdapter === queries ? rows : EMPTY_ROWS;
  const visiblePage = queries && rowsAdapter === queries ? page : null;
  const visibleSelectedKey = queries && rowsAdapter === queries ? selectedKey : null;
  const viewRows = useMemo(() => visibleRows.map((climb) => ({
    ...climb,
    sourceLabel: 'Legacy Kilter · read only',
  })), [visibleRows]);

  useEffect(() => {
    mounted.current = true;
    void service.start();
    return () => {
      mounted.current = false;
      queryGeneration.current += 1;
      gradeGeneration.current += 1;
      if (openFrame.current !== null) cancelAnimationFrame(openFrame.current);
      openFrame.current = null;
      onManageOpenChange(false);
    };
  }, [service, onManageOpenChange]);

  useEffect(() => {
    onManageOpenChange(manageOpen);
    if (!manageOpen) {
      requestAnimationFrame(() => manageTrigger.current?.focus());
    }
  }, [manageOpen, onManageOpenChange]);

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
    const selectedGrade = activeGrade === 'all' ? undefined : Number(activeGrade);
    setQueryStatus('loading');
    setQueryError('');
    setRows(EMPTY_ROWS);
    setPage(null);
    setRowsAdapter(queryAdapter);
    setSelectedKey(null);
    void queryAdapter.query({
      angle,
      name: search.value,
      ...(selectedGrade === undefined ? {} : { minGrade: selectedGrade, maxGrade: selectedGrade }),
      limit: 25,
      ...(cursor === undefined ? {} : { cursor }),
    }).then((result) => {
      if (generation !== queryGeneration.current || currentQueries.current !== queryAdapter) return;
      if (result.status === 'unavailable') {
        setRows(EMPTY_ROWS);
        setPage(null);
        setQueryStatus('unavailable');
        return;
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
    activeGrade,
    activePageNumber,
    retryCount,
  ]);

  const invalidateQuery = () => {
    queryGeneration.current += 1;
    setRows(EMPTY_ROWS);
    setRowsAdapter(null);
    setPage(null);
    setQueryStatus('loading');
    setQueryError('');
    setSelectedKey(null);
  };

  const resetPaging = () => {
    pageHistory.current = { adapter: queries, cursors: [null] };
    setPageNumber(1);
  };

  const openManage = (event: React.MouseEvent<HTMLButtonElement>) => {
    manageTrigger.current = event.currentTarget;
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

  let emptyTitle = 'Loading catalog';
  let emptyDescription = 'Checking whether the offline catalog is available on this device.';
  if (snapshot.operation === 'installing') {
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
      : 'Set up the older offline snapshot to search and preview compatible climbs.';
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
    emptyDescription = 'Try another name, grade, or angle.';
  }

  const sourceHeader = (
    <>
      <section className="catalog-source-row" aria-label="Catalog source">
        <div className="catalog-source-row__copy">
          <div className="catalog-source-row__title">
            <strong>Legacy Kilter</strong>
            <span className={`catalog-badge ${snapshot.storage?.status === 'ready' ? 'catalog-badge--ready' : ''}`}>
              {statusLabel}
            </span>
          </div>
          <p>Older offline snapshot · no live updates</p>
        </div>
        <button className="catalog-button catalog-button--secondary" type="button" onClick={openManage}>
          Manage
        </button>
      </section>

      {snapshot.storage?.status === 'ready' && snapshot.queries && (
        <form className="catalog-filters" onSubmit={(event) => event.preventDefault()} aria-label="Filter Legacy Kilter climbs">
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
            <span>Grade</span>
            <select
              className="catalog-input"
              value={grade}
              disabled={gradeStatus === 'loading' || gradeStatus === 'unavailable' || gradeStatus === 'error'}
              onChange={(event) => {
                invalidateQuery();
                resetPaging();
                setGrade(event.target.value);
              }}
            >
              <option value="all">All grades</option>
              {gradeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            {(gradeStatus === 'unavailable' || gradeStatus === 'error') && (
              <span className="catalog-field__help">Grade choices could not be loaded.</span>
            )}
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
          <button
            className="catalog-button catalog-button--ghost catalog-reset"
            type="button"
            onClick={() => {
              invalidateQuery();
              resetPaging();
              setSearch({ value: '', settled: true });
              setGrade('all');
              setAngle(defaultAngle);
              setRetryCount((count) => count + 1);
            }}
          >Reset filters</button>
        </form>
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
            <span aria-live="polite">Page {activePageNumber} · {visibleRows.length} {visibleRows.length === 1 ? 'climb' : 'climbs'} on this page</span>
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
                pageHistory.current = { adapter: queries, cursors };
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
      <p className="catalog-announcement" role="status" aria-live="polite">
        {snapshot.operation === 'downloading' && snapshot.progress
          ? `Catalog download ${formatSize(snapshot.progress.receivedBytes)} of ${formatSize(snapshot.progress.totalBytes)} received.`
          : queryStatus === 'ready'
            ? `${visibleRows.length} ${visibleRows.length === 1 ? 'climb' : 'climbs'} loaded on page ${activePageNumber}.`
            : queryStatus === 'error' ? queryError : ''}
      </p>
    </>
  );

  return (
    <>
      <LocalClimbViewer
        definition={definition}
        climbs={viewRows}
        selectedKey={visibleSelectedKey}
        onSelectedKeyChange={(key) => {
          if (key === null) setSelectedKey(null);
          else if (visibleRows.some((row) => row.key === key)) setSelectedKey(key);
        }}
        controller={controller}
        heading="Kilter"
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        listHeader={sourceHeader}
        listFooter={pageFooter}
      />
      {manageOpen && <CatalogManageDialog service={service} onClose={() => setManageOpen(false)} />}
    </>
  );
}

import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { CatalogService } from './service.ts';
import './catalog.css';

export interface CatalogManageDialogProps {
  readonly service: CatalogService;
  readonly onClose: () => void;
}

function formatSize(bytes: number): string {
  const formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
  if (bytes < 1_000) return `${formatter.format(bytes)} B`;
  if (bytes < 1_000_000) return `${formatter.format(bytes / 1_000)} KB`;
  return `${formatter.format(bytes / 1_000_000)} MB`;
}

function formatGenerationDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00.000Z`));
}

function formatInstalledDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

export function CatalogManageDialog({ service, onClose }: CatalogManageDialogProps): React.JSX.Element {
  const snapshot = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);

  useEffect(() => {
    if (snapshot.storage?.status === 'empty' && !snapshot.offer && !snapshot.error
      && snapshot.operation === 'idle') {
      void service.loadOffer();
    }
  }, [service, snapshot.storage, snapshot.offer, snapshot.error, snapshot.operation]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    closing.current = false;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-dialog-title]')?.focus();
  }, []);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    onClose();
  };

  const receipt = snapshot.storage?.status === 'ready' ? snapshot.storage.receipt : null;
  const details = receipt?.manifest ?? snapshot.offer;
  const progress = snapshot.progress;
  const progressPercent = progress && progress.totalBytes > 0
    ? Math.min(100, Math.floor((progress.receivedBytes / progress.totalBytes) * 100))
    : 0;
  const unavailable = snapshot.storage?.status === 'unavailable';
  const unsupported = unavailable && snapshot.storage.code === 'unsupported';
  const busy = unavailable && snapshot.storage.code === 'busy';
  const downloading = snapshot.operation === 'downloading';
  const installing = snapshot.operation === 'installing';
  const checking = snapshot.operation === 'checking-offer';
  const loading = snapshot.operation === 'opening';
  const downloadFailed = snapshot.error && snapshot.storage?.status === 'empty' && snapshot.offer;
  const metadataFailed = snapshot.error && snapshot.storage?.status === 'empty' && !snapshot.offer;

  return (
    <dialog
      ref={dialogRef}
      className="catalog-manage-dialog"
      aria-labelledby="catalog-manage-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header className="catalog-manage-dialog__heading">
        <div>
          <p className="catalog-eyebrow">Catalog source</p>
          <h2 id="catalog-manage-title" data-dialog-title tabIndex={-1}>Legacy Kilter catalog</h2>
        </div>
        <button
          className="catalog-icon-button"
          type="button"
          aria-label="Close catalog details"
          onClick={close}
        >×</button>
      </header>

      <section className="catalog-manage-dialog__content" aria-live="polite">
        {loading && <p role="status">Opening the offline catalog…</p>}
        {checking && <p role="status">Checking for catalog details…</p>}
        {downloading && (
          <div className="catalog-operation">
            <div className="catalog-operation__line">
              <strong>Downloading Legacy Kilter…</strong>
              <span>{formatSize(progress?.receivedBytes ?? 0)} of {formatSize(progress?.totalBytes ?? details?.bytesGzipped ?? 0)}</span>
            </div>
            <div
              className="catalog-progress"
              role="progressbar"
              aria-label="Legacy Kilter catalog download"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
            >
              <span style={{ width: `${progressPercent}%` }} />
            </div>
            <button className="catalog-button catalog-button--secondary" type="button" onClick={() => service.cancelDownload()}>
              Cancel download
            </button>
          </div>
        )}
        {installing && <p role="status">Verifying and installing the catalog…</p>}

        {!downloading && !installing && snapshot.error && (
          <p className="catalog-alert" role="alert">{snapshot.error.message}</p>
        )}
        {busy && <p className="catalog-muted">Another CruxControl tab currently owns this catalog. Retry after it closes the catalog.</p>}
        {unsupported && <p className="catalog-muted">Offline catalog storage is unavailable in this browser. Your local climbs and lists remain usable.</p>}
        {unavailable && !busy && !unsupported && <p className="catalog-muted">The catalog could not be opened on this device. Your local climbs and lists remain usable.</p>}

        <div className="catalog-source-facts">
          <p><strong>Older offline snapshot.</strong> This is not the current Kilter library and receives no live updates.</p>
          <p>Source freshness: unknown. The generation date describes this snapshot, not how current its source data is.</p>
          <p>Your own climbs, drafts, Trash and lists are stored separately.</p>
          {details && (
            <>
          <p>{formatSize(details.bytesGzipped)} download · {formatSize(details.bytesRaw)} catalog data per snapshot.</p>
          <p>Two slots retain the active and previous snapshots. At this size, two raw copies use {formatSize(details.bytesRaw * 2)} of storage, plus metadata and temporary installation space.</p>
              <p>Snapshot generated: {formatGenerationDate(details.generatedOn)}.</p>
            </>
          )}
          {receipt && <p>Installed on this device: {formatInstalledDate(receipt.installedAt)}.</p>}
        </div>

        {receipt && <p className="catalog-ready-message" role="status">Available offline on this device.</p>}
        {snapshot.storage?.status === 'empty' && snapshot.offer && !snapshot.error && !downloading && !installing && (
          <div className="catalog-consent">
            <h3>Download for offline climbing</h3>
            <p>This downloads the displayed snapshot to this device. You can keep using your local climbs and lists.</p>
            <button
              className="catalog-button catalog-button--primary"
              type="button"
              onClick={() => void service.installOffer()}
            >
              Download {formatSize(snapshot.offer.bytesGzipped)}
            </button>
          </div>
        )}
        {metadataFailed && !loading && !checking && (
          <button className="catalog-button catalog-button--secondary" type="button" onClick={() => void service.loadOffer()}>
            Check again
          </button>
        )}
        {downloadFailed && !downloading && !installing && (
          <button className="catalog-button catalog-button--secondary" type="button" onClick={() => void service.installOffer()}>
            Retry download
          </button>
        )}
        {unavailable && !unsupported && !loading && !checking && (
          <button className="catalog-button catalog-button--secondary" type="button" onClick={() => void service.retryOpen()}>
            Retry catalog
          </button>
        )}
      </section>

      <footer className="catalog-manage-dialog__footer">
        <button className="catalog-button catalog-button--secondary" type="button" onClick={close}>Done</button>
      </footer>
    </dialog>
  );
}

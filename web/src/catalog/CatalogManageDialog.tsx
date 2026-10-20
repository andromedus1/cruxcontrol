import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useBackAction } from '../app/use-back-action.ts';
import type { CatalogService } from './service.ts';
import { catalogRatingScale, catalogSourceCopy, catalogUpdateSummary, ratingScaleDescription } from './presentation.ts';
import { formatCalendarDate } from '../climb-browser/calendar-date.ts';
import './catalog.css';

export interface CatalogManageDialogProps {
  readonly service: CatalogService;
  readonly onClose: () => void;
  readonly statusAnnouncement: string;
}

function formatSize(bytes: number): string {
  const formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
  if (bytes < 1_000) return `${formatter.format(bytes)} B`;
  if (bytes < 1_000_000) return `${formatter.format(bytes / 1_000)} KB`;
  return `${formatter.format(bytes / 1_000_000)} MB`;
}

function formatInstalledDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

function formatCheckedAt(value: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function CatalogManageDialog({ service, onClose, statusAnnouncement }: CatalogManageDialogProps): React.JSX.Element {
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
  useBackAction(close);

  const receipt = snapshot.storage?.status === 'ready' ? snapshot.storage.receipt : null;
  const details = receipt?.manifest ?? snapshot.offer;
  const source = catalogSourceCopy(details ?? null);
  const countFormat = new Intl.NumberFormat();
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
  const update = snapshot.update;
  const updateOffer = receipt ? update.offer : null;
  const updating = updateOffer !== null && (downloading || installing);
  const downloadName = updating ? `catalog version ${updateOffer.version}` : source.name;
  const downloadTotal = updating ? updateOffer.bytesGzipped : details?.bytesGzipped ?? 0;
  const updateFailed = updateOffer !== null && update.error?.action === 'install';
  const showUpdates = update.availability !== 'unconfigured'
    && (receipt !== null || update.availability === 'signed-out');

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
          <h2 id="catalog-manage-title" data-dialog-title tabIndex={-1}>{source.title}</h2>
        </div>
        <button
          className="catalog-icon-button"
          type="button"
          aria-label="Close catalog details"
          onClick={close}
        >×</button>
      </header>

      <p className="catalog-announcement" role="status" aria-live="polite" aria-atomic="true">
        {statusAnnouncement}
      </p>

      <section className="catalog-manage-dialog__content">
        {loading && <p>Opening the offline catalog…</p>}
        {checking && <p>Checking for catalog details…</p>}
        {downloading && (
          <div className="catalog-operation">
            <div className="catalog-operation__line">
              <strong>Downloading {downloadName}…</strong>
              <span>{formatSize(progress?.receivedBytes ?? 0)} of {formatSize(progress?.totalBytes ?? downloadTotal)}</span>
            </div>
            <div
              className="catalog-progress"
              role="progressbar"
              aria-label={`${updating ? `Catalog version ${updateOffer.version}` : source.name} catalog download`}
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
        {installing && <p>Verifying and installing the catalog…</p>}

        {!downloading && !installing && snapshot.error && (
          <p className="catalog-alert" role="alert">{snapshot.error.message}</p>
        )}
        {busy && <p className="catalog-muted">Another CruxControl tab currently owns this catalog. Retry after it closes the catalog.</p>}
        {unsupported && <p className="catalog-muted">Offline catalog storage is unavailable in this browser. Your local climbs and lists remain usable.</p>}
        {unavailable && !busy && !unsupported && <p className="catalog-muted">The catalog could not be opened on this device. Your local climbs and lists remain usable.</p>}

        <div className="catalog-source-facts">
          {source.kind === 'legacy' && (
            <>
              <p><strong>Older offline snapshot.</strong> This is not the current Kilter library and receives no live updates.</p>
              <p>Source freshness: unknown. The generation date describes this snapshot, not how current its source data is.</p>
            </>
          )}
          {details?.schemaVersion === 3 && (
            <>
              <p>
                <strong>Kilter community climbs via Boardsesh.</strong> Not official Kilter data: CruxControl builds
                this catalog from Boardsesh&apos;s public community snapshot, and each climb credits its setter.
              </p>
              <p>
                Catalog version {details.version}, built {formatCalendarDate(details.generatedOn)} from the Boardsesh
                snapshot of {formatCalendarDate(details.sourceBuiltAt)}.
              </p>
              <p>
                {countFormat.format(details.climbCount)} climbs
                {details.removedUpstreamCount
                  ? `, including ${countFormat.format(details.removedUpstreamCount)} removed upstream and kept so your lists keep working`
                  : ''}.
              </p>
              <p>
                Ratings use a {ratingScaleDescription(catalogRatingScale(details))} scale. Sends count distinct climbers
                and can go down as well as up between catalog versions.
              </p>
            </>
          )}
          <p>Your own climbs, drafts, Trash and lists are stored separately.</p>
          {details && (
            <>
          <p>{formatSize(details.bytesGzipped)} download · {formatSize(details.bytesRaw)} catalog data per snapshot.</p>
          <p>Two slots retain the active and previous snapshots. At this size, two raw copies use {formatSize(details.bytesRaw * 2)} of storage, plus metadata and temporary installation space.</p>
              {details.schemaVersion === 2 && <p>Snapshot generated: {formatCalendarDate(details.generatedOn)}.</p>}
            </>
          )}
          {receipt && <p>Installed on this device: {formatInstalledDate(receipt.installedAt)}.</p>}
        </div>

        {receipt && <p className="catalog-ready-message">Available offline on this device.</p>}
        {showUpdates && (
          <section className="catalog-update" aria-labelledby="catalog-update-title">
            <h3 id="catalog-update-title">Catalog updates</h3>
            {update.availability === 'signed-out' ? (
              <p>Sign in to get catalog updates.</p>
            ) : receipt && (
              <>
                <p>
                  Installed: version {receipt.manifest.version}, built {formatCalendarDate(receipt.manifest.generatedOn)}.
                </p>
                {updateOffer && (
                  <p>
                    Available: version {updateOffer.version}, built {formatCalendarDate(updateOffer.generatedOn)} ·{' '}
                    {catalogUpdateSummary(updateOffer.version, update.changes)} · {formatSize(updateOffer.bytesGzipped)} download.
                  </p>
                )}
                {!updateOffer && update.availability === 'current' && !update.checking && (
                  <p>This catalog is up to date.</p>
                )}
              </>
            )}
            {update.checking && <p>Checking for catalog updates…</p>}
            {update.error && !updating && update.availability !== 'signed-out' && (
              <p className="catalog-alert" role="alert">
                {update.error.action === 'install' ? `Catalog update failed. ${update.error.message} Your current catalog is still installed.` : update.error.message}
              </p>
            )}
            {receipt && (
              <p className="catalog-muted">
                Last checked: {update.lastCheckedAt === null ? 'not yet on this device' : formatCheckedAt(update.lastCheckedAt)}.
              </p>
            )}
            <div className="catalog-update__actions">
              {updateOffer && !updating && (
                <button
                  className="catalog-button catalog-button--primary"
                  type="button"
                  disabled={snapshot.operation !== 'idle' || update.checking}
                  onClick={() => void service.installUpdate()}
                >
                  {updateFailed ? 'Retry update' : `Install version ${updateOffer.version}`}
                </button>
              )}
              {receipt && (
                <button
                  className="catalog-button catalog-button--secondary"
                  type="button"
                  disabled={snapshot.operation !== 'idle' || update.checking}
                  onClick={() => void service.checkForUpdate({ force: true })}
                >
                  Check now
                </button>
              )}
            </div>
          </section>
        )}
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

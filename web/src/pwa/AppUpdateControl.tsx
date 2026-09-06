import { useEffect, useState } from 'react';
import type { AppUpdateService, AppUpdateSnapshot } from './update-service.ts';
import './AppUpdateControl.css';

export interface AppUpdateControlProps {
  readonly service: AppUpdateService;
  readonly boardConnected?: boolean;
  readonly onDisconnectBoard?: () => Promise<void> | void;
  readonly onRetry?: () => void;
}

export function AppUpdateControl({
  service,
  boardConnected = false,
  onDisconnectBoard,
  onRetry,
}: AppUpdateControlProps) {
  const [snapshot, setSnapshot] = useState<AppUpdateSnapshot>(() => service.getSnapshot());
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => service.subscribe(setSnapshot), [service]);

  if (snapshot.status === 'current' || snapshot.status === 'unavailable') return null;

  const reloadRequired = snapshot.status === 'reload-required';
  const showBanner = !snapshot.dismissed || reloadRequired;
  const disconnect = async () => {
    if (!onDisconnectBoard || disconnecting) return;
    setDisconnecting(true);
    try {
      await onDisconnectBoard();
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <aside
      className={`app-update-control${snapshot.status === 'applying' ? ' app-update-control--applying' : ''}`}
      aria-label="Application update"
      data-applying={snapshot.status === 'applying' ? 'true' : undefined}
    >
      {showBanner ? (
        <>
          <div>
            <p className="eyebrow">CruxControl update available</p>
            <p>{snapshot.message}</p>
          </div>
          <div className="app-update-control__actions">
            {reloadRequired ? (
              <button className="button button--primary" type="button" onClick={() => service.reload?.()}>
                Reload to continue
              </button>
            ) : (
              <button
                className="button button--primary"
                type="button"
                disabled={!snapshot.canApply || snapshot.status === 'applying'}
                onClick={() => void service.apply()}
              >
                Update and reload
              </button>
            )}
            {snapshot.status === 'error' && onRetry && (
              <button className="button button--secondary" type="button" onClick={onRetry}>
                Retry
              </button>
            )}
            {!reloadRequired && snapshot.status !== 'applying' && (
              <button className="button button--secondary" type="button" onClick={() => service.dismiss?.()}>
                Later
              </button>
            )}
            {boardConnected && onDisconnectBoard && !reloadRequired && (
              <button
                className="button button--secondary"
                type="button"
                disabled={disconnecting || snapshot.status === 'applying'}
                onClick={() => void disconnect()}
              >
                {disconnecting ? 'Disconnecting…' : 'Disconnect board'}
              </button>
            )}
          </div>
        </>
      ) : (
        <button className="button button--secondary" type="button" onClick={() => service.reopen?.()}>
          Update available
        </button>
      )}
      <p className="app-update-control__status" role="status" aria-live="polite">
        {snapshot.status === 'applying' ? snapshot.message : ''}
      </p>
    </aside>
  );
}

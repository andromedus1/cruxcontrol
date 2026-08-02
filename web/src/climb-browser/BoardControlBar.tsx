import type { BoardLightController } from '../board-control/light-controller';
import { useBoardLightState } from './use-board-light-state';

export interface BoardControlBarProps {
  readonly controller?: BoardLightController | null;
}

export function BoardControlBar({ controller }: BoardControlBarProps) {
  const state = useBoardLightState(controller);
  const transport = state.transport;
  const busy = ['selecting', 'connecting', 'disconnecting'].includes(transport.status);
  const canConnect = Boolean(controller) &&
    (transport.status === 'disconnected' ||
      (transport.status === 'error' && transport.error.recoverable));

  let label = 'Bluetooth unavailable';
  if (transport.status === 'disconnected') label = 'Board disconnected';
  if (transport.status === 'selecting') label = 'Choose your board…';
  if (transport.status === 'connecting') label = `Connecting to ${transport.device.name ?? 'board'}…`;
  if (transport.status === 'connected') label = `Connected · ${transport.device.name ?? 'Kilter Board'}`;
  if (transport.status === 'disconnecting') label = 'Disconnecting…';
  if (transport.status === 'error') label = transport.error.message;

  const connect = () => {
    if (!controller) return;
    const action = transport.status === 'error' && transport.device
      ? controller.reconnect(transport.device.id)
      : controller.requestAndConnect();
    void action.catch(() => undefined);
  };

  return (
    <div className="board-control-bar">
      <span className={`connection-dot connection-dot--${transport.status}`} aria-hidden="true" />
      <span className="board-control-bar__status" role="status">{label}</span>
      {canConnect && <button className="button button--secondary" type="button" onClick={connect}>Connect</button>}
      {busy && <span className="board-control-bar__busy" aria-hidden="true">•••</span>}
    </div>
  );
}

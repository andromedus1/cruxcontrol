import { useMemo, useState } from 'react';
import { apiLevelForAuroraDeviceName, type AuroraApiLevel } from './api-level-2-codec';
import { encodedSceneCost } from './capacity-model';
import type { BoardLightController, CapacityCase, CapacityCaseResult } from './light-controller';
import { useBoardLightState } from '../climb-browser/use-board-light-state';

// Include both Aurora packet boundaries and nearby search points so physical testing can
// distinguish controller message assembly from an aggregate LED/load ceiling.
const LIGHT_COUNTS = [1, 20, 84, 85, 100, 120, 126, 127, 128, 140, 150, 160, 168, 252, 305] as const;
const FPS = [0, 1, 2, 4, 6, 8, 10] as const;
const PACING = [20, 10, 5, 0] as const;

export function BoardCapacityDiagnostics({
  controller,
  maxLights,
}: {
  readonly controller: BoardLightController | null | undefined;
  readonly maxLights: number;
}) {
  const state = useBoardLightState(controller);
  const connected = state?.transport.status === 'connected';
  const apiLevel: AuroraApiLevel = apiLevelForAuroraDeviceName(
    connected ? state.transport.device.name : null,
  );
  const [lightCount, setLightCount] = useState(Math.min(20, maxLights));
  const [requestedFps, setRequestedFps] = useState<CapacityCase['requestedFps']>(0);
  const [interChunkDelayMs, setInterChunkDelayMs] = useState<CapacityCase['interChunkDelayMs']>(20);
  const running = state.operation === 'diagnosing';
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CapacityCaseResult | null>(null);
  const [observation, setObservation] = useState<'correct' | 'unexpected' | null>(null);
  const cost = useMemo(() => encodedSceneCost(apiLevel, lightCount), [apiLevel, lightCount]);

  const start = async () => {
    if (!controller?.runCapacityCase) return;
    setError(null);
    setResult(null);
    setObservation(null);
    try {
      setResult(
        await controller.runCapacityCase({
          apiLevel,
          lightCount,
          requestedFps,
          durationMs: requestedFps === 0 ? 1_000 : 15_000,
          interChunkDelayMs,
        }),
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not start the board capacity test.');
    }
  };

  const exportTrace = () => {
    if (!result) return;
    const payload = JSON.stringify(
      {
        schemaVersion: 1,
        case: { apiLevel, lightCount, requestedFps, interChunkDelayMs },
        cost,
        status: result.status,
        summary: result.summary,
        trace: result.trace,
        observation,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `cruxcontrol-capacity-${lightCount}-${requestedFps}fps.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <details className="board-capacity">
      <summary>Board capacity test</summary>
      <p>Local, bounded hardware diagnostic. It clears before and after every case.</p>
      <div className="board-capacity__controls">
        <label>
          Lights
          <select
            value={lightCount}
            onChange={(event) => setLightCount(Number(event.target.value))}
            disabled={running}
          >
            {LIGHT_COUNTS.filter((count) => count <= maxLights).map((count) => (
              <option key={count}>{count}</option>
            ))}
          </select>
        </label>
        <label>
          Frames/sec
          <select
            value={requestedFps}
            onChange={(event) =>
              setRequestedFps(Number(event.target.value) as CapacityCase['requestedFps'])
            }
            disabled={running}
          >
            {FPS.map((fps) => (
              <option key={fps} value={fps}>
                {fps === 0 ? 'Static' : fps}
              </option>
            ))}
          </select>
        </label>
        <label>
          Write pacing
          <select
            value={interChunkDelayMs}
            onChange={(event) =>
              setInterChunkDelayMs(Number(event.target.value) as CapacityCase['interChunkDelayMs'])
            }
            disabled={running}
          >
            {PACING.map((delay) => (
              <option key={delay} value={delay}>
                {delay} ms
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="board-capacity__cost">
        API {apiLevel} · {cost.packetCount} packets · {cost.framedBytes} bytes · {cost.writeCount}{' '}
        writes
      </p>
      <div className="board-capacity__actions">
        <button
          type="button"
          disabled={!connected || running || state.operation !== 'idle' || !controller?.runCapacityCase}
          onClick={() => void start()}
        >
          Start case
        </button>
        <button type="button" disabled={!running} onClick={() => controller?.stopCapacityCase?.()}>
          Stop
        </button>
        <button
          type="button"
          disabled={running || !controller}
          onClick={() => void controller?.reconnect()}
        >
          Reconnect
        </button>
        <button
          type="button"
          disabled={running || !connected}
          onClick={() => void controller?.clear()}
        >
          Clear board
        </button>
      </div>
      {!connected && <p>Use Connect above to pair the board before starting.</p>}
      {error && <p role="alert">{error}</p>}
      {result && (
        <div className="board-capacity__result">
          <p role="status">
            {result.status} · {result.summary.appliedFrames} frames · p95{' '}
            {result.summary.p95BatchMs.toFixed(1)} ms
          </p>
          <fieldset>
            <legend>What did the board do?</legend>
            <label>
              <input
                type="radio"
                name="capacity-observation"
                checked={observation === 'correct'}
                onChange={() => setObservation('correct')}
              />{' '}
              Pattern/clear correct
            </label>
            <label>
              <input
                type="radio"
                name="capacity-observation"
                checked={observation === 'unexpected'}
                onChange={() => setObservation('unexpected')}
              />{' '}
              Unexpected/stuck LEDs
            </label>
          </fieldset>
          <button type="button" onClick={exportTrace}>
            Export local trace
          </button>
        </div>
      )}
    </details>
  );
}

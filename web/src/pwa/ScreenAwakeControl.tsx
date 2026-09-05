import { useEffect, useId, useState } from 'react';
import './ScreenAwakeControl.css';

type WakeStatus = 'off' | 'requesting' | 'active' | 'suspended' | 'released' | 'denied';

const statusCopy: Record<WakeStatus, string> = {
  off: 'Prevent automatic screen timeout during this session.',
  requesting: 'Keeping the screen awake…',
  active: 'Screen awake. Keep CruxControl visible; this uses more battery.',
  suspended: 'Screen-awake paused while CruxControl is hidden.',
  released: 'Screen can sleep: the device released the screen-awake request.',
  denied: 'Screen can sleep: the device could not keep it awake. Check battery-saving settings.',
};

export function ScreenAwakeControl() {
  const supported = typeof navigator.wakeLock?.request === 'function';
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<WakeStatus>('off');
  const [attempt, setAttempt] = useState(0);
  const descriptionId = useId();

  useEffect(() => {
    if (!supported || !enabled) {
      setStatus('off');
      return;
    }
    let disposed = false;
    let generation = 0;
    let pending = false;
    let held: WakeLockSentinel | null = null;

    const release = () => {
      generation += 1;
      pending = false;
      const lock = held;
      held = null;
      if (lock) void lock.release().catch(() => undefined);
    };

    const acquire = async () => {
      if (disposed || document.visibilityState !== 'visible' || held || pending) return;
      const requestGeneration = ++generation;
      pending = true;
      setStatus('requesting');
      try {
        const lock = await navigator.wakeLock.request('screen');
        // A request can finish after hiding, disabling, retrying or unmounting.
        if (disposed || generation !== requestGeneration || document.visibilityState !== 'visible') {
          await lock.release();
          return;
        }
        pending = false;
        if (lock.released) {
          setStatus('released');
          return;
        }
        held = lock;
        lock.addEventListener('release', () => {
          if (disposed || held !== lock) return;
          held = null;
          setStatus(document.visibilityState === 'visible' ? 'released' : 'suspended');
        }, { once: true });
        setStatus('active');
      } catch {
        if (disposed || generation !== requestGeneration) return;
        pending = false;
        setStatus('denied');
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void acquire();
      } else {
        release();
        setStatus('suspended');
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    onVisibilityChange();
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      release();
    };
  }, [attempt, enabled, supported]);

  return (
    <aside className="screen-awake-control" aria-label="Screen awake">
      <label>
        <input
          type="checkbox"
          checked={enabled}
          disabled={!supported}
          aria-describedby={descriptionId}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        Keep screen awake
      </label>
      <span id={descriptionId} aria-live="polite">
        {supported ? statusCopy[status] : 'Keeping the screen awake is unavailable in this browser.'}
      </span>
      {enabled && (status === 'released' || status === 'denied') && (
        <button className="button button--secondary" type="button" onClick={() => setAttempt((value) => value + 1)}>
          Retry screen awake
        </button>
      )}
    </aside>
  );
}

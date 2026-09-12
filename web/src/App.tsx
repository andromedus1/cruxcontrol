import { useEffect, useState } from 'react';
import type { BoardLightController } from './board-control/light-controller';
import { LocalClimbViewer } from './climb-browser/LocalClimbViewer';
import type { ClimbViewKey, ClimbViewRecord } from './climb-browser/types';
import type { BoardDefinition } from './domain/boards/definition';
import { kilterFullride7x10Definition } from './domain/boards/definitions/kilter-fullride-7x10';
import { CruxControlWorkspace } from './app/CruxControlWorkspace';
import { createCruxControlRuntime, type CruxControlRuntime } from './app/create-runtime';
import type { AppUpdateService } from './pwa/update-service.ts';
import { AppUpdateControl } from './pwa/AppUpdateControl.tsx';

const noClimbs: readonly ClimbViewRecord[] = Object.freeze([]);

export interface AppProps {
  readonly definition?: BoardDefinition;
  readonly climbs?: readonly ClimbViewRecord[];
  readonly controller?: BoardLightController | null;
  readonly onCreateClimb?: () => void;
  readonly createRuntime?: () => Promise<CruxControlRuntime>;
  readonly updateService?: AppUpdateService;
  readonly startupAdmission?: Promise<void>;
}

export function App({
  definition,
  climbs,
  controller,
  onCreateClimb,
  createRuntime: runtimeFactory = createCruxControlRuntime,
  updateService,
  startupAdmission,
}: AppProps) {
  const [selectedKey, setSelectedKey] = useState<ClimbViewKey | null>(null);
  const injected =
    definition !== undefined ||
    climbs !== undefined ||
    controller !== undefined ||
    onCreateClimb !== undefined;
  const [runtime, setRuntime] = useState<CruxControlRuntime | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [admissionOverride, setAdmissionOverride] = useState<Promise<void> | null>(null);
  useEffect(() => {
    if (injected) return;
    let active = true;
    let created: CruxControlRuntime | null = null;
    const admission = admissionOverride ?? startupAdmission ?? Promise.resolve();
    void admission
      .then(() => runtimeFactory())
      .then((value) => {
        created = value;
        if (active) setRuntime(value);
        else value.close();
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : 'Could not start CruxControl.');
      });
    return () => {
      active = false;
      created?.close();
    };
  }, [admissionOverride, attempt, injected, runtimeFactory, startupAdmission]);
  if (injected)
    return (
      <LocalClimbViewer
        definition={definition ?? kilterFullride7x10Definition}
        climbs={climbs ?? noClimbs}
        selectedKey={selectedKey}
        onSelectedKeyChange={setSelectedKey}
        controller={controller}
        heading="My Climbs"
        emptyTitle="No finished climbs yet"
        emptyDescription="Mark a draft finished when it is ready for your main climb library."
        onCreateClimb={onCreateClimb}
      />
    );
  if (error)
    return (
      <>
        {updateService && (
          <AppUpdateControl
            service={updateService}
            onRetry={() => {
              const nextAdmission = updateService.start();
              setAdmissionOverride(nextAdmission);
              setError('');
              setAttempt((value) => value + 1);
            }}
          />
        )}
        <main className="app-startup">
        <h1>CruxControl couldn’t start</h1>
        <p role="alert">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError('');
            setAttempt((value) => value + 1);
          }}
        >
          Retry
        </button>
        </main>
      </>
    );
  if (!runtime)
    return (
      <main className="app-startup" aria-live="polite">
        Opening your local climbs…
      </main>
    );
  return <CruxControlWorkspace runtime={runtime} updateService={updateService} />;
}

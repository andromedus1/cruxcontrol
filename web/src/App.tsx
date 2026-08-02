import { useState } from 'react';
import type { BoardLightController } from './board-control/light-controller';
import { LocalClimbViewer } from './climb-browser/LocalClimbViewer';
import type { ClimbViewKey, ClimbViewRecord } from './climb-browser/types';
import type { BoardDefinition } from './domain/boards/definition';
import { kilterFullride7x10Definition } from './domain/boards/definitions/kilter-fullride-7x10';

const noClimbs: readonly ClimbViewRecord[] = Object.freeze([]);

export interface AppProps {
  readonly definition?: BoardDefinition;
  readonly climbs?: readonly ClimbViewRecord[];
  readonly controller?: BoardLightController | null;
  readonly onCreateClimb?: () => void;
}

export function App({ definition = kilterFullride7x10Definition, climbs = noClimbs, controller, onCreateClimb }: AppProps) {
  const [selectedKey, setSelectedKey] = useState<ClimbViewKey | null>(null);
  return <LocalClimbViewer definition={definition} climbs={climbs} selectedKey={selectedKey} onSelectedKeyChange={setSelectedKey} controller={controller} onCreateClimb={onCreateClimb} />;
}

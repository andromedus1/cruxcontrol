import { createFullrideLightController } from '../board-control/light-controller.ts';
import type { BoardByteTransport } from '../board-control/transport.ts';
import type { BoardDefinition } from '../domain/boards/definition.ts';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10.ts';
import {
  controllerProfileId,
  type ControllerProfile,
  type ControllerProfileId,
} from './contracts.ts';

export const FULLRIDE_CONTROLLER_PROFILE_ID: ControllerProfileId = controllerProfileId(
  'aurora-api-level-3-fullride',
);

export function createFullrideControllerProfile(
  createTransport: () => BoardByteTransport,
): ControllerProfile {
  return Object.freeze({
    id: FULLRIDE_CONTROLLER_PROFILE_ID,
    compatibleDefinitionIds: Object.freeze([kilterFullride7x10Definition.id]),
    createController: (definition: BoardDefinition) =>
      createFullrideLightController({ definition, transport: createTransport() }),
  });
}

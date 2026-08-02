import { AURORA_WEB_BLUETOOTH_CONFIG } from '../board-control/aurora-web-bluetooth.ts';
import type { BoardByteTransport } from '../board-control/transport.ts';
import { getBrowserBluetoothPlatform } from '../board-control/web-bluetooth-platform.ts';
import { WebBluetoothByteTransport } from '../board-control/web-bluetooth-transport.ts';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10.ts';
import { boardDefinitions } from '../domain/boards/registry.ts';
import {
  boardInstallationId,
  createBoardInstallationRegistry,
  createFullrideControllerProfile,
  FULLRIDE_CONTROLLER_PROFILE_ID,
  type BoardInstallationConfig,
  type BoardInstallationId,
  type BoardInstallationRegistry,
} from '../installations/index.ts';

export const HOME_FULLRIDE_INSTALLATION_ID: BoardInstallationId =
  boardInstallationId('home-fullride-7x10');

export const homeFullrideInstallationConfig: BoardInstallationConfig = Object.freeze({
  id: HOME_FULLRIDE_INSTALLATION_ID,
  definitionId: kilterFullride7x10Definition.id,
  angle: 40,
  localCreation: true,
  catalogProviderId: null,
  controllerProfileId: FULLRIDE_CONTROLLER_PROFILE_ID,
});

export interface AppInstallationOptions {
  readonly createTransport?: () => BoardByteTransport;
}

export function createAppInstallationRegistry(
  options: AppInstallationOptions = {},
): BoardInstallationRegistry {
  const createTransport =
    options.createTransport ??
    (() =>
      new WebBluetoothByteTransport(getBrowserBluetoothPlatform(), AURORA_WEB_BLUETOOTH_CONFIG));
  return createBoardInstallationRegistry([homeFullrideInstallationConfig], {
    definitions: boardDefinitions,
    controllerProfiles: [createFullrideControllerProfile(createTransport)],
  });
}

export const activeInstallationId: BoardInstallationId = HOME_FULLRIDE_INSTALLATION_ID;

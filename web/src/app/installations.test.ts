import { MockBoardByteTransport } from '../board-control/mock-byte-transport.ts';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10.ts';
import {
  activeInstallationId,
  createAppInstallationRegistry,
  HOME_FULLRIDE_INSTALLATION_ID,
} from './installations.ts';

describe('app installation composition', () => {
  it('ships one active local Fullride installation without eager transport allocation', () => {
    const createTransport = vi.fn(() => new MockBoardByteTransport());
    const registry = createAppInstallationRegistry({ createTransport });

    expect(createTransport).not.toHaveBeenCalled();
    expect(activeInstallationId).toBe(HOME_FULLRIDE_INSTALLATION_ID);
    expect(registry.list()).toHaveLength(1);
    const installation = registry.require(activeInstallationId);
    expect(installation.config).toMatchObject({
      definitionId: kilterFullride7x10Definition.id,
      angle: 40,
      localCreation: true,
      catalogProviderId: null,
    });
    expect(installation.definition).toBe(kilterFullride7x10Definition);
    expect(installation.provider).toBeNull();
    expect(installation.controllerProfile).not.toBeNull();
    expect(installation.capabilities).toEqual({
      browse: { available: false, reason: 'not-configured' },
      control: { available: true },
      create: { available: true },
      publish: { available: false, reason: 'not-configured' },
      import: { available: false, reason: 'not-configured' },
      sync: { available: false, reason: 'not-configured' },
    });

    const controller = installation.createController();
    expect(createTransport).toHaveBeenCalledOnce();
    expect(installation.createController()).toBe(controller);
    expect(controller).toEqual(
      expect.objectContaining({
        getState: expect.any(Function),
        requestAndConnect: expect.any(Function),
        disconnect: expect.any(Function),
        light: expect.any(Function),
        clear: expect.any(Function),
        preview: expect.any(Function),
      }),
    );
  });
});

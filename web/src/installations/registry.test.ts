import type { BoardLightController } from '../board-control/light-controller.ts';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10.ts';
import { boardDefinitionId, providerId } from '../domain/boards/identity.ts';
import { boardDefinitions } from '../domain/boards/registry.ts';
import {
  boardInstallationId,
  controllerProfileId,
  type BoardInstallationConfig,
  type CatalogProviderRegistration,
  type ControllerProfile,
} from './contracts.ts';
import {
  configureBoardInstallation,
  createBoardInstallationRegistry,
  InstallationConfigurationError,
} from './registry.ts';

const installationId = boardInstallationId('home');
const profileId = controllerProfileId('test-profile');
const config = (overrides: Partial<BoardInstallationConfig> = {}): BoardInstallationConfig => ({
  id: installationId,
  definitionId: kilterFullride7x10Definition.id,
  angle: 40,
  localCreation: true,
  catalogProviderId: null,
  controllerProfileId: null,
  ...overrides,
});

const controllerDouble = (): BoardLightController => ({
  getState: vi.fn(),
  subscribe: vi.fn(),
  requestAndConnect: vi.fn(),
  reconnect: vi.fn(),
  disconnect: vi.fn(),
  light: vi.fn(),
  clear: vi.fn(),
  preview: vi.fn(),
});

function expectCode(run: () => unknown, code: InstallationConfigurationError['code']) {
  expect(run).toThrow(expect.objectContaining({ code }));
}

describe('installation contracts', () => {
  it.each([
    ['board installation', boardInstallationId],
    ['controller profile', controllerProfileId],
  ])('rejects empty %s IDs', (_label, createId) => {
    expect(() => createId('  ')).toThrow(TypeError);
  });

  it('derives local-only capabilities without inferring provider support', () => {
    const createController = vi.fn(() => controllerDouble());
    const installation = configureBoardInstallation(config({ controllerProfileId: profileId }), {
      definitions: boardDefinitions,
      controllerProfiles: [
        {
          id: profileId,
          compatibleDefinitionIds: [kilterFullride7x10Definition.id],
          createController,
        },
      ],
    });

    expect(installation.capabilities).toEqual({
      browse: { available: false, reason: 'not-configured' },
      control: { available: true },
      create: { available: true },
      publish: { available: false, reason: 'not-configured' },
      import: { available: false, reason: 'not-configured' },
      sync: { available: false, reason: 'not-configured' },
    });
    expect(createController).not.toHaveBeenCalled();
  });

  it('mirrors each configured provider capability independently', () => {
    const provider: CatalogProviderRegistration = {
      id: providerId('community'),
      compatibleDefinitionIds: [kilterFullride7x10Definition.id],
      capabilities: { browse: true, publish: false, import: true, sync: false },
    };
    const installation = configureBoardInstallation(
      config({ localCreation: false, catalogProviderId: provider.id }),
      { definitions: boardDefinitions, providers: [provider] },
    );
    expect(installation.capabilities).toEqual({
      browse: { available: true },
      control: { available: false, reason: 'not-configured' },
      create: { available: false, reason: 'not-supported' },
      publish: { available: false, reason: 'not-supported' },
      import: { available: true },
      sync: { available: false, reason: 'not-supported' },
    });
  });

  it('validates references, compatibility, and angles before controller construction', () => {
    const factory = vi.fn(() => controllerDouble());
    const profile: ControllerProfile = {
      id: profileId,
      compatibleDefinitionIds: [],
      createController: factory,
    };
    expect(() =>
      configureBoardInstallation(config({ definitionId: boardDefinitionId('missing') }), {
        definitions: boardDefinitions,
      }),
    ).toThrow(/Unknown board definition/);
    expectCode(
      () =>
        configureBoardInstallation(config({ catalogProviderId: providerId('missing') }), {
          definitions: boardDefinitions,
        }),
      'unknown-provider',
    );
    expectCode(
      () =>
        configureBoardInstallation(config({ controllerProfileId: profileId }), {
          definitions: boardDefinitions,
        }),
      'unknown-controller-profile',
    );
    expectCode(
      () =>
        configureBoardInstallation(config({ controllerProfileId: profileId }), {
          definitions: boardDefinitions,
          controllerProfiles: [profile],
        }),
      'incompatible-controller-profile',
    );
    expectCode(
      () =>
        configureBoardInstallation(config({ angle: Number.NaN }), {
          definitions: boardDefinitions,
        }),
      'unsupported-angle',
    );
    expectCode(
      () => configureBoardInstallation(config({ angle: 41 }), { definitions: boardDefinitions }),
      'unsupported-angle',
    );
    expect(factory).not.toHaveBeenCalled();
  });

  it('rejects incompatible and duplicate provider registrations', () => {
    const provider: CatalogProviderRegistration = {
      id: providerId('community'),
      compatibleDefinitionIds: [],
      capabilities: { browse: true, publish: true, import: true, sync: true },
    };
    expectCode(
      () =>
        configureBoardInstallation(config({ catalogProviderId: provider.id }), {
          definitions: boardDefinitions,
          providers: [provider],
        }),
      'incompatible-provider',
    );
    expectCode(
      () =>
        createBoardInstallationRegistry([], {
          definitions: boardDefinitions,
          providers: [provider, provider],
        }),
      'duplicate-provider',
    );
  });

  it('rejects duplicate profiles and installations', () => {
    const profile: ControllerProfile = {
      id: profileId,
      compatibleDefinitionIds: [kilterFullride7x10Definition.id],
      createController: () => controllerDouble(),
    };
    expectCode(
      () =>
        createBoardInstallationRegistry([], {
          definitions: boardDefinitions,
          controllerProfiles: [profile, profile],
        }),
      'duplicate-controller-profile',
    );
    expectCode(
      () =>
        createBoardInstallationRegistry([config(), config()], { definitions: boardDefinitions }),
      'duplicate-installation',
    );
  });

  it('constructs one controller lazily with the resolved definition', () => {
    const controller = controllerDouble();
    const createController = vi.fn(() => controller);
    const installation = configureBoardInstallation(config({ controllerProfileId: profileId }), {
      definitions: boardDefinitions,
      controllerProfiles: [
        {
          id: profileId,
          compatibleDefinitionIds: [kilterFullride7x10Definition.id],
          createController,
        },
      ],
    });
    expect(installation.createController()).toBe(controller);
    expect(installation.createController()).toBe(controller);
    expect(createController).toHaveBeenCalledOnce();
    expect(createController).toHaveBeenCalledWith(kilterFullride7x10Definition);
  });

  it('does not hide or repeat controller construction failures', () => {
    const failure = new Error('factory failed');
    const createController = vi.fn(() => {
      throw failure;
    });
    const installation = configureBoardInstallation(config({ controllerProfileId: profileId }), {
      definitions: boardDefinitions,
      controllerProfiles: [
        {
          id: profileId,
          compatibleDefinitionIds: [kilterFullride7x10Definition.id],
          createController,
        },
      ],
    });
    expect(() => installation.createController()).toThrow(failure);
    expect(() => installation.createController()).toThrow(failure);
    expect(createController).toHaveBeenCalledOnce();
  });

  it('copies caller-owned values, freezes public values, and sorts deterministically', () => {
    const compatible = [kilterFullride7x10Definition.id];
    const providerCapabilities = { browse: true, publish: false, import: false, sync: false };
    const provider: CatalogProviderRegistration = {
      id: providerId('community'),
      compatibleDefinitionIds: compatible,
      capabilities: providerCapabilities,
    };
    const first = config({ id: boardInstallationId('z'), catalogProviderId: provider.id });
    const second = config({ id: boardInstallationId('a'), catalogProviderId: provider.id });
    const registry = createBoardInstallationRegistry([first, second], {
      definitions: boardDefinitions,
      providers: [provider],
    });
    compatible.length = 0;
    providerCapabilities.browse = false;

    expect(registry.list().map((entry) => entry.config.id)).toEqual(['a', 'z']);
    const installation = registry.require(boardInstallationId('a'));
    expect(installation.provider?.compatibleDefinitionIds).toHaveLength(1);
    expect(installation.capabilities.browse).toEqual({ available: true });
    [
      registry,
      registry.list(),
      installation,
      installation.config,
      installation.capabilities,
      installation.provider,
      installation.provider?.compatibleDefinitionIds,
      installation.provider?.capabilities,
    ].forEach((value) => expect(Object.isFrozen(value)).toBe(true));
  });
});

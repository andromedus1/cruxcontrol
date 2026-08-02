import { packApiLevel3Color } from '../colors';
import type { BoardDefinition, ClimbRole } from '../definition';
import {
  boardDefinitionId,
  boardPlacementId,
  layoutRevisionId,
  providerId,
  providerSourceId,
} from '../identity';
import type { ProviderId } from '../types';
import { assertBoardDefinition } from '../validate-definition';
import { generatedKilterFullride7x10 as generated } from './kilter-fullride-7x10.generated';

export const KILTER_PROVIDER_ID: ProviderId = providerId('kilter');
export const KILTER_FULLRIDE_7X10_REVISION = layoutRevisionId(generated.revision);

const screenColors: Readonly<Record<ClimbRole, `#${string}`>> = {
  start: '#559b43',
  middle: '#337f91',
  finish: '#a64476',
  'foot-only': '#ae651e',
};
const labels: Readonly<Record<ClimbRole, string>> = {
  start: 'Start · Green',
  middle: 'Middle · Blue',
  finish: 'Finish · Red/Pink',
  'foot-only': 'Foot-only · Gold/Yellow',
};

function rgb(hex: string) {
  if (!/^[0-9a-f]{6}$/i.test(hex)) throw new TypeError(`Invalid source RGB color ${hex}`);
  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

const [left, right, bottom, top] = generated.bounds;
const rolePresets = Object.fromEntries(
  generated.roles.map((source) => {
    const role = source.semantic as ClimbRole;
    return [
      role,
      {
        role,
        label: labels[role],
        sourceRoleId: providerSourceId(String(source.sourceId)),
        lightColor: packApiLevel3Color(rgb(source.ledColor)),
        screenColor: screenColors[role],
      },
    ];
  }),
) as BoardDefinition['rolePresets'];

const definition: BoardDefinition = {
  id: boardDefinitionId('kilter-fullride-7x10'),
  layoutRevision: KILTER_FULLRIDE_7X10_REVISION,
  manufacturer: 'Kilter Grips',
  model: 'Kilter Board Homewall',
  layout: 'Fullride',
  size: '7x10',
  bounds: { left, right, bottom, top },
  supportedAngles: [...generated.angles],
  placements: generated.placements.map((placement) => ({
    id: boardPlacementId(`kilter:${generated.revision}:placement:${placement.placement_id}`),
    position: { x: placement.x, y: placement.y },
    native: {
      provider: KILTER_PROVIDER_ID,
      productId: providerSourceId('7'),
      layoutId: providerSourceId('8'),
      productSizeId: providerSourceId('17'),
      setId: providerSourceId(String(placement.set_id)),
      placementId: providerSourceId(String(placement.placement_id)),
      holeId: providerSourceId(String(placement.hole_id)),
      ledPosition: placement.led_position,
    },
  })),
  rolePresets,
};

assertBoardDefinition(definition);
export const kilterFullride7x10Definition = deepFreeze(definition);

export const KILTER_FULLRIDE_7X10_PROVENANCE = deepFreeze({
  sourceSha256: generated.sourceSha256,
  definitionSha256: generated.definitionSha256,
  totalScoped: generated.totalScoped,
  emitted: generated.emitted,
  excluded: generated.excluded,
  totalBySet: generated.totalBySet,
  emittedBySet: generated.emittedBySet,
  excludedBySet: generated.excludedBySet,
  sourceRoles: generated.roles,
});

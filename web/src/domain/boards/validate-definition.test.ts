import { describe, expect, it } from 'vitest';
import { apiLevel3Color } from './colors';
import type { BoardDefinition, DefinitionValidationCode } from './definition';
import {
  boardDefinitionId,
  boardPlacementId,
  layoutRevisionId,
  providerId,
  providerSourceId,
} from './identity';
import { validateBoardDefinition } from './validate-definition';

function valid(): BoardDefinition {
  const source = providerSourceId;
  return {
    id: boardDefinitionId('test'),
    layoutRevision: layoutRevisionId('r1'),
    manufacturer: 'Test',
    model: 'Test',
    layout: 'Test',
    size: 'Test',
    bounds: { left: 0, right: 10, bottom: 0, top: 10 },
    supportedAngles: [0, 5],
    placements: [
      {
        id: boardPlacementId('p1'),
        position: { x: 5, y: 5 },
        native: {
          provider: providerId('test'),
          productId: source('1'),
          layoutId: source('2'),
          productSizeId: source('3'),
          setId: source('4'),
          placementId: source('5'),
          holeId: source('6'),
          ledPosition: 0,
        },
      },
    ],
    rolePresets: Object.fromEntries(
      ['start', 'middle', 'finish', 'foot-only'].map((role, index) => [
        role,
        {
          role,
          label: role,
          sourceRoleId: source(String(index)),
          lightColor: apiLevel3Color(index),
          screenColor: '#000000',
        },
      ]),
    ) as unknown as BoardDefinition['rolePresets'],
  };
}

describe('board definition validation', () => {
  it('accepts a structural definition without climb-composition rules', () =>
    expect(validateBoardDefinition(valid())).toEqual([]));

  it.each<[DefinitionValidationCode, (definition: BoardDefinition) => void]>([
    [
      'invalid-bounds',
      (d) => {
        (d.bounds as { right: number }).right = 0;
      },
    ],
    [
      'invalid-coordinate',
      (d) => {
        (d.placements[0].position as { x: number }).x = 20;
      },
    ],
    [
      'invalid-angle',
      (d) => {
        (d.supportedAngles as number[])[0] = 1.5;
      },
    ],
    [
      'duplicate-angle',
      (d) => {
        (d.supportedAngles as number[])[1] = 0;
      },
    ],
    [
      'duplicate-domain-placement-id',
      (d) => {
        (d.placements as BoardDefinition['placements'] as unknown as object[]).push({
          ...d.placements[0],
        });
      },
    ],
    [
      'duplicate-placement-id',
      (d) => {
        (d.placements as unknown as object[]).push({
          ...d.placements[0],
          id: boardPlacementId('p2'),
          native: { ...d.placements[0].native, holeId: providerSourceId('7'), ledPosition: 1 },
        });
      },
    ],
    [
      'duplicate-hole-id',
      (d) => {
        (d.placements as unknown as object[]).push({
          ...d.placements[0],
          id: boardPlacementId('p2'),
          native: { ...d.placements[0].native, placementId: providerSourceId('7'), ledPosition: 1 },
        });
      },
    ],
    [
      'duplicate-led-position',
      (d) => {
        (d.placements as unknown as object[]).push({
          ...d.placements[0],
          id: boardPlacementId('p2'),
          native: {
            ...d.placements[0].native,
            placementId: providerSourceId('7'),
            holeId: providerSourceId('8'),
          },
        });
      },
    ],
    [
      'native-scope-mismatch',
      (d) => {
        (d.placements as unknown as object[]).push({
          ...d.placements[0],
          id: boardPlacementId('p2'),
          native: {
            ...d.placements[0].native,
            productId: providerSourceId('99'),
            placementId: providerSourceId('7'),
            holeId: providerSourceId('8'),
            ledPosition: 1,
          },
        });
      },
    ],
    [
      'missing-role',
      (d) => {
        delete (d.rolePresets as unknown as Record<string, unknown>).start;
      },
    ],
    [
      'unknown-source-role',
      (d) => {
        (d.rolePresets.start as { role: string }).role = 'middle';
      },
    ],
    [
      'duplicate-source-role',
      (d) => {
        (d.rolePresets.middle as { sourceRoleId: string }).sourceRoleId =
          d.rolePresets.start.sourceRoleId;
      },
    ],
  ])('reports %s', (code, mutate) => {
    const definition = valid();
    mutate(definition);
    expect(validateBoardDefinition(definition).map((issue) => issue.code)).toContain(code);
  });
});

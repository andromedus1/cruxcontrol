import type {
  BoardDefinition,
  ClimbRole,
  DefinitionValidationCode,
  DefinitionValidationIssue,
} from './definition';

const roles: readonly ClimbRole[] = ['start', 'middle', 'finish', 'foot-only'];

export function validateBoardDefinition(
  definition: BoardDefinition,
): readonly DefinitionValidationIssue[] {
  const issues: DefinitionValidationIssue[] = [];
  const add = (path: string, code: DefinitionValidationCode, message: string) =>
    issues.push({ path, code, message });
  const { left, right, bottom, top } = definition.bounds;
  if (![left, right, bottom, top].every(Number.isFinite) || left >= right || bottom >= top)
    add('bounds', 'invalid-bounds', 'Bounds must be finite and non-degenerate');

  const angles = new Set<number>();
  definition.supportedAngles.forEach((angle, index) => {
    if (!Number.isInteger(angle) || angle < 0 || angle > 90)
      add(`supportedAngles[${index}]`, 'invalid-angle', 'Angle must be an integer from 0 to 90');
    if (angles.has(angle))
      add(`supportedAngles[${index}]`, 'duplicate-angle', `Duplicate angle ${angle}`);
    angles.add(angle);
  });

  const domainIds = new Set<string>();
  const placements = new Set<string>();
  const holes = new Set<string>();
  const leds = new Set<number>();
  const scope = definition.placements[0]?.native;
  definition.placements.forEach((placement, index) => {
    const path = `placements[${index}]`;
    if (
      !Number.isFinite(placement.position.x) ||
      !Number.isFinite(placement.position.y) ||
      placement.position.x < left ||
      placement.position.x > right ||
      placement.position.y < bottom ||
      placement.position.y > top
    )
      add(`${path}.position`, 'invalid-coordinate', 'Coordinate must be finite and inside bounds');
    const unique = (
      set: Set<string>,
      value: string,
      code: DefinitionValidationCode,
      field: string,
    ) => {
      if (set.has(value)) add(`${path}.${field}`, code, `Duplicate ${field} ${value}`);
      set.add(value);
    };
    unique(domainIds, placement.id, 'duplicate-domain-placement-id', 'id');
    unique(
      placements,
      placement.native.placementId,
      'duplicate-placement-id',
      'native.placementId',
    );
    unique(holes, placement.native.holeId, 'duplicate-hole-id', 'native.holeId');
    if (
      !Number.isInteger(placement.native.ledPosition) ||
      placement.native.ledPosition < 0 ||
      leds.has(placement.native.ledPosition)
    )
      add(
        `${path}.native.ledPosition`,
        'duplicate-led-position',
        'LED position must be a unique non-negative integer',
      );
    leds.add(placement.native.ledPosition);
    if (
      scope &&
      ['provider', 'productId', 'layoutId', 'productSizeId'].some(
        (key) =>
          placement.native[key as keyof typeof placement.native] !==
          scope[key as keyof typeof scope],
      )
    )
      add(
        `${path}.native`,
        'native-scope-mismatch',
        'Native placement scope differs from the definition scope',
      );
  });

  const sourceRoles = new Set<string>();
  roles.forEach((role) => {
    const preset = definition.rolePresets[role];
    if (!preset) {
      add(`rolePresets.${role}`, 'missing-role', `Missing ${role} role`);
      return;
    }
    if (preset.role !== role)
      add(`rolePresets.${role}.role`, 'unknown-source-role', `Role preset reports ${preset.role}`);
    if (sourceRoles.has(preset.sourceRoleId))
      add(
        `rolePresets.${role}.sourceRoleId`,
        'duplicate-source-role',
        `Duplicate source role ${preset.sourceRoleId}`,
      );
    sourceRoles.add(preset.sourceRoleId);
  });
  return Object.freeze(issues);
}

export function assertBoardDefinition(
  definition: BoardDefinition,
): asserts definition is BoardDefinition {
  const issues = validateBoardDefinition(definition);
  if (issues.length)
    throw new TypeError(
      `Invalid board definition: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`,
    );
}

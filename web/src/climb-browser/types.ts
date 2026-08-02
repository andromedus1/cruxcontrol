import type { BoardHoldAssignment } from '../board-renderer/types';
import { providerClimbKey } from '../domain/boards/identity';
import type { Brand, ProviderClimbId } from '../domain/boards/types';

export type ClimbViewKey = Brand<string, 'ClimbViewKey'>;

export function climbViewKey(value: string): ClimbViewKey {
  if (value.trim().length === 0) throw new TypeError('Climb view key must not be empty');
  return value as ClimbViewKey;
}

export function providerClimbViewKey(id: ProviderClimbId): ClimbViewKey {
  return climbViewKey(`provider:${providerClimbKey(id)}`);
}

export interface ClimbViewRecord {
  readonly key: ClimbViewKey;
  readonly name: string;
  readonly angle: number;
  readonly assignments: readonly BoardHoldAssignment[];
  readonly origin: 'local-draft' | 'provider';
  readonly grade?: string;
  readonly setter?: string;
  readonly description?: string;
}

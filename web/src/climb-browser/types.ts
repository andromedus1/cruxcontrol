import type { BoardHoldAssignment } from '../board-renderer/types';
import type { Brand } from '../domain/boards/types';

export type ClimbViewKey = Brand<string, 'ClimbViewKey'>;

export function climbViewKey(value: string): ClimbViewKey {
  if (value.trim().length === 0) throw new TypeError('Climb view key must not be empty');
  return value as ClimbViewKey;
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

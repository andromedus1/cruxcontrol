import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10.ts';
import { boardInstallationId } from '../installations/contracts.ts';
import type { DraftContent } from './types.ts';

export const FIRST_DRAFT_ID = '11111111-1111-4111-8111-111111111111';
export const SECOND_DRAFT_ID = '22222222-2222-4222-8222-222222222222';
export const TEST_INSTALLATION_ID = boardInstallationId('test-fullride');

export function draftContent(overrides: Partial<DraftContent> = {}): DraftContent {
  return {
    status: 'draft',
    installationId: TEST_INSTALLATION_ID,
    definitionId: kilterFullride7x10Definition.id,
    layoutRevision: kilterFullride7x10Definition.layoutRevision,
    name: '',
    angle: 40,
    assignments: [],
    effectGroups: [],
    metadata: {},
    ...overrides,
  };
}

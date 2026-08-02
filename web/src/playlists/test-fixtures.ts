import { localDraftId } from '../drafts/codec.ts';
import { layoutRevisionId, providerId, providerSourceId } from '../domain/boards/identity.ts';
import type { PlaylistContent } from './types.ts';

export const FIRST_PLAYLIST_ID = '00000000-0000-4000-8000-000000000011';
export const SECOND_PLAYLIST_ID = '00000000-0000-4000-8000-000000000012';
export const LOCAL_CLIMB_ID = localDraftId('00000000-0000-4000-8000-000000000021');

export function playlistContent(overrides: Partial<PlaylistContent> = {}): PlaylistContent {
  return {
    name: 'Project climbs',
    notes: '',
    entries: Object.freeze([]),
    ...overrides,
  };
}

export const providerReference = Object.freeze({
  kind: 'provider' as const,
  id: Object.freeze({
    provider: providerId('kilter'),
    sourceId: providerSourceId('12345'),
    layoutRevision: layoutRevisionId('kilter-fullride-7x10-v1'),
  }),
});

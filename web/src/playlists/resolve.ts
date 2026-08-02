import { providerClimbViewKey, type ClimbViewRecord } from '../climb-browser/types.ts';
import type { LocalClimbDraft } from '../drafts/types.ts';
import { toClimbViewRecord } from '../drafts/to-climb-view-record.ts';
import { playlistReferenceKey } from './codec.ts';
import type { LocalPlaylist, PlaylistClimbReference } from './types.ts';

export interface ResolvedPlaylistEntry {
  readonly reference: PlaylistClimbReference;
  readonly key: string;
  readonly climb: ClimbViewRecord | null;
  readonly availability: 'available' | 'trashed' | 'missing';
}

export function resolvePlaylistEntries(
  playlist: LocalPlaylist,
  localClimbs: readonly LocalClimbDraft[],
  providerClimbs: readonly ClimbViewRecord[] = [],
): readonly ResolvedPlaylistEntry[] {
  const localById = new Map(localClimbs.map((climb) => [climb.id, climb]));
  const providerByKey = new Map(providerClimbs.map((climb) => [climb.key, climb]));
  return Object.freeze(
    playlist.entries.map((reference) => {
      const key = playlistReferenceKey(reference);
      if (reference.kind === 'local') {
        const local = localById.get(reference.id);
        return Object.freeze({
          reference,
          key,
          climb: local ? toClimbViewRecord(local) : null,
          availability: local
            ? local.trashedAt === undefined
              ? 'available'
              : 'trashed'
            : 'missing',
        });
      }
      const climb = providerByKey.get(providerClimbViewKey(reference.id)) ?? null;
      return Object.freeze({
        reference,
        key,
        climb,
        availability: climb ? 'available' : 'missing',
      });
    }),
  );
}

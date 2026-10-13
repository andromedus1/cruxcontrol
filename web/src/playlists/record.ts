import { decodeStoredPlaylist } from './codec.ts';
import {
  LOCAL_PLAYLIST_SCHEMA_VERSION,
  type LocalPlaylist,
  type PlaylistContent,
  type PlaylistId,
  type PlaylistRevision,
} from './types.ts';

export function playlistFrom(
  content: PlaylistContent,
  identity: Readonly<{
    id: PlaylistId;
    revision: PlaylistRevision;
    createdAt: string;
    updatedAt: string;
  }>,
): LocalPlaylist {
  return decodeStoredPlaylist({
    schemaVersion: LOCAL_PLAYLIST_SCHEMA_VERSION,
    id: identity.id,
    revision: identity.revision,
    name: content.name,
    notes: content.notes,
    entries: content.entries,
    createdAt: identity.createdAt,
    updatedAt: identity.updatedAt,
    updatedOrder: [identity.updatedAt, identity.id],
  });
}

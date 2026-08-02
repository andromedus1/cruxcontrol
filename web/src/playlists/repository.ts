import type { LocalPlaylist, PlaylistContent, PlaylistId, PlaylistRevision } from './types.ts';

export interface LocalPlaylistRepository {
  create(content: PlaylistContent): Promise<LocalPlaylist>;
  get(id: PlaylistId): Promise<LocalPlaylist | null>;
  list(): Promise<readonly LocalPlaylist[]>;
  update(
    id: PlaylistId,
    expectedRevision: PlaylistRevision,
    content: PlaylistContent,
  ): Promise<LocalPlaylist>;
  delete(id: PlaylistId, expectedRevision: PlaylistRevision): Promise<void>;
}

export interface PlaylistRepositoryOptions {
  readonly now?: () => Date;
  readonly createId?: () => string;
}

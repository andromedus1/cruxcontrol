import type { LocalClimbDraft, LocalDraftId } from '../drafts/types.ts';
import {
  decodePortablePlaylist,
  encodePlaylistFragment,
  encodePortablePlaylist,
} from './portable-codec.ts';
import {
  PORTABLE_PLAYLIST_FORMAT,
  PORTABLE_PLAYLIST_SCHEMA_VERSION,
  type PortablePlaylistEntryV1,
  type PortablePlaylistV1,
} from './portable-types.ts';
import type { LocalPlaylist } from './types.ts';

export const MAX_PLAYLIST_SHARE_URL_LENGTH = 1_800;
export const PORTABLE_PLAYLIST_FILE_EXTENSION = '.cruxplaylist.json';
export const PORTABLE_PLAYLIST_FILE_TYPE = 'application/json;charset=utf-8';

export class PortablePlaylistExportError extends Error {
  readonly code = 'missing-local-climb';
  readonly path: string;
  readonly entryIndex: number;
  readonly localDraftId: LocalDraftId;

  constructor(entryIndex: number, localDraftId: LocalDraftId) {
    const path = `playlist.entries[${entryIndex}]`;
    super(`Cannot export ${path}: local climb ${localDraftId} is unavailable`);
    this.name = 'PortablePlaylistExportError';
    this.path = path;
    this.entryIndex = entryIndex;
    this.localDraftId = localDraftId;
  }
}

export function createPortablePlaylist(
  playlist: LocalPlaylist,
  localClimbs: readonly LocalClimbDraft[],
  now: () => Date = () => new Date(),
): PortablePlaylistV1 {
  const climbsById = new Map(localClimbs.map((climb) => [climb.id, climb]));
  const entries = playlist.entries.map<PortablePlaylistEntryV1>((entry, index) => {
    if (entry.kind === 'provider') return { kind: 'provider', id: entry.id };
    const climb = climbsById.get(entry.id);
    if (!climb) throw new PortablePlaylistExportError(index, entry.id);
    return {
      kind: 'local-snapshot',
      snapshot: {
        status: climb.status,
        definitionId: climb.definitionId,
        layoutRevision: climb.layoutRevision,
        name: climb.name,
        angle: climb.angle,
        assignments: climb.assignments,
        effectGroups: climb.effectGroups,
        metadata: climb.metadata,
      },
    };
  });
  return decodePortablePlaylist({
    format: PORTABLE_PLAYLIST_FORMAT,
    schemaVersion: PORTABLE_PLAYLIST_SCHEMA_VERSION,
    exportedAt: now().toISOString(),
    playlist: {
      name: playlist.name,
      notes: playlist.notes,
      entries,
    },
  });
}

export function playlistShareUrl(base: URL, value: PortablePlaylistV1): URL | null {
  const result = new URL(base);
  result.search = '';
  result.hash = encodePlaylistFragment(value);
  return result.href.length <= MAX_PLAYLIST_SHARE_URL_LENGTH ? result : null;
}

function safeFileStem(name: string): string {
  const withoutControls = Array.from(name, (character) =>
    character.charCodeAt(0) < 32 ? '-' : character,
  ).join('');
  const stem = withoutControls
    .replace(/[<>:"/\\|?*]+/gu, '-')
    .replace(/\s+/gu, ' ')
    .replace(/^[ .]+|[ .]+$/gu, '')
    .slice(0, 120);
  return stem || 'playlist';
}

export function playlistFile(value: PortablePlaylistV1): File {
  const json = encodePortablePlaylist(value);
  return new File(
    [json],
    `${safeFileStem(value.playlist.name)}${PORTABLE_PLAYLIST_FILE_EXTENSION}`,
    {
      type: PORTABLE_PLAYLIST_FILE_TYPE,
    },
  );
}

import { localDraftId } from '../drafts/codec.ts';
import {
  layoutRevisionId,
  providerClimbKey,
  providerId,
  providerSourceId,
} from '../domain/boards/identity.ts';
import { PlaylistCorruptRecordError, PlaylistSchemaError } from './errors.ts';
import {
  LOCAL_PLAYLIST_SCHEMA_VERSION,
  type LocalPlaylist,
  type PlaylistClimbReference,
  type PlaylistId,
  type PlaylistRevision,
  type StoredPlaylistV1,
} from './types.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function playlistId(value: string): PlaylistId {
  if (!UUID.test(value)) throw new TypeError('Playlist ID must be a canonical UUID');
  return value as PlaylistId;
}

export function playlistRevision(value: number): PlaylistRevision {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError('Playlist revision must be a positive safe integer');
  }
  return value as PlaylistRevision;
}

export function playlistReferenceKey(reference: PlaylistClimbReference): string {
  return reference.kind === 'local'
    ? `local:${reference.id}`
    : `provider:${providerClimbKey(reference.id)}`;
}

function corrupt(path: string, message: string, source: unknown, cause?: unknown) {
  const raw =
    typeof source === 'object' && source !== null ? (source as Record<string, unknown>) : null;
  return new PlaylistCorruptRecordError(path, message, {
    id: typeof raw?.id === 'string' ? raw.id : undefined,
    cause,
    record: source,
  });
}

function record(value: unknown, path: string, source: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw corrupt(path, 'expected an object', source);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string, source: unknown): string {
  if (typeof value !== 'string') throw corrupt(path, 'expected a string', source);
  return value;
}

function identifier<T>(
  factory: (value: string) => T,
  value: unknown,
  path: string,
  source: unknown,
): T {
  try {
    return factory(string(value, path, source));
  } catch (cause) {
    throw corrupt(path, 'invalid identifier', source, cause);
  }
}

function timestamp(value: unknown, path: string, source: unknown): string {
  const result = string(value, path, source);
  const date = new Date(result);
  if (!Number.isFinite(date.valueOf()) || date.toISOString() !== result) {
    throw corrupt(path, 'expected a canonical ISO timestamp', source);
  }
  return result;
}

function decodeReference(value: unknown, path: string, source: unknown): PlaylistClimbReference {
  const raw = record(value, path, source);
  if (raw.kind === 'local') {
    return Object.freeze({
      kind: 'local',
      id: identifier(localDraftId, raw.id, `${path}.id`, source),
    });
  }
  if (raw.kind === 'provider') {
    const id = record(raw.id, `${path}.id`, source);
    return Object.freeze({
      kind: 'provider',
      id: Object.freeze({
        provider: identifier(providerId, id.provider, `${path}.id.provider`, source),
        sourceId: identifier(providerSourceId, id.sourceId, `${path}.id.sourceId`, source),
        layoutRevision: identifier(
          layoutRevisionId,
          id.layoutRevision,
          `${path}.id.layoutRevision`,
          source,
        ),
      }),
    });
  }
  throw corrupt(`${path}.kind`, 'expected local or provider', source);
}

export function encodeStoredPlaylist(playlist: LocalPlaylist): StoredPlaylistV1 {
  return {
    schemaVersion: LOCAL_PLAYLIST_SCHEMA_VERSION,
    id: playlist.id,
    revision: playlist.revision,
    name: playlist.name,
    notes: playlist.notes,
    entries: playlist.entries.map((reference) =>
      reference.kind === 'local'
        ? { kind: 'local', id: reference.id }
        : {
            kind: 'provider',
            id: {
              provider: reference.id.provider,
              sourceId: reference.id.sourceId,
              layoutRevision: reference.id.layoutRevision,
            },
          },
    ),
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt,
    updatedOrder: [playlist.updatedAt, playlist.id],
  };
}

export function decodeStoredPlaylist(value: unknown): LocalPlaylist {
  const raw = record(value, '$', value);
  if (raw.schemaVersion !== LOCAL_PLAYLIST_SCHEMA_VERSION) {
    throw new PlaylistSchemaError(
      raw.schemaVersion,
      typeof raw.id === 'string' ? raw.id : undefined,
    );
  }
  const id = identifier(playlistId, raw.id, 'id', value);
  let revision: PlaylistRevision;
  try {
    revision = playlistRevision(raw.revision as number);
  } catch (cause) {
    throw corrupt('revision', 'expected a positive safe integer', value, cause);
  }
  const name = string(raw.name, 'name', value);
  if (name.length === 0 || name !== name.trim()) {
    throw corrupt('name', 'expected a non-empty trimmed name', value);
  }
  const notes = string(raw.notes, 'notes', value);
  if (!Array.isArray(raw.entries)) throw corrupt('entries', 'expected an array', value);
  const seen = new Set<string>();
  const entries = Object.freeze(
    raw.entries.map((entry, index) => {
      const reference = decodeReference(entry, `entries[${index}]`, value);
      const key = playlistReferenceKey(reference);
      if (seen.has(key)) throw corrupt(`entries[${index}]`, 'duplicate climb reference', value);
      seen.add(key);
      return reference;
    }),
  );
  const createdAt = timestamp(raw.createdAt, 'createdAt', value);
  const updatedAt = timestamp(raw.updatedAt, 'updatedAt', value);
  if (
    !Array.isArray(raw.updatedOrder) ||
    raw.updatedOrder.length !== 2 ||
    raw.updatedOrder[0] !== updatedAt ||
    raw.updatedOrder[1] !== id
  ) {
    throw corrupt('updatedOrder', 'must equal [updatedAt, id]', value);
  }
  return Object.freeze({
    schemaVersion: LOCAL_PLAYLIST_SCHEMA_VERSION,
    id,
    revision,
    name,
    notes,
    entries,
    createdAt,
    updatedAt,
  });
}

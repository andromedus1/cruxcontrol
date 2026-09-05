import { decodeStoredDraft, encodeStoredDraft } from '../drafts/codec.ts';
import { DraftSchemaError } from '../drafts/errors.ts';
import { decodeStoredPlaylist, encodeStoredPlaylist } from '../playlists/codec.ts';
import { PlaylistSchemaError } from '../playlists/errors.ts';
import type { LocalClimbDraft, StoredDraftV4 } from '../drafts/types.ts';
import type { LocalPlaylist, StoredPlaylistV1 } from '../playlists/types.ts';
import type {
  BackupConflict,
  BackupReview,
  DecodedLibraryBackup,
  LibraryBackupV1,
  LibrarySnapshot,
} from './types.ts';

export const LIBRARY_BACKUP_FORMAT = 'cruxcontrol-library-backup' as const;
export const LIBRARY_BACKUP_VERSION = 1 as const;
export const LIBRARY_BACKUP_LIMITS = Object.freeze({
  bytes: 25 * 1024 * 1024,
  climbs: 10_000,
  playlists: 1_000,
  references: 100_000,
});

export type LibraryBackupErrorCode = 'invalid-payload' | 'unsupported-version' | 'oversized-payload';

export class LibraryBackupValidationError extends Error {
  readonly code: LibraryBackupErrorCode;
  readonly path: string;
  override readonly cause?: unknown;

  constructor(
    code: LibraryBackupErrorCode,
    path: string,
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(`Invalid library backup at ${path}: ${message}`, options);
    this.name = 'LibraryBackupValidationError';
    this.code = code;
    this.path = path;
    this.cause = options?.cause;
  }
}

function fail(code: LibraryBackupErrorCode, path: string, message: string, cause?: unknown): never {
  throw new LibraryBackupValidationError(code, path, message, { cause });
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail('invalid-payload', path, 'expected an object');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail('invalid-payload', path, 'expected a plain object');
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const keys = new Set(allowed);
  for (const key of Object.keys(value)) if (!keys.has(key)) fail('invalid-payload', `${path}.${key}`, 'unknown field');
}

function timestamp(value: unknown, path: string): string {
  if (typeof value !== 'string') fail('invalid-payload', path, 'expected a string');
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf()) || date.toISOString() !== value) fail('invalid-payload', path, 'expected a canonical ISO timestamp');
  return value;
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function checkBounds(drafts: readonly unknown[], playlists: readonly unknown[], text?: string): void {
  if (drafts.length > LIBRARY_BACKUP_LIMITS.climbs) fail('oversized-payload', 'drafts', `must contain at most ${LIBRARY_BACKUP_LIMITS.climbs} climbs`);
  if (playlists.length > LIBRARY_BACKUP_LIMITS.playlists) fail('oversized-payload', 'playlists', `must contain at most ${LIBRARY_BACKUP_LIMITS.playlists} playlists`);
  const references = playlists.reduce<number>((count, playlist) => {
    const raw = object(playlist, 'playlists');
    return count + (Array.isArray(raw.entries) ? raw.entries.length : 0);
  }, 0);
  if (references > LIBRARY_BACKUP_LIMITS.references) fail('oversized-payload', 'playlists', `must contain at most ${LIBRARY_BACKUP_LIMITS.references} references`);
  if (text !== undefined && utf8Bytes(text) > LIBRARY_BACKUP_LIMITS.bytes) fail('oversized-payload', '$', `must be at most ${LIBRARY_BACKUP_LIMITS.bytes} UTF-8 bytes`);
}

function duplicateIds(records: readonly { readonly id: string }[], path: string): void {
  const seen = new Set<string>();
  records.forEach((record, index) => {
    if (typeof record.id !== 'string') fail('invalid-payload', `${path}[${index}].id`, 'expected an ID');
    if (seen.has(record.id)) fail('invalid-payload', `${path}[${index}].id`, 'duplicate ID');
    seen.add(record.id);
  });
}

function storedDraft(record: unknown, index: number): StoredDraftV4 {
  try {
    // Decoding normalizes supported v1-v4 source records; the backup always emits v4.
    const source = object(record, `drafts[${index}]`);
    const stored = 'updatedOrder' in source ? source : encodeStoredDraft(record as LocalClimbDraft);
    return encodeStoredDraft(decodeStoredDraft(stored));
  } catch (cause) {
    fail(cause instanceof DraftSchemaError ? 'unsupported-version' : 'invalid-payload', `drafts[${index}]`, cause instanceof Error ? cause.message : 'invalid climb record', cause);
  }
}

function storedPlaylist(record: unknown, index: number): StoredPlaylistV1 {
  try {
    const source = object(record, `playlists[${index}]`);
    const stored = 'updatedOrder' in source ? source : encodeStoredPlaylist(record as LocalPlaylist);
    return encodeStoredPlaylist(decodeStoredPlaylist(stored));
  } catch (cause) {
    fail(cause instanceof PlaylistSchemaError ? 'unsupported-version' : 'invalid-payload', `playlists[${index}]`, cause instanceof Error ? cause.message : 'invalid playlist record', cause);
  }
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

export function canonicalDraft(draft: LibrarySnapshot['drafts'][number]): string {
  return canonical(encodeStoredDraft(draft));
}

export function canonicalPlaylist(playlist: LibrarySnapshot['playlists'][number]): string {
  return canonical(encodeStoredPlaylist(playlist));
}

export function canonicalSnapshot(snapshot: LibrarySnapshot): string {
  return JSON.stringify({
    drafts: [...snapshot.drafts].sort((a, b) => a.id.localeCompare(b.id)).map(canonicalDraft),
    playlists: [...snapshot.playlists].sort((a, b) => a.id.localeCompare(b.id)).map(canonicalPlaylist),
  });
}

export function encodeLibraryBackup(snapshot: LibrarySnapshot, exportedAt: Date): string {
  if (!(exportedAt instanceof Date) || !Number.isFinite(exportedAt.valueOf())) fail('invalid-payload', 'exportedAt', 'expected a valid date');
  const drafts = snapshot.drafts.map((draft, index) => storedDraft(draft, index));
  const playlists = snapshot.playlists.map((playlist, index) => storedPlaylist(playlist, index));
  duplicateIds(drafts, 'drafts');
  duplicateIds(playlists, 'playlists');
  checkBounds(drafts, playlists);
  const payload: LibraryBackupV1 = {
    format: LIBRARY_BACKUP_FORMAT,
    version: LIBRARY_BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    drafts,
    playlists,
  };
  const text = JSON.stringify(payload);
  checkBounds(drafts, playlists, text);
  return text;
}

export function decodeLibraryBackup(text: string): DecodedLibraryBackup {
  if (typeof text !== 'string') fail('invalid-payload', '$', 'expected text');
  if (utf8Bytes(text) > LIBRARY_BACKUP_LIMITS.bytes) fail('oversized-payload', '$', `must be at most ${LIBRARY_BACKUP_LIMITS.bytes} UTF-8 bytes`);
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (cause) {
    fail('invalid-payload', '$', 'expected valid JSON', cause);
  }
  const raw = object(value, '$');
  exactKeys(raw, ['format', 'version', 'exportedAt', 'drafts', 'playlists'], '$');
  if (raw.format !== LIBRARY_BACKUP_FORMAT) fail('invalid-payload', 'format', `expected ${LIBRARY_BACKUP_FORMAT}`);
  if (raw.version !== LIBRARY_BACKUP_VERSION) fail('unsupported-version', 'version', `unsupported backup version ${String(raw.version)}`);
  const exportedAt = timestamp(raw.exportedAt, 'exportedAt');
  if (!Array.isArray(raw.drafts)) fail('invalid-payload', 'drafts', 'expected an array');
  if (!Array.isArray(raw.playlists)) fail('invalid-payload', 'playlists', 'expected an array');
  checkBounds(raw.drafts, raw.playlists);
  const drafts = raw.drafts.map((record, index) => storedDraft(record, index));
  const playlists = raw.playlists.map((record, index) => storedPlaylist(record, index));
  duplicateIds(drafts, 'drafts');
  duplicateIds(playlists, 'playlists');
  return Object.freeze({
    exportedAt,
    drafts: Object.freeze(drafts.map((record) => decodeStoredDraft(record))),
    playlists: Object.freeze(playlists.map((record) => decodeStoredPlaylist(record))),
  });
}

function indexById<T extends { readonly id: string }>(records: readonly T[]): Map<string, T> {
  return new Map(records.map((record) => [record.id, record]));
}

export function reviewLibraryBackup(backup: DecodedLibraryBackup, current: LibrarySnapshot): BackupReview {
  const currentDrafts = indexById(current.drafts);
  const currentPlaylists = indexById(current.playlists);
  const conflicts: BackupConflict[] = [];
  let unchangedClimbs = 0;
  let unchangedPlaylists = 0;
  let addClimbs = 0;
  let addPlaylists = 0;
  for (const draft of backup.drafts) {
    const existing = currentDrafts.get(draft.id);
    if (!existing) addClimbs += 1;
    else if (canonicalDraft(existing) === canonicalDraft(draft)) unchangedClimbs += 1;
    else conflicts.push({ kind: 'climb', id: draft.id, name: draft.name });
  }
  for (const playlist of backup.playlists) {
    const existing = currentPlaylists.get(playlist.id);
    if (!existing) addPlaylists += 1;
    else if (canonicalPlaylist(existing) === canonicalPlaylist(playlist)) unchangedPlaylists += 1;
    else conflicts.push({ kind: 'playlist', id: playlist.id, name: playlist.name });
  }
  const knownLocalIds = new Set([...currentDrafts.keys(), ...backup.drafts.map(({ id }) => id)]);
  const unavailableLocalReferences = backup.playlists.reduce(
    (count, playlist) => count + playlist.entries.filter((entry) => entry.kind === 'local' && !knownLocalIds.has(entry.id)).length,
    0,
  );
  return Object.freeze({
    add: Object.freeze({ climbs: addClimbs, playlists: addPlaylists }),
    unchanged: Object.freeze({ climbs: unchangedClimbs, playlists: unchangedPlaylists }),
    conflicts: Object.freeze(conflicts),
    trashClimbs: backup.drafts.filter(({ trashedAt }) => trashedAt !== undefined).length,
    unavailableLocalReferences,
  });
}

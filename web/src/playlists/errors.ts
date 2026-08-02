import type { PlaylistId, PlaylistRevision } from './types.ts';

export type PlaylistErrorCode =
  | 'unavailable'
  | 'quota-exceeded'
  | 'not-found'
  | 'conflict'
  | 'schema-unsupported'
  | 'corrupt-record';

export class PlaylistRepositoryError extends Error {
  readonly code: PlaylistErrorCode;
  override readonly cause?: unknown;

  constructor(code: PlaylistErrorCode, message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = 'PlaylistRepositoryError';
    this.code = code;
    this.cause = options?.cause;
  }
}

export class PlaylistNotFoundError extends PlaylistRepositoryError {
  readonly id: PlaylistId;

  constructor(id: PlaylistId) {
    super('not-found', `Local playlist ${id} was not found`);
    this.name = 'PlaylistNotFoundError';
    this.id = id;
  }
}

export class PlaylistConflictError extends PlaylistRepositoryError {
  readonly id: PlaylistId;
  readonly expectedRevision: PlaylistRevision;
  readonly actualRevision: PlaylistRevision;

  constructor(
    id: PlaylistId,
    expectedRevision: PlaylistRevision,
    actualRevision: PlaylistRevision,
  ) {
    super(
      'conflict',
      `Local playlist ${id} changed (expected revision ${expectedRevision}, actual ${actualRevision})`,
    );
    this.name = 'PlaylistConflictError';
    this.id = id;
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

export class PlaylistSchemaError extends PlaylistRepositoryError {
  readonly id?: string;
  readonly schemaVersion: unknown;

  constructor(schemaVersion: unknown, id?: string) {
    super(
      'schema-unsupported',
      `Unsupported local playlist schema version ${String(schemaVersion)}`,
    );
    this.name = 'PlaylistSchemaError';
    this.schemaVersion = schemaVersion;
    this.id = id;
  }
}

export class PlaylistCorruptRecordError extends PlaylistRepositoryError {
  readonly id?: string;
  readonly path: string;
  readonly record: unknown;

  constructor(
    path: string,
    message: string,
    options?: { readonly id?: string; readonly cause?: unknown; readonly record?: unknown },
  ) {
    super('corrupt-record', `Corrupt local playlist at ${path}: ${message}`, {
      cause: options?.cause,
    });
    this.name = 'PlaylistCorruptRecordError';
    this.path = path;
    this.id = options?.id;
    this.record = options?.record;
  }
}

export function translatePlaylistStorageError(
  error: unknown,
  message: string,
): PlaylistRepositoryError {
  if (error instanceof PlaylistRepositoryError) return error;
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'QuotaExceededError') {
    return new PlaylistRepositoryError('quota-exceeded', message, { cause: error });
  }
  return new PlaylistRepositoryError('unavailable', message, { cause: error });
}

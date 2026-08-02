import type { DraftRevision, LocalDraftId } from './types.ts';

export type DraftErrorCode =
  | 'unavailable'
  | 'quota-exceeded'
  | 'not-found'
  | 'conflict'
  | 'schema-unsupported'
  | 'corrupt-record';

export class DraftRepositoryError extends Error {
  readonly code: DraftErrorCode;
  override readonly cause?: unknown;

  constructor(code: DraftErrorCode, message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = 'DraftRepositoryError';
    this.code = code;
    this.cause = options?.cause;
  }
}

export class DraftNotFoundError extends DraftRepositoryError {
  readonly id: LocalDraftId;

  constructor(id: LocalDraftId) {
    super('not-found', `Local draft ${id} was not found`);
    this.name = 'DraftNotFoundError';
    this.id = id;
  }
}

export class DraftConflictError extends DraftRepositoryError {
  readonly id: LocalDraftId;
  readonly expectedRevision: DraftRevision;
  readonly actualRevision: DraftRevision;

  constructor(id: LocalDraftId, expectedRevision: DraftRevision, actualRevision: DraftRevision) {
    super(
      'conflict',
      `Local draft ${id} changed (expected revision ${expectedRevision}, actual ${actualRevision})`,
    );
    this.name = 'DraftConflictError';
    this.id = id;
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

export class DraftSchemaError extends DraftRepositoryError {
  readonly id?: string;
  readonly schemaVersion: unknown;

  constructor(schemaVersion: unknown, id?: string) {
    super('schema-unsupported', `Unsupported local draft schema version ${String(schemaVersion)}`);
    this.name = 'DraftSchemaError';
    this.schemaVersion = schemaVersion;
    this.id = id;
  }
}

export class DraftCorruptRecordError extends DraftRepositoryError {
  readonly id?: string;
  readonly path: string;
  readonly record: unknown;

  constructor(
    path: string,
    message: string,
    options?: { readonly id?: string; readonly cause?: unknown; readonly record?: unknown },
  ) {
    super('corrupt-record', `Corrupt local draft at ${path}: ${message}`, {
      cause: options?.cause,
    });
    this.name = 'DraftCorruptRecordError';
    this.path = path;
    this.id = options?.id;
    this.record = options?.record;
  }
}

export function translateDraftStorageError(error: unknown, message: string): DraftRepositoryError {
  if (error instanceof DraftRepositoryError) return error;
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'QuotaExceededError') {
    return new DraftRepositoryError('quota-exceeded', message, { cause: error });
  }
  return new DraftRepositoryError('unavailable', message, { cause: error });
}

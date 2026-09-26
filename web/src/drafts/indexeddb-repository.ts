import { decodeStoredDraft, draftRevision, encodeStoredDraft, localDraftId } from './codec.ts';
import {
  DraftConflictError,
  DraftNotFoundError,
  DraftRepositoryError,
  translateDraftStorageError,
} from './errors.ts';
import { DRAFT_STORE_NAME } from './open-draft-database.ts';
import type {
  DraftListOptions,
  DraftRepositoryOptions,
  LocalDraftRepository,
} from './repository.ts';
import {
  LOCAL_DRAFT_SCHEMA_VERSION,
  type DraftContent,
  type DraftRevision,
  type LocalClimbDraft,
  type LocalDraftId,
} from './types.ts';

function transactionError(transaction: IDBTransaction, message: string): DraftRepositoryError {
  return translateDraftStorageError(transaction.error, message);
}

function requestResult<T>(request: IDBRequest<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(translateDraftStorageError(request.error, message));
  });
}

function freezeContent(
  content: DraftContent,
  identity: {
    id: LocalDraftId;
    revision: DraftRevision;
    createdAt: string;
    updatedAt: string;
    trashedAt?: string;
  },
): LocalClimbDraft {
  return decodeStoredDraft({
    schemaVersion: LOCAL_DRAFT_SCHEMA_VERSION,
    id: identity.id,
    revision: identity.revision,
    status: content.status,
    ...(identity.trashedAt === undefined ? {} : { trashedAt: identity.trashedAt }),
    installationId: content.installationId,
    definitionId: content.definitionId,
    layoutRevision: content.layoutRevision,
    name: content.name,
    angle: content.angle,
    assignments: content.assignments,
    effectGroups: content.effectGroups,
    metadata: content.metadata ?? {},
    createdAt: identity.createdAt,
    updatedAt: identity.updatedAt,
    updatedOrder: [identity.updatedAt, identity.id],
  });
}

function contentOf(draft: LocalClimbDraft): DraftContent {
  return {
    status: draft.status,
    installationId: draft.installationId,
    definitionId: draft.definitionId,
    layoutRevision: draft.layoutRevision,
    name: draft.name,
    angle: draft.angle,
    assignments: draft.assignments,
    effectGroups: draft.effectGroups,
    metadata: draft.metadata,
  };
}

function isInCollection(
  draft: LocalClimbDraft,
  collection: NonNullable<DraftListOptions['collection']>,
): boolean {
  if (collection === 'trash') return draft.trashedAt !== undefined;
  if (draft.trashedAt !== undefined) return false;
  if (collection === 'drafts') return draft.status === 'draft';
  if (collection === 'finished') return draft.status === 'finished';
  return true;
}

function deleteStoredDraft(store: IDBObjectStore, id: LocalDraftId): IDBRequest<undefined> {
  return store.delete(id);
}

export class IndexedDbLocalDraftRepository implements LocalDraftRepository {
  readonly #database: IDBDatabase;
  readonly #now: () => Date;
  readonly #createId: () => string;
  readonly #usesDefaultIdSource: boolean;

  constructor(database: IDBDatabase, options: DraftRepositoryOptions = {}) {
    this.#database = database;
    this.#now = options.now ?? (() => new Date());
    this.#createId = options.createId ?? (() => crypto.randomUUID());
    this.#usesDefaultIdSource = options.createId === undefined;
  }

  async create(content: DraftContent): Promise<LocalClimbDraft> {
    const attempts = this.#usesDefaultIdSource ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const timestamp = this.#now().toISOString();
      const id = localDraftId(this.#createId());
      const draft = freezeContent(content, {
        id,
        revision: draftRevision(1),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      try {
        await this.#add(draft);
        return draft;
      } catch (error) {
        if (!(error instanceof DraftConflictError) || attempt === attempts - 1) throw error;
      }
    }
    throw new DraftRepositoryError('unavailable', 'Could not allocate a local draft ID');
  }

  async #add(draft: LocalClimbDraft): Promise<void> {
    let transaction: IDBTransaction;
    let request: IDBRequest<IDBValidKey>;
    try {
      transaction = this.#database.transaction(DRAFT_STORE_NAME, 'readwrite');
      request = transaction.objectStore(DRAFT_STORE_NAME).add(encodeStoredDraft(draft));
    } catch (cause) {
      throw translateDraftStorageError(cause, 'Could not create local draft');
    }
    return new Promise((resolve, reject) => {
      let collision = false;
      request.onerror = (event) => {
        if (request.error?.name === 'ConstraintError') {
          collision = true;
          event.preventDefault();
        }
      };
      transaction.oncomplete = () =>
        collision
          ? reject(new DraftConflictError(draft.id, draft.revision, draft.revision))
          : resolve();
      transaction.onabort = () => {
        if (collision) reject(new DraftConflictError(draft.id, draft.revision, draft.revision));
        else reject(transactionError(transaction, 'Could not create local draft'));
      };
    });
  }

  async get(id: LocalDraftId): Promise<LocalClimbDraft | null> {
    let request: IDBRequest<unknown>;
    try {
      const transaction = this.#database.transaction(DRAFT_STORE_NAME, 'readonly');
      request = transaction.objectStore(DRAFT_STORE_NAME).get(id);
    } catch (cause) {
      throw translateDraftStorageError(cause, 'Could not read local draft');
    }
    const value = await requestResult(request, 'Could not read local draft');
    return value === undefined ? null : decodeStoredDraft(value);
  }

  async list(options: DraftListOptions = {}): Promise<readonly LocalClimbDraft[]> {
    let request: IDBRequest<IDBCursorWithValue | null>;
    let transaction: IDBTransaction;
    try {
      transaction = this.#database.transaction(DRAFT_STORE_NAME, 'readonly');
      const store = transaction.objectStore(DRAFT_STORE_NAME);
      // Every read must see rows missing the ordering index key: strict consumers
      // must reject incomplete inputs, and recovery consumers must report them.
      request = store.openCursor();
    } catch (cause) {
      throw translateDraftStorageError(cause, 'Could not list local drafts');
    }
    return new Promise((resolve, reject) => {
      const drafts: LocalClimbDraft[] = [];
      transaction.onabort = () => reject(transactionError(transaction, 'Could not list local drafts'));
      transaction.oncomplete = () => {
        drafts.sort((a, b) => {
          if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
          return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
        });
        resolve(Object.freeze(drafts));
      };
      request.onerror = () =>
        reject(translateDraftStorageError(request.error, 'Could not list local drafts'));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        try {
          const draft = decodeStoredDraft(cursor.value);
          if (
            (options.installationId === undefined ||
              draft.installationId === options.installationId) &&
            isInCollection(draft, options.collection ?? 'active')
          )
            drafts.push(draft);
          cursor.continue();
        } catch (error) {
          if (
            options.onUnreadableRecord && error instanceof DraftRepositoryError &&
            (error.code === 'corrupt-record' || error.code === 'schema-unsupported')
          ) {
            try {
              options.onUnreadableRecord({ key: String(cursor.primaryKey), message: error.message });
              cursor.continue();
            } catch (cause) {
              reject(cause);
            }
          } else reject(error);
        }
      };
    });
  }

  update(
    id: LocalDraftId,
    expectedRevision: DraftRevision,
    content: DraftContent,
  ): Promise<LocalClimbDraft> {
    return this.#mutate(id, expectedRevision, 'update local climb', (current, updatedAt) => {
      if (current.trashedAt !== undefined) {
        throw new DraftRepositoryError(
          'conflict',
          `Local climb ${id} is in Trash and cannot be updated`,
        );
      }
      return freezeContent(content, {
        id,
        revision: draftRevision(current.revision + 1),
        createdAt: current.createdAt,
        updatedAt,
        trashedAt: current.trashedAt,
      });
    });
  }

  trash(id: LocalDraftId, expectedRevision: DraftRevision): Promise<LocalClimbDraft> {
    return this.#mutate(id, expectedRevision, 'move local climb to Trash', (current, updatedAt) => {
      if (current.trashedAt !== undefined) {
        throw new DraftRepositoryError('conflict', `Local climb ${id} is already in Trash`);
      }
      return freezeContent(contentOf(current), {
        id,
        revision: draftRevision(current.revision + 1),
        createdAt: current.createdAt,
        updatedAt,
        trashedAt: updatedAt,
      });
    });
  }

  restore(id: LocalDraftId, expectedRevision: DraftRevision): Promise<LocalClimbDraft> {
    return this.#mutate(id, expectedRevision, 'restore local climb', (current, updatedAt) => {
      if (current.trashedAt === undefined) {
        throw new DraftRepositoryError('conflict', `Local climb ${id} is not in Trash`);
      }
      return freezeContent(contentOf(current), {
        id,
        revision: draftRevision(current.revision + 1),
        createdAt: current.createdAt,
        updatedAt,
      });
    });
  }

  #mutate(
    id: LocalDraftId,
    expectedRevision: DraftRevision,
    operation: string,
    change: (current: LocalClimbDraft, updatedAt: string) => LocalClimbDraft,
  ): Promise<LocalClimbDraft> {
    const updatedAt = this.#now().toISOString();
    let transaction: IDBTransaction;
    let store: IDBObjectStore;
    let getRequest: IDBRequest<unknown>;
    try {
      transaction = this.#database.transaction(DRAFT_STORE_NAME, 'readwrite');
      store = transaction.objectStore(DRAFT_STORE_NAME);
      getRequest = store.get(id);
    } catch (cause) {
      return Promise.reject(translateDraftStorageError(cause, `Could not ${operation}`));
    }
    let result: LocalClimbDraft | undefined;
    let semanticError: unknown;
    getRequest.onsuccess = () => {
      try {
        if (getRequest.result === undefined) throw new DraftNotFoundError(id);
        const current = decodeStoredDraft(getRequest.result);
        if (current.revision !== expectedRevision) {
          throw new DraftConflictError(id, expectedRevision, current.revision);
        }
        result = change(current, updatedAt);
        store.put(encodeStoredDraft(result));
      } catch (error) {
        semanticError = error;
        transaction.abort();
      }
    };
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () =>
        result
          ? resolve(result)
          : reject(
              new DraftRepositoryError('unavailable', 'Draft update completed without a result'),
            );
      transaction.onabort = () =>
        reject(semanticError ?? transactionError(transaction, `Could not ${operation}`));
    });
  }

  deletePermanently(id: LocalDraftId, expectedRevision: DraftRevision): Promise<void> {
    let transaction: IDBTransaction;
    let store: IDBObjectStore;
    let getRequest: IDBRequest<unknown>;
    try {
      transaction = this.#database.transaction(DRAFT_STORE_NAME, 'readwrite');
      store = transaction.objectStore(DRAFT_STORE_NAME);
      getRequest = store.get(id);
    } catch (cause) {
      return Promise.reject(
        translateDraftStorageError(cause, 'Could not permanently delete local climb'),
      );
    }
    let semanticError: unknown;
    getRequest.onsuccess = () => {
      try {
        if (getRequest.result === undefined) throw new DraftNotFoundError(id);
        const current = decodeStoredDraft(getRequest.result);
        if (current.revision !== expectedRevision) {
          throw new DraftConflictError(id, expectedRevision, current.revision);
        }
        deleteStoredDraft(store, id);
      } catch (error) {
        semanticError = error;
        transaction.abort();
      }
    };
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () =>
        reject(
          semanticError ??
            transactionError(transaction, 'Could not permanently delete local climb'),
        );
    });
  }

  close(): void {
    this.#database.close();
  }
}

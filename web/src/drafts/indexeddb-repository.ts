import { decodeStoredDraft, draftRevision, encodeStoredDraft, localDraftId } from './codec.ts';
import {
  DraftConflictError,
  DraftNotFoundError,
  DraftRepositoryError,
  translateDraftStorageError,
} from './errors.ts';
import { DRAFT_STORE_NAME, DRAFT_UPDATED_ORDER_INDEX } from './open-draft-database.ts';
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
  identity: { id: LocalDraftId; revision: DraftRevision; createdAt: string; updatedAt: string },
): LocalClimbDraft {
  return decodeStoredDraft({
    schemaVersion: LOCAL_DRAFT_SCHEMA_VERSION,
    id: identity.id,
    revision: identity.revision,
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
    try {
      const transaction = this.#database.transaction(DRAFT_STORE_NAME, 'readonly');
      request = transaction
        .objectStore(DRAFT_STORE_NAME)
        .index(DRAFT_UPDATED_ORDER_INDEX)
        .openCursor(null, 'prev');
    } catch (cause) {
      throw translateDraftStorageError(cause, 'Could not list local drafts');
    }
    return new Promise((resolve, reject) => {
      const drafts: LocalClimbDraft[] = [];
      request.onerror = () =>
        reject(translateDraftStorageError(request.error, 'Could not list local drafts'));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(Object.freeze(drafts));
          return;
        }
        try {
          const draft = decodeStoredDraft(cursor.value);
          if (
            options.installationId === undefined ||
            draft.installationId === options.installationId
          )
            drafts.push(draft);
          cursor.continue();
        } catch (error) {
          reject(error);
        }
      };
    });
  }

  update(
    id: LocalDraftId,
    expectedRevision: DraftRevision,
    content: DraftContent,
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
      return Promise.reject(translateDraftStorageError(cause, 'Could not update local draft'));
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
        result = freezeContent(content, {
          id,
          revision: draftRevision(current.revision + 1),
          createdAt: current.createdAt,
          updatedAt,
        });
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
        reject(semanticError ?? transactionError(transaction, 'Could not update local draft'));
    });
  }

  delete(id: LocalDraftId, expectedRevision: DraftRevision): Promise<void> {
    let transaction: IDBTransaction;
    let store: IDBObjectStore;
    let getRequest: IDBRequest<unknown>;
    try {
      transaction = this.#database.transaction(DRAFT_STORE_NAME, 'readwrite');
      store = transaction.objectStore(DRAFT_STORE_NAME);
      getRequest = store.get(id);
    } catch (cause) {
      return Promise.reject(translateDraftStorageError(cause, 'Could not delete local draft'));
    }
    let semanticError: unknown;
    getRequest.onsuccess = () => {
      try {
        if (getRequest.result === undefined) throw new DraftNotFoundError(id);
        const current = decodeStoredDraft(getRequest.result);
        if (current.revision !== expectedRevision) {
          throw new DraftConflictError(id, expectedRevision, current.revision);
        }
        store.delete(id);
      } catch (error) {
        semanticError = error;
        transaction.abort();
      }
    };
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () =>
        reject(semanticError ?? transactionError(transaction, 'Could not delete local draft'));
    });
  }

  close(): void {
    this.#database.close();
  }
}

import type { AppLibrary } from "../../../web/src/app/library.ts";
import {
  decodeStoredDraft,
  encodeStoredDraft,
  draftRevision,
  localDraftId,
} from "../../../web/src/drafts/codec.ts";
import {
  DraftConflictError,
  DraftCorruptRecordError,
  DraftNotFoundError,
  DraftRepositoryError,
  translateDraftStorageError,
} from "../../../web/src/drafts/errors.ts";
import {
  draftFrom,
  draftContentOf,
  draftInCollection,
} from "../../../web/src/drafts/record.ts";
import type {
  DraftRepositoryOptions,
  LocalDraftRepository,
} from "../../../web/src/drafts/repository.ts";
import type {
  LocalClimbDraft,
  LocalDraftId,
  DraftRevision,
} from "../../../web/src/drafts/types.ts";
import {
  decodeStoredPlaylist,
  encodeStoredPlaylist,
  playlistId,
  playlistRevision,
} from "../../../web/src/playlists/codec.ts";
import {
  PlaylistConflictError,
  PlaylistCorruptRecordError,
  PlaylistNotFoundError,
  translatePlaylistStorageError,
} from "../../../web/src/playlists/errors.ts";
import { playlistFrom } from "../../../web/src/playlists/record.ts";
import type {
  PlaylistRepositoryOptions,
  LocalPlaylistRepository,
} from "../../../web/src/playlists/repository.ts";
import type {
  LocalPlaylist,
  PlaylistId,
  PlaylistRevision,
} from "../../../web/src/playlists/types.ts";
import {
  canonicalDraft,
  canonicalPlaylist,
} from "../../../web/src/library-backup/codec.ts";
import {
  BackupConflictError,
  LibraryBackupStorageError,
  type LibraryBackupStore,
  type RestoreBatchResult,
} from "../../../web/src/library-backup/types.ts";

export interface NativeLibraryDatabase {
  execute(sql: string): Promise<void>;
  run(sql: string, values: readonly unknown[]): Promise<void>;
  query(
    sql: string,
    values?: readonly unknown[],
  ): Promise<readonly Record<string, unknown>[]>;
  close(): Promise<void>;
}

type Table = "climbs" | "playlists";
type SavedRecord = LocalClimbDraft | LocalPlaylist;

function draftRow(row: Record<string, unknown>): LocalClimbDraft {
  let value: unknown;
  try {
    if (typeof row.payload !== "string") throw new Error("expected JSON text");
    value = JSON.parse(row.payload) as unknown;
  } catch (cause) {
    throw new DraftCorruptRecordError("payload", "invalid JSON", { cause });
  }
  const record = decodeStoredDraft(value);
  if (row.id !== record.id)
    throw new DraftCorruptRecordError("id", "key does not match payload ID");
  return record;
}

function playlistRow(row: Record<string, unknown>): LocalPlaylist {
  let value: unknown;
  try {
    if (typeof row.payload !== "string") throw new Error("expected JSON text");
    value = JSON.parse(row.payload) as unknown;
  } catch (cause) {
    throw new PlaylistCorruptRecordError("payload", "invalid JSON", { cause });
  }
  const record = decodeStoredPlaylist(value);
  if (row.id !== record.id)
    throw new PlaylistCorruptRecordError("id", "key does not match payload ID");
  return record;
}

function newestFirst<T extends SavedRecord>(records: T[]): readonly T[] {
  return Object.freeze(
    records.sort((a, b) =>
      a.updatedAt < b.updatedAt
        ? 1
        : a.updatedAt > b.updatedAt
          ? -1
          : a.id < b.id
            ? 1
            : a.id > b.id
              ? -1
              : 0,
    ),
  );
}

export async function createNativeLibrary(
  database: NativeLibraryDatabase,
  options: DraftRepositoryOptions & PlaylistRepositoryOptions = {},
): Promise<AppLibrary> {
  // Only an empty database can be initialized. A partial, foreign or newer schema
  // is an error; it must never be repaired by overwriting a user's data.
  try {
    const version = (await database.query("PRAGMA user_version"))[0]
      ?.user_version;
    const tables = await database.query(
      "SELECT name, type FROM sqlite_master WHERE name NOT GLOB 'sqlite_*' ORDER BY name",
    );
    if (version !== 0 && version !== 1)
      throw new Error(`Unsupported native library schema ${String(version)}`);
    if (tables.length === 0) {
      await database.execute("BEGIN IMMEDIATE");
      try {
        await database.execute(
          "CREATE TABLE climbs (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL)",
        );
        await database.execute(
          "CREATE TABLE playlists (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL)",
        );
        await database.execute("PRAGMA user_version = 1");
        await database.execute("COMMIT");
      } catch (cause) {
        await database.execute("ROLLBACK").catch(() => undefined);
        throw cause;
      }
    } else {
      if (
        version !== 1 ||
        tables.length !== 2 ||
        tables[0]?.name !== "climbs" ||
        tables[0]?.type !== "table" ||
        tables[1]?.name !== "playlists" ||
        tables[1]?.type !== "table"
      ) {
        throw new Error("Unsupported or incomplete native library schema");
      }
      for (const table of ["climbs", "playlists"] as const) {
        const columns = await database.query(`PRAGMA table_info(${table})`);
        if (
          columns.length !== 2 ||
          columns[0]?.name !== "id" ||
          columns[0]?.type !== "TEXT" ||
          columns[0]?.pk !== 1 ||
          columns[0]?.notnull !== 1 ||
          columns[1]?.name !== "payload" ||
          columns[1]?.type !== "TEXT" ||
          columns[1]?.notnull !== 1
        ) {
          throw new Error(`Unsupported native library ${table} schema`);
        }
      }
    }
  } catch (cause) {
    await database.close().catch(() => undefined);
    throw new LibraryBackupStorageError("Could not open native library", {
      cause,
    });
  }

  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? (() => crypto.randomUUID());
  let tail: Promise<unknown> = Promise.resolve();
  let closed = false;
  let poisoned = false;
  function queue<T>(operation: () => Promise<T>): Promise<T> {
    if (closed)
      return Promise.reject(
        new LibraryBackupStorageError("Native library is closed"),
      );
    const result = tail.then(async () => {
      if (poisoned)
        throw new LibraryBackupStorageError(
          "Native library connection failed; reopen before continuing",
        );
      return operation();
    });
    tail = result.catch(() => undefined);
    return result;
  }
  async function transaction<T>(operation: () => Promise<T>): Promise<T> {
    try {
      await database.execute("BEGIN IMMEDIATE");
    } catch (cause) {
      poisoned = true;
      throw cause;
    }
    let committing = false;
    try {
      const result = await operation();
      committing = true;
      await database.execute("COMMIT");
      return result;
    } catch (cause) {
      // A lost commit response cannot establish whether disk changed. Even if
      // rollback succeeds, this connection must not acknowledge another save.
      if (committing) poisoned = true;
      try {
        await database.execute("ROLLBACK");
      } catch {
        poisoned = true;
      }
      throw cause;
    }
  }
  async function get<T>(
    table: Table,
    id: string,
    decode: (row: Record<string, unknown>) => T,
  ): Promise<T | null> {
    const rows = await database.query(
      `SELECT id, payload FROM ${table} WHERE id = ?`,
      [id],
    );
    return rows.length === 0 ? null : decode(rows[0]!);
  }
  async function insert(
    table: Table,
    id: string,
    payload: unknown,
  ): Promise<void> {
    await database.run(`INSERT INTO ${table} (id, payload) VALUES (?, ?)`, [
      id,
      JSON.stringify(payload),
    ]);
  }
  async function put(
    table: Table,
    id: string,
    payload: unknown,
  ): Promise<void> {
    await database.run(`UPDATE ${table} SET payload = ? WHERE id = ?`, [
      JSON.stringify(payload),
      id,
    ]);
  }
  async function readDrafts(): Promise<readonly LocalClimbDraft[]> {
    return newestFirst(
      (await database.query("SELECT id, payload FROM climbs")).map(draftRow),
    );
  }
  async function readPlaylists(): Promise<readonly LocalPlaylist[]> {
    return newestFirst(
      (await database.query("SELECT id, payload FROM playlists")).map(
        playlistRow,
      ),
    );
  }
  function draftOperation<T>(operation: () => Promise<T>): Promise<T> {
    return queue(operation).catch((cause: unknown) => {
      throw translateDraftStorageError(cause, "Could not access native climbs");
    });
  }
  function playlistOperation<T>(operation: () => Promise<T>): Promise<T> {
    return queue(operation).catch((cause: unknown) => {
      throw translatePlaylistStorageError(
        cause,
        "Could not access native playlists",
      );
    });
  }
  function mutateDraft(
    id: LocalDraftId,
    expected: DraftRevision,
    change: (
      current: LocalClimbDraft,
      updatedAt: string,
    ) => LocalClimbDraft | null,
  ): Promise<LocalClimbDraft | null> {
    return draftOperation(() =>
      transaction(async () => {
        const current = await get("climbs", id, draftRow);
        if (!current) throw new DraftNotFoundError(id);
        if (current.revision !== expected)
          throw new DraftConflictError(id, expected, current.revision);
        const result = change(current, now().toISOString());
        if (result) await put("climbs", id, encodeStoredDraft(result));
        else await database.run("DELETE FROM climbs WHERE id = ?", [id]);
        return result;
      }),
    );
  }
  const drafts: LocalDraftRepository = {
    create: (content) =>
      draftOperation(() =>
        transaction(async () => {
          const attempts = options.createId ? 1 : 2;
          for (let attempt = 0; attempt < attempts; attempt += 1) {
            const timestamp = now().toISOString();
            const id = localDraftId(createId());
            const draft = draftFrom(content, {
              id,
              revision: draftRevision(1),
              createdAt: timestamp,
              updatedAt: timestamp,
            });
            if (
              (await database.query("SELECT id FROM climbs WHERE id = ?", [id]))
                .length > 0
            ) {
              if (attempt === attempts - 1)
                throw new DraftConflictError(
                  id,
                  draft.revision,
                  draft.revision,
                );
              continue;
            }
            await insert("climbs", id, encodeStoredDraft(draft));
            return draft;
          }
          throw new DraftRepositoryError(
            "unavailable",
            "Could not allocate local climb ID",
          );
        }),
      ),
    get: (id) => draftOperation(() => get("climbs", id, draftRow)),
    list: (listOptions = {}) =>
      draftOperation(async () => {
        const result: LocalClimbDraft[] = [];
        for (const row of await database.query(
          "SELECT id, payload FROM climbs",
        )) {
          let draft: LocalClimbDraft;
          try {
            draft = draftRow(row);
          } catch (cause) {
            if (
              listOptions.onUnreadableRecord &&
              cause instanceof DraftRepositoryError &&
              (cause.code === "corrupt-record" ||
                cause.code === "schema-unsupported")
            ) {
              listOptions.onUnreadableRecord({
                key: String(row.id),
                message: cause.message,
              });
              continue;
            }
            throw cause;
          }
          if (
            (listOptions.installationId === undefined ||
              draft.installationId === listOptions.installationId) &&
            draftInCollection(draft, listOptions.collection ?? "active")
          )
            result.push(draft);
        }
        return newestFirst(result);
      }),
    update: async (id, revision, content) =>
      (await mutateDraft(id, revision, (current, updatedAt) => {
        if (current.trashedAt !== undefined)
          throw new DraftRepositoryError(
            "conflict",
            `Local climb ${id} is in Trash and cannot be updated`,
          );
        return draftFrom(content, {
          id,
          revision: draftRevision(current.revision + 1),
          createdAt: current.createdAt,
          updatedAt,
        });
      }))!,
    trash: async (id, revision) =>
      (await mutateDraft(id, revision, (current, updatedAt) => {
        if (current.trashedAt !== undefined)
          throw new DraftRepositoryError(
            "conflict",
            `Local climb ${id} is already in Trash`,
          );
        return draftFrom(draftContentOf(current), {
          id,
          revision: draftRevision(current.revision + 1),
          createdAt: current.createdAt,
          updatedAt,
          trashedAt: updatedAt,
        });
      }))!,
    restore: async (id, revision) =>
      (await mutateDraft(id, revision, (current, updatedAt) => {
        if (current.trashedAt === undefined)
          throw new DraftRepositoryError(
            "conflict",
            `Local climb ${id} is not in Trash`,
          );
        return draftFrom(draftContentOf(current), {
          id,
          revision: draftRevision(current.revision + 1),
          createdAt: current.createdAt,
          updatedAt,
        });
      }))!,
    deletePermanently: async (id, revision) => {
      await mutateDraft(id, revision, () => null);
    },
  };
  function mutatePlaylist(
    id: PlaylistId,
    expected: PlaylistRevision,
    change: (current: LocalPlaylist) => LocalPlaylist | null,
  ): Promise<LocalPlaylist | null> {
    return playlistOperation(() =>
      transaction(async () => {
        const current = await get("playlists", id, playlistRow);
        if (!current) throw new PlaylistNotFoundError(id);
        if (current.revision !== expected)
          throw new PlaylistConflictError(id, expected, current.revision);
        const result = change(current);
        if (result) await put("playlists", id, encodeStoredPlaylist(result));
        else await database.run("DELETE FROM playlists WHERE id = ?", [id]);
        return result;
      }),
    );
  }
  const playlists: LocalPlaylistRepository = {
    create: (content) =>
      playlistOperation(() =>
        transaction(async () => {
          for (
            let attempt = 0;
            attempt < (options.createId ? 1 : 2);
            attempt += 1
          ) {
            const timestamp = now().toISOString();
            const id = playlistId(createId());
            const playlist = playlistFrom(content, {
              id,
              revision: playlistRevision(1),
              createdAt: timestamp,
              updatedAt: timestamp,
            });
            if (
              (
                await database.query("SELECT id FROM playlists WHERE id = ?", [
                  id,
                ])
              ).length > 0
            ) {
              if (options.createId || attempt === 1)
                throw new PlaylistConflictError(
                  id,
                  playlist.revision,
                  playlist.revision,
                );
              continue;
            }
            await insert("playlists", id, encodeStoredPlaylist(playlist));
            return playlist;
          }
          throw new Error("Could not allocate playlist ID");
        }),
      ),
    get: (id) => playlistOperation(() => get("playlists", id, playlistRow)),
    list: () => playlistOperation(readPlaylists),
    update: async (id, revision, content) =>
      (await mutatePlaylist(id, revision, (current) =>
        playlistFrom(content, {
          id,
          revision: playlistRevision(current.revision + 1),
          createdAt: current.createdAt,
          updatedAt: now().toISOString(),
        }),
      ))!,
    delete: async (id, revision) => {
      await mutatePlaylist(id, revision, () => null);
    },
  };
  function restoreBatch<T extends SavedRecord>(
    table: Table,
    records: readonly T[],
    encode: (record: T) => unknown,
    decode: (row: Record<string, unknown>) => T,
    canonical: (record: T) => string,
  ): Promise<RestoreBatchResult> {
    return queue(() =>
      transaction(async () => {
        const ids = new Set<string>();
        let added = 0;
        let unchanged = 0;
        for (const input of records) {
          const record = decode({
            id: input.id,
            payload: JSON.stringify(encode(input)),
          });
          if (ids.has(record.id))
            throw new Error(`Duplicate ${table} ID ${record.id}`);
          ids.add(record.id);
          const current = await get(table, record.id, decode);
          if (!current) {
            await insert(table, record.id, encode(record));
            added += 1;
          } else if (canonical(current) === canonical(record)) unchanged += 1;
          else
            throw new BackupConflictError([
              {
                kind: table === "climbs" ? "climb" : "playlist",
                id: record.id as never,
                name: record.name,
              },
            ]);
        }
        return { added, unchanged };
      }),
    );
  }
  const backupStore: LibraryBackupStore = {
    readSnapshot: () =>
      queue(() =>
        transaction(async () =>
          Object.freeze({
            drafts: await readDrafts(),
            playlists: await readPlaylists(),
          }),
        ),
      ),
    readDrafts: () => queue(readDrafts),
    readPlaylists: () => queue(readPlaylists),
    restoreMissingDrafts: (records) =>
      restoreBatch(
        "climbs",
        records,
        encodeStoredDraft,
        draftRow,
        canonicalDraft,
      ),
    restoreMissingPlaylists: (records) =>
      restoreBatch(
        "playlists",
        records,
        encodeStoredPlaylist,
        playlistRow,
        canonicalPlaylist,
      ),
  };
  return Object.freeze({
    drafts,
    playlists,
    backupStore,
    close: () => {
      if (closed) return;
      closed = true;
      // Admit no new work, but let every already admitted transaction settle first.
      tail = tail.then(() => database.close());
      void tail.catch(() => undefined);
    },
  });
}

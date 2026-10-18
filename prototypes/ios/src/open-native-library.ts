import {
  CapacitorSQLite,
  type CapacitorSQLitePlugin,
} from "@capacitor-community/sqlite";
import type { AppLibrary } from "../../../web/src/app/library.ts";
import {
  createNativeLibrary,
  type NativeLibraryDatabase,
} from "./native-library.ts";

export const NATIVE_LIBRARY_DATABASE = "cruxcontrol-library";
type SQLitePlugin = Pick<
  CapacitorSQLitePlugin,
  "createConnection" | "open" | "closeConnection" | "execute" | "run" | "query"
>;

export function createNativeLibraryOpener(
  plugin: SQLitePlugin,
): () => Promise<AppLibrary> {
  // A lease lasts through the final queued commit and native close, not merely
  // through initialization. React StrictMode may open twice before the first
  // initialization finishes and its disposed effect can close the result.
  let released: Promise<void> = Promise.resolve();
  let closeFailure: unknown;
  return async () => {
    const previous = released;
    let release!: () => void;
    released = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    if (closeFailure !== undefined) {
      release();
      throw new Error(
        "Native library connection could not close; restart the app before reopening",
        { cause: closeFailure },
      );
    }
    const connection = { database: NATIVE_LIBRARY_DATABASE, readonly: false };
    let created = false;
    let closed = false;
    const close = async () => {
      if (closed) return;
      closed = true;
      try {
        if (created) await plugin.closeConnection(connection);
      } catch (cause) {
        closeFailure = cause;
        throw cause;
      } finally {
        release();
      }
    };
    try {
      await plugin.createConnection({
        ...connection,
        encrypted: false,
        mode: "no-encryption",
        version: 1,
      });
      created = true;
      await plugin.open(connection);
      const database: NativeLibraryDatabase = {
        execute: async (statements) => {
          await plugin.execute({
            ...connection,
            statements,
            transaction: false,
          });
        },
        run: async (statement, values) => {
          await plugin.run({
            ...connection,
            statement,
            values: [...values],
            transaction: false,
          });
        },
        query: async (statement, values = []) => {
          const result = await plugin.query({
            ...connection,
            statement,
            values: [...values],
          });
          if (!Array.isArray(result.values))
            throw new Error("Native SQLite returned no query rows");
          return result.values as Record<string, unknown>[];
        },
        close,
      };
      // Android app databases are persistent app-specific files. Require WAL and
      // FULL synchronization rather than silently accepting weaker settings.
      await database.query("PRAGMA journal_mode = WAL");
      await database.execute("PRAGMA synchronous = FULL");
      const journal = (await database.query("PRAGMA journal_mode"))[0]
        ?.journal_mode;
      const synchronization = (await database.query("PRAGMA synchronous"))[0]
        ?.synchronous;
      if (journal !== "wal" || synchronization !== 2)
        throw new Error("Native library durability settings were not applied");
      return await createNativeLibrary(database);
    } catch (cause) {
      await close().catch(() => undefined);
      throw cause;
    }
  };
}

export const openNativeLibrary = createNativeLibraryOpener(CapacitorSQLite);

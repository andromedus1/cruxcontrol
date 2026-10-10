import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import {
  createNativeLibraryOpener,
  NATIVE_LIBRARY_DATABASE,
} from "./open-native-library.ts";
import { draftContent } from "../../../web/src/drafts/test-fixtures.ts";

function sqlitePlugin() {
  let database: DatabaseSync | null = null;
  const plugin = {
    createConnection: vi.fn(async () => {
      if (database) throw new Error("Duplicate native connection");
      database = new DatabaseSync(":memory:");
    }),
    open: vi.fn(async () => undefined),
    closeConnection: vi.fn(async () => {
      database?.close();
      database = null;
    }),
    execute: vi.fn(
      async (options: { statements: string; transaction?: boolean }) => {
        expect(options.transaction).toBe(false);
        // Android's SQLCipher rejects a returning PRAGMA through execute.
        expect(options.statements).not.toContain("journal_mode");
        database!.exec(options.statements);
        return { changes: { changes: 0 } };
      },
    ),
    run: vi.fn(
      async (options: {
        statement: string;
        values?: unknown[];
        transaction?: boolean;
      }) => {
        expect(options.transaction).toBe(false);
        database!
          .prepare(options.statement)
          .run(...(options.values as SQLInputValue[]));
        return { changes: { changes: 1 } };
      },
    ),
    query: vi.fn(
      async (options: { statement: string; values?: unknown[] }) => ({
        values: options.statement.startsWith("PRAGMA journal_mode")
          ? [{ journal_mode: "wal" }]
          : database!
              .prepare(options.statement)
              .all(...(options.values as SQLInputValue[])),
      }),
    ),
  };
  return plugin;
}

describe("native SQLite bridge ownership", () => {
  it("opens persistent app storage with explicit transactions and verified durability settings", async () => {
    const plugin = sqlitePlugin();
    const library = await createNativeLibraryOpener(plugin)();
    expect(plugin.createConnection).toHaveBeenCalledWith({
      database: NATIVE_LIBRARY_DATABASE,
      readonly: false,
      encrypted: false,
      mode: "no-encryption",
      version: 1,
    });
    await library.drafts.create(draftContent());
    expect(plugin.run).toHaveBeenCalledWith(
      expect.objectContaining({
        transaction: false,
        values: expect.any(Array),
      }),
    );
    library.close();
    await vi.waitFor(() =>
      expect(plugin.closeConnection).toHaveBeenCalledOnce(),
    );
  });

  it("serializes overlapping initialization and close/reopen until native close completes", async () => {
    const plugin = sqlitePlugin();
    const opener = createNativeLibraryOpener(plugin);
    const first = opener();
    const second = opener();
    const library = await first;
    expect(plugin.createConnection).toHaveBeenCalledOnce();
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const close = plugin.closeConnection;
    plugin.closeConnection = vi.fn(async () => {
      await barrier;
      await close();
    });
    const pending = library.drafts.create(draftContent());
    library.close();
    library.close();
    await pending;
    expect(plugin.createConnection).toHaveBeenCalledOnce();
    release();
    const reopened = await second;
    expect(plugin.createConnection).toHaveBeenCalledTimes(2);
    reopened.close();
    await vi.waitFor(() =>
      expect(plugin.closeConnection).toHaveBeenCalledTimes(2),
    );
  });

  it("releases a failed initialization lease and preserves the native error", async () => {
    const plugin = sqlitePlugin();
    const failure = new Error("native open failed");
    plugin.open.mockRejectedValueOnce(failure);
    const opener = createNativeLibraryOpener(plugin);
    await expect(opener()).rejects.toBe(failure);
    expect(plugin.closeConnection).toHaveBeenCalledOnce();
    const retried = await opener();
    retried.close();
    await vi.waitFor(() =>
      expect(plugin.closeConnection).toHaveBeenCalledTimes(2),
    );
  });

  it("fails closed when native cleanup fails rather than attaching to uncertain ownership", async () => {
    const plugin = sqlitePlugin();
    const opener = createNativeLibraryOpener(plugin);
    const library = await opener();
    plugin.closeConnection.mockRejectedValueOnce(
      new Error("native close failed"),
    );
    library.close();
    await expect(opener()).rejects.toThrow("restart the app");
    expect(plugin.createConnection).toHaveBeenCalledOnce();
    await plugin.closeConnection();
  });

  it("rejects unusable durability configuration without continuing to schema or saves", async () => {
    const plugin = sqlitePlugin();
    plugin.query
      .mockResolvedValueOnce({ values: [{ journal_mode: "wal" }] })
      .mockResolvedValueOnce({ values: [{ journal_mode: "delete" }] });
    await expect(createNativeLibraryOpener(plugin)()).rejects.toThrow(
      "durability settings",
    );
    expect(plugin.run).not.toHaveBeenCalled();
    expect(plugin.closeConnection).toHaveBeenCalledOnce();
  });
});

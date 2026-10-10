import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createNativeLibrary,
  type NativeLibraryDatabase,
} from "./native-library.ts";
import type { AppLibrary } from "../../../web/src/app/library.ts";
import {
  FIRST_DRAFT_ID,
  SECOND_DRAFT_ID,
  draftContent,
} from "../../../web/src/drafts/test-fixtures.ts";
import { draftContentOf } from "../../../web/src/drafts/record.ts";
import { localDraftId } from "../../../web/src/drafts/codec.ts";
import {
  canonicalSnapshot,
  decodeLibraryBackup,
} from "../../../web/src/library-backup/codec.ts";
import { LibraryBackupService } from "../../../web/src/library-backup/service.ts";

const fixture = decodeLibraryBackup(
  readFileSync(
    new URL("../fixtures/synthetic-library.json", import.meta.url),
    "utf8",
  ),
);
const cleanups: (() => void)[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const cleanup of cleanups.splice(0)) cleanup();
  await new Promise((resolve) => setTimeout(resolve, 0));
});

function sqlDatabase(path = ":memory:") {
  const sql = new DatabaseSync(path);
  let closed = false;
  const database: NativeLibraryDatabase = {
    execute: vi.fn(async (statement) => {
      sql.exec(statement);
    }),
    run: vi.fn(async (statement, values) => {
      sql.prepare(statement).run(...(values as SQLInputValue[]));
    }),
    query: vi.fn(async (statement, values = []) =>
      sql.prepare(statement).all(...(values as SQLInputValue[])),
    ),
    close: vi.fn(async () => {
      if (!closed) {
        closed = true;
        sql.close();
      }
    }),
  };
  cleanups.push(() => {
    if (!closed) {
      closed = true;
      sql.close();
    }
  });
  return { sql, database };
}
async function open(
  options: Parameters<typeof createNativeLibrary>[1] = {
    createId: () => FIRST_DRAFT_ID,
  },
) {
  const db = sqlDatabase();
  return { ...db, library: await createNativeLibrary(db.database, options) };
}
async function snapshot(library: AppLibrary) {
  return library.backupStore.readSnapshot!();
}

describe("native library against real SQLite", () => {
  it("creates, updates, filters, trashes, restores and deletes with immutable identity/dates", async () => {
    const { library } = await open({
      createId: () => FIRST_DRAFT_ID,
      now: () => new Date("2026-10-10T00:00:00.000Z"),
    });
    const draft = await library.drafts.create(
      draftContent({
        name: "Bound ' SQL; --",
        metadata: { grade: "V4", description: "Detail" },
      }),
    );
    expect(draft.revision).toBe(1);
    const finished = await library.drafts.update(
      draft.id,
      draft.revision,
      draftContentOf({ ...draft, status: "finished" }),
    );
    expect(finished).toMatchObject({
      id: draft.id,
      createdAt: draft.createdAt,
      revision: 2,
      status: "finished",
    });
    expect(finished.metadata).toEqual({ grade: "V4", description: "Detail" });
    expect(await library.drafts.list({ collection: "drafts" })).toEqual([]);
    expect(await library.drafts.list({ collection: "finished" })).toEqual([
      finished,
    ]);
    expect(
      await library.drafts.list({ installationId: "other" as never }),
    ).toEqual([]);
    const trashed = await library.drafts.trash(finished.id, finished.revision);
    expect(await library.drafts.list()).toEqual([]);
    expect(await library.drafts.list({ collection: "trash" })).toEqual([
      trashed,
    ]);
    await expect(
      library.drafts.update(trashed.id, trashed.revision, draftContent()),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      library.drafts.trash(trashed.id, trashed.revision),
    ).rejects.toMatchObject({ code: "conflict" });
    const restored = await library.drafts.restore(trashed.id, trashed.revision);
    expect(restored.trashedAt).toBeUndefined();
    await expect(
      library.drafts.restore(restored.id, restored.revision),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      library.drafts.deletePermanently(restored.id, draft.revision),
    ).rejects.toMatchObject({ code: "conflict" });
    await library.drafts.deletePermanently(restored.id, restored.revision);
    expect(await library.drafts.get(restored.id)).toBeNull();
    await expect(
      library.drafts.update(restored.id, restored.revision, draftContent()),
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("serializes simultaneous revision checks so exactly one edit commits", async () => {
    const { library } = await open();
    const draft = await library.drafts.create(draftContent());
    const edits = await Promise.allSettled(
      ["First", "Second"].map((name) =>
        library.drafts.update(draft.id, draft.revision, draftContent({ name })),
      ),
    );
    expect(edits.map(({ status }) => status)).toEqual([
      "fulfilled",
      "rejected",
    ]);
    expect(await library.drafts.get(draft.id)).toMatchObject({
      name: "First",
      revision: 2,
    });
  });

  it("handles injected collisions as conflicts and retries the default UUID source once", async () => {
    const { library } = await open();
    await library.drafts.create(draftContent());
    await expect(library.drafts.create(draftContent())).rejects.toMatchObject({
      code: "conflict",
    });
    const db = sqlDatabase();
    const retry = await createNativeLibrary(db.database);
    const random = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValueOnce(FIRST_DRAFT_ID)
      .mockReturnValueOnce(FIRST_DRAFT_ID)
      .mockReturnValueOnce(SECOND_DRAFT_ID);
    await retry.drafts.create(draftContent());
    expect((await retry.drafts.create(draftContent())).id).toBe(
      SECOND_DRAFT_ID,
    );
    expect(random).toHaveBeenCalledTimes(3);
  });

  it("preserves playlist order, shared and missing references, conflict and delete rules", async () => {
    const { library } = await open();
    const entries = fixture.playlists[0]!.entries;
    const playlist = await library.playlists.create({
      name: "List",
      notes: "Notes",
      entries,
    });
    expect((await library.playlists.get(playlist.id))?.entries).toEqual(
      entries,
    );
    await expect(library.playlists.create(playlist)).rejects.toMatchObject({
      code: "conflict",
    });
    const reordered = await library.playlists.update(
      playlist.id,
      playlist.revision,
      { ...playlist, entries: [...entries].reverse() },
    );
    expect(reordered).toMatchObject({
      createdAt: playlist.createdAt,
      revision: 2,
      entries: [...entries].reverse(),
    });
    expect(await library.playlists.list()).toEqual([reordered]);
    await expect(
      library.playlists.update(playlist.id, playlist.revision, playlist),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      library.playlists.delete(playlist.id, playlist.revision),
    ).rejects.toMatchObject({ code: "conflict" });
    await library.playlists.delete(playlist.id, reordered.revision);
    expect(await library.playlists.get(playlist.id)).toBeNull();
    await expect(
      library.playlists.delete(playlist.id, reordered.revision),
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("restores and exports every synthetic field canonically, then reopens the same persistent file", async () => {
    const directory = mkdtempSync(join(tmpdir(), "cruxcontrol-native-sql-"));
    cleanups.push(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, "library.db");
    const first = sqlDatabase(path);
    const library = await createNativeLibrary(first.database);
    const service = new LibraryBackupService(library.backupStore);
    expect(await service.restore(fixture)).toMatchObject({
      status: "complete",
      drafts: { added: 4 },
      playlists: { added: 2 },
    });
    expect(
      canonicalSnapshot(decodeLibraryBackup((await service.exportFile()).text)),
    ).toBe(canonicalSnapshot(fixture));
    expect(await service.restore(fixture)).toMatchObject({
      status: "complete",
      drafts: { added: 0, unchanged: 4 },
      playlists: { added: 0, unchanged: 2 },
    });
    library.close();
    await vi.waitFor(() => expect(first.database.close).toHaveBeenCalledOnce());
    const second = sqlDatabase(path);
    const reopened = await createNativeLibrary(second.database);
    expect(canonicalSnapshot(await snapshot(reopened))).toBe(
      canonicalSnapshot(fixture),
    );
  });

  it("rolls back an entire missing-only batch on a later conflict and retains originals", async () => {
    const { library } = await open();
    await library.backupStore.restoreMissingDrafts([fixture.drafts[1]!]);
    const changed = { ...fixture.drafts[1]!, name: "Changed" };
    await expect(
      library.backupStore.restoreMissingDrafts([fixture.drafts[0]!, changed]),
    ).rejects.toMatchObject({ name: "BackupConflictError" });
    expect(await library.backupStore.readDrafts()).toEqual([
      fixture.drafts[1]!,
    ]);
    await expect(
      library.backupStore.restoreMissingDrafts([
        fixture.drafts[0]!,
        fixture.drafts[0]!,
      ]),
    ).rejects.toThrow("Duplicate");
    expect(await library.backupStore.readDrafts()).toEqual([
      fixture.drafts[1]!,
    ]);
    await library.backupStore.restoreMissingPlaylists([fixture.playlists[1]!]);
    await expect(
      library.backupStore.restoreMissingPlaylists([
        fixture.playlists[0]!,
        { ...fixture.playlists[1]!, notes: "Conflict" },
      ]),
    ).rejects.toMatchObject({ name: "BackupConflictError" });
    expect(await library.backupStore.readPlaylists()).toEqual([
      fixture.playlists[1]!,
    ]);
  });

  it("rolls back failed SQL writes without claiming saved content", async () => {
    const { library, database } = await open();
    const original = await library.drafts.create(
      draftContent({ name: "Original" }),
    );
    vi.mocked(database.run).mockRejectedValueOnce(new Error("disk full"));
    await expect(
      library.drafts.update(
        original.id,
        original.revision,
        draftContent({ name: "Unsaved" }),
      ),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(await library.drafts.get(original.id)).toEqual(original);
    expect(
      (
        await library.drafts.update(
          original.id,
          original.revision,
          draftContent({ name: "Retry" }),
        )
      ).name,
    ).toBe("Retry");
  });

  it("fails closed after an ambiguous commit or failed rollback, including already queued writes", async () => {
    for (const failedStatement of [
      "COMMIT",
      "COMMIT response",
      "ROLLBACK",
      "BEGIN IMMEDIATE",
    ]) {
      const { library, database } = await open();
      const execute = database.execute;
      const failure = new Error(`lost ${failedStatement}`);
      database.execute = vi.fn(async (statement) => {
        if (statement === failedStatement) throw failure;
        await execute(statement);
        if (statement === "COMMIT" && failedStatement === "COMMIT response")
          throw failure;
      });
      if (failedStatement === "ROLLBACK")
        vi.mocked(database.run).mockRejectedValueOnce(
          new Error("write failed"),
        );
      const first = library.drafts.create(draftContent());
      const queued = library.playlists.create({
        name: "Must fail",
        notes: "",
        entries: [],
      });
      await expect(first).rejects.toMatchObject({ code: "unavailable" });
      await expect(queued).rejects.toMatchObject({ code: "unavailable" });
      await expect(library.backupStore.readSnapshot!()).rejects.toThrow(
        "reopen",
      );
      expect(database.run).toHaveBeenCalledTimes(
        failedStatement === "BEGIN IMMEDIATE" ? 0 : 1,
      );
    }
  });

  it("takes one complete snapshot before admitting a queued write between table reads", async () => {
    const { library, database } = await open();
    const service = new LibraryBackupService(library.backupStore);
    await service.restore(fixture);
    const query = database.query;
    let queued: Promise<unknown> | undefined;
    database.query = vi.fn(async (statement, values) => {
      const rows = await query(statement, values);
      if (statement === "SELECT id, payload FROM climbs")
        queued = library.playlists.update(
          fixture.playlists[0]!.id,
          fixture.playlists[0]!.revision,
          { ...fixture.playlists[0]!, name: "After capture" },
        );
      return rows;
    });
    const captured = decodeLibraryBackup((await service.exportFile()).text);
    expect(canonicalSnapshot(captured)).toBe(canonicalSnapshot(fixture));
    await queued;
    expect((await library.playlists.get(fixture.playlists[0]!.id))?.name).toBe(
      "After capture",
    );
  });

  it("rejects malformed JSON, unsupported schema and key/payload mismatch; diagnostics cannot weaken backups", async () => {
    for (const payload of [
      "{",
      JSON.stringify({ schemaVersion: 100 }),
      JSON.stringify({
        ...JSON.parse(
          readFileSync(
            new URL("../fixtures/synthetic-library.json", import.meta.url),
            "utf8",
          ),
        ).drafts[0],
        id: SECOND_DRAFT_ID,
      }),
    ]) {
      const { library, sql } = await open();
      sql
        .prepare("INSERT INTO climbs (id, payload) VALUES (?, ?)")
        .run(FIRST_DRAFT_ID, payload);
      await expect(
        library.drafts.get(localDraftId(FIRST_DRAFT_ID)),
      ).rejects.toHaveProperty("code");
      await expect(library.drafts.list()).rejects.toHaveProperty("code");
      const issues = vi.fn();
      expect(await library.drafts.list({ onUnreadableRecord: issues })).toEqual(
        [],
      );
      expect(issues).toHaveBeenCalledOnce();
      await expect(
        new LibraryBackupService(library.backupStore).exportFile(),
      ).rejects.toHaveProperty("code");
      expect(sql.prepare("SELECT payload FROM climbs").get()?.payload).toBe(
        payload,
      );
    }
    const { library, sql } = await open();
    sql
      .prepare("INSERT INTO playlists (id, payload) VALUES (?, ?)")
      .run(FIRST_DRAFT_ID, "{");
    await expect(library.playlists.list()).rejects.toMatchObject({
      code: "corrupt-record",
    });
    await expect(
      new LibraryBackupService(library.backupStore).review(fixture),
    ).rejects.toMatchObject({ code: "corrupt-record" });
  });

  it("refuses partial, newer and foreign schemas without recreating or deleting them", async () => {
    for (const schema of [
      "PRAGMA user_version = 2",
      "CREATE TABLE climbs (id TEXT)",
      "CREATE TABLE other (payload TEXT)",
      "CREATE TABLE sqliteOther (payload TEXT)",
      "CREATE VIEW other AS SELECT 1",
      "CREATE TABLE climbs (id TEXT); CREATE TABLE playlists (id TEXT); PRAGMA user_version = 1",
    ]) {
      const { database, sql } = sqlDatabase();
      sql.exec(schema);
      await expect(createNativeLibrary(database)).rejects.toThrow(
        "Could not open native library",
      );
      expect(database.close).toHaveBeenCalledOnce();
      expect(database.execute).not.toHaveBeenCalled();
    }
  });

  it("waits for pending commits before idempotent close and rejects new work immediately", async () => {
    const { library, database } = await open();
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const run = database.run;
    database.run = vi.fn(async (statement, values) => {
      await barrier;
      await run(statement, values);
    });
    const pending = library.drafts.create(draftContent());
    library.close();
    library.close();
    await expect(library.drafts.list()).rejects.toMatchObject({
      code: "unavailable",
    });
    expect(database.close).not.toHaveBeenCalled();
    release();
    await expect(pending).resolves.toMatchObject({ revision: 1 });
    await vi.waitFor(() => expect(database.close).toHaveBeenCalledOnce());
  });
});

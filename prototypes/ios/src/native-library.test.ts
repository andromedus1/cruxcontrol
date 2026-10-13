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
import { encodeStoredDraft } from "../../../web/src/drafts/codec.ts";
import { localDraftId } from "../../../web/src/drafts/codec.ts";
import { encodeStoredPlaylist } from "../../../web/src/playlists/codec.ts";
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
    expect((await library.preservation!.read()).revision).toBe(1);
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
      const baselineRuns = vi.mocked(database.run).mock.calls.length;
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
        baselineRuns + (failedStatement === "BEGIN IMMEDIATE" ? 0 : failedStatement === "ROLLBACK" ? 1 : 2),
      );
    }
  });

  it("takes one complete snapshot before admitting a queued write between table reads", async () => {
    const { library, database } = await open();
    const service = new LibraryBackupService(library.backupStore);
    await service.restore(fixture);
    const before = await library.playlists.get(fixture.playlists[0]!.id);
    expect(before).not.toBeNull();
    const query = database.query;
    let queued: Promise<unknown> | undefined;
    database.query = vi.fn(async (statement, values) => {
      const rows = await query(statement, values);
      if (!queued && statement.includes("FROM climbs") && statement.includes("ORDER BY id LIMIT"))
        queued = library.playlists.update(
          before!.id,
          before!.revision,
          { ...before!, name: "After capture" },
        );
      return rows;
    });
    const captured = await library.preservation!.capture();
    expect(captured.revision).toBe(1);
    expect(canonicalSnapshot(captured.snapshot)).toBe(canonicalSnapshot(fixture));
    await queued;
    expect((await library.preservation!.read()).revision).toBe(2);
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

  it("migrates a populated v1 schema without rewriting authored rows", async () => {
    const { sql, database } = sqlDatabase();
    sql.exec("PRAGMA user_version = 1;");
    sql.exec("CREATE TABLE climbs (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL); CREATE TABLE playlists (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL);");
    const draft = fixture.drafts[0]!;
    const playlist = fixture.playlists[0]!;
    const draftPayload = JSON.stringify(encodeStoredDraft(draft));
    const playlistPayload = JSON.stringify(encodeStoredPlaylist(playlist));
    sql.prepare("INSERT INTO climbs (id, payload) VALUES (?, ?)").run(draft.id, draftPayload);
    sql.prepare("INSERT INTO playlists (id, payload) VALUES (?, ?)").run(playlist.id, playlistPayload);

    const migrated = await createNativeLibrary(database);
    expect(sql.prepare("PRAGMA user_version").get()).toEqual({ user_version: 2 });
    expect(sql.prepare("SELECT payload FROM climbs WHERE id = ?").get(draft.id)?.payload).toBe(draftPayload);
    expect(sql.prepare("SELECT payload FROM playlists WHERE id = ?").get(playlist.id)?.payload).toBe(playlistPayload);
    expect(await migrated.preservation!.read()).toMatchObject({ revision: 0, version: 0, recovery: null });
    expect(canonicalSnapshot(await migrated.backupStore.readSnapshot!())).toBe(canonicalSnapshot({ drafts: [draft], playlists: [playlist] }));
  });

  it("increments one aggregate revision per committed content mutation and keeps CAS separate", async () => {
    const { library } = await open();
    const events: string[] = [];
    const unsubscribe = library.preservation!.subscribe((event) => events.push(event));
    const capture = await library.preservation!.capture();
    expect(capture).toMatchObject({ revision: 0, snapshot: { drafts: [], playlists: [] } });
    await library.backupStore.readSnapshot!();
    expect((await library.preservation!.read()).revision).toBe(0);

    const draft = await library.drafts.create(draftContent());
    expect((await library.preservation!.read()).revision).toBe(1);
    const updated = await library.drafts.update(draft.id, draft.revision, draftContent({ name: "Updated" }));
    expect((await library.preservation!.read()).revision).toBe(2);
    const trashed = await library.drafts.trash(updated.id, updated.revision);
    const restored = await library.drafts.restore(trashed.id, trashed.revision);
    await library.drafts.deletePermanently(restored.id, restored.revision);
    expect((await library.preservation!.read()).revision).toBe(5);

    const playlist = await library.playlists.create({ name: "Order", notes: "", entries: fixture.playlists[0]!.entries });
    const reordered = await library.playlists.update(playlist.id, playlist.revision, { ...playlist, entries: [...playlist.entries].reverse() });
    await library.playlists.delete(reordered.id, reordered.revision);
    expect((await library.preservation!.read()).revision).toBe(8);
    await expect(library.drafts.update(restored.id, restored.revision, draftContent())).rejects.toHaveProperty("code", "not-found");
    expect((await library.preservation!.read()).revision).toBe(8);

    const beforeCas = await library.preservation!.read();
    const casResults = await Promise.all([
      library.preservation!.compareAndSet(beforeCas.version, beforeCas.control),
      library.preservation!.compareAndSet(beforeCas.version, beforeCas.control),
    ]);
    expect(casResults.sort()).toEqual([false, true]);
    expect(await library.preservation!.read()).toMatchObject({ revision: 8, version: 1 });
    unsubscribe();
    expect(events.filter((event) => event === "committed")).toHaveLength(8);
    expect(events.at(-1)).toBe("write-failed");
  });

  it("restores both aggregates atomically and verifies the merged library behind a durable hold", async () => {
    const { library, database } = await open();
    const service = new LibraryBackupService(library.backupStore);
    let recoveryWritten = false;
    let restoreCommitted = false;
    const run = database.run;
    database.run = vi.fn(async (statement, values) => {
      await run(statement, values);
      if (statement.includes("recovery_sha256")) recoveryWritten = true;
    });
    const execute = database.execute;
    database.execute = vi.fn(async (statement) => {
      await execute(statement);
      if (recoveryWritten && statement === "COMMIT") restoreCommitted = true;
    });
    const query = database.query;
    let failVerificationOnce = true;
    database.query = vi.fn(async (statement, values) => {
      if (restoreCommitted && failVerificationOnce && statement === "SELECT * FROM library_preservation") {
        failVerificationOnce = false;
        throw new Error("injected post-commit verification read failure");
      }
      return query(statement, values);
    });

    const result = await service.restore(fixture);
    expect(result).toMatchObject({
      status: "failed",
      phase: "verification",
      drafts: { added: 4, unchanged: 0 },
      playlists: { added: 2, unchanged: 0 },
    });
    const held = await library.preservation!.read();
    expect(held.revision).toBe(1);
    expect(held.recovery).toMatchObject({ revision: 1, sha256: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await expect(library.preservation!.capture()).rejects.toThrow("verification is pending");
    await expect(library.drafts.create(draftContent())).rejects.toHaveProperty("code", "unavailable");
    expect(canonicalSnapshot(await library.backupStore.readSnapshot!())).toBe(canonicalSnapshot(fixture));

    await library.preservation!.verifyRecovery();
    expect((await library.preservation!.read()).recovery).toBeNull();
    await expect(library.preservation!.capture()).resolves.toMatchObject({ revision: 1 });
    expect((await library.drafts.create(draftContent({ name: "After verified recovery" }))).revision).toBe(1);
  });

  it("keeps whole-library restore all-or-nothing when either table contains an ID conflict", async () => {
    const { library } = await open({ createId: () => fixture.drafts[0]!.id });
    const local = await library.drafts.create(draftContent({ name: "Local conflict" }));
    expect(local.id).toBe(fixture.drafts[0]!.id);
    await expect(library.backupStore.restoreMissingSnapshot!(fixture)).rejects.toMatchObject({ name: "BackupConflictError" });
    expect(await library.backupStore.readDrafts()).toEqual([local]);
    expect(await library.backupStore.readPlaylists()).toEqual([]);
    expect((await library.preservation!.read()).revision).toBe(1);
  });

  it("uses bounded pages and surrogate-safe chunked writes for large records", async () => {
    let nextId = 0;
    const { library, database } = await open({
      createId: () => `00000000-0000-4000-8000-${String(++nextId).padStart(12, "0")}`,
    });
    const pageSizes: number[] = [];
    const query = database.query;
    database.query = vi.fn(async (statement, values) => {
      const rows = await query(statement, values);
      if (statement.includes("ORDER BY id LIMIT")) pageSizes.push(rows.length);
      return rows;
    });
    for (let index = 0; index < 70; index += 1) {
      await library.drafts.create(draftContent({ name: `Page ${index}` }));
    }
    expect((await library.preservation!.capture()).snapshot.drafts).toHaveLength(70);
    expect(pageSizes.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...pageSizes)).toBeLessThanOrEqual(32);

    const large = `${"a".repeat(16_383)}😀${"b".repeat(50_000)}`;
    const beforeRuns = vi.mocked(database.run).mock.calls.length;
    const created = await library.drafts.create(draftContent({ metadata: { setterNotes: large } }));
    const calls = vi.mocked(database.run).mock.calls.slice(beforeRuns)
      .filter(([statement]) => String(statement).includes("climbs") && String(statement).includes("payload"));
    const chunks = calls.map(([statement, values]) => String(statement).startsWith("INSERT") ? String(values[1]) : String(values[0]));
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 16 * 1024)).toBe(true);
    for (let index = 0; index < chunks.length - 1; index += 1) {
      const left = chunks[index]!.charCodeAt(chunks[index]!.length - 1);
      const right = chunks[index + 1]!.charCodeAt(0);
      expect(left >= 0xd800 && left <= 0xdbff && right >= 0xdc00 && right <= 0xdfff).toBe(false);
    }
    expect((await library.drafts.get(created.id))?.metadata.setterNotes).toBe(large);
    expect((await library.preservation!.capture()).snapshot.drafts.find(({ id }) => id === created.id)?.metadata.setterNotes).toBe(large);
  });

  it("fails a complete capture when a large record byte range is truncated", async () => {
    const { library, database } = await open();
    const large = await library.drafts.create(draftContent({ metadata: { setterNotes: "x".repeat(40_000) } }));
    expect(large.id).toBe(FIRST_DRAFT_ID);
    const query = database.query;
    database.query = vi.fn(async (statement, values) => {
      const rows = await query(statement, values);
      if (statement.includes("hex(substr") && rows[0]?.chunk) {
        return [{ ...rows[0], chunk: String(rows[0].chunk).slice(2) }];
      }
      return rows;
    });
    await expect(library.preservation!.capture()).rejects.toThrow("truncated payload range");
  });
});

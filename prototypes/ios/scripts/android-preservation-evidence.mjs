// Read-only verification for synthetic emulator acceptance. Product recovery must
// happen through the normal UI; this helper never imports or mutates records.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalSnapshot, decodeLibraryBackup, encodeLibraryBackup, LIBRARY_BACKUP_LIMITS } from '../../../web/src/library-backup/codec.ts';
import { decodeStoredDraft } from '../../../web/src/drafts/codec.ts';
import { decodeStoredPlaylist } from '../../../web/src/playlists/codec.ts';
import { catalogDevice } from './android-catalog-device.mjs';

const PAGE = 32, INLINE_BYTES = 8192, CHUNK_BYTES = 32768;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
async function query(device, statement, values = []) {
  // catalogDevice admits only explicit emulators. Parameters stay data; neither
  // user-supplied identifiers nor filesystem paths are interpolated into SQL.
  const options = { database: 'cruxcontrol-library', statement, values, readonly: false };
  return device.evaluate(`window.Capacitor.Plugins.CapacitorSQLite.query(${JSON.stringify(options)}).then(result => result.values)`);
}

export async function preservedLibrarySnapshot(device) {
  const before = await query(device, 'SELECT revision FROM library_preservation');
  assert.equal(before.length, 1, 'Expected one v2 preservation record');
  const revision = before[0].revision;
  assert(Number.isSafeInteger(revision) && revision >= 0);
  const snapshot = { drafts: [], playlists: [] };
  for (const [table, target, decode, limit] of [
    ['climbs', snapshot.drafts, decodeStoredDraft, LIBRARY_BACKUP_LIMITS.climbs],
    ['playlists', snapshot.playlists, decodeStoredPlaylist, LIBRARY_BACKUP_LIMITS.playlists],
  ]) {
    let afterId = '';
    for (;;) {
      const page = await query(device, `SELECT id, length(CAST(payload AS BLOB)) AS bytes, CASE WHEN length(CAST(payload AS BLOB)) <= ${INLINE_BYTES} THEN payload ELSE NULL END AS payload FROM ${table} WHERE id > ? ORDER BY id LIMIT ${PAGE}`, [afterId]);
      assert(Array.isArray(page) && page.length <= PAGE);
      if (page.length === 0) break;
      for (const row of page) {
        assert(typeof row.id === 'string' && row.id > afterId && row.id.length <= 128);
        assert(Number.isSafeInteger(row.bytes) && row.bytes > 0 && row.bytes <= LIBRARY_BACKUP_LIMITS.bytes);
        let text = row.payload;
        if (row.bytes > INLINE_BYTES) {
          assert.equal(text, null);
          const chunks = [];
          for (let offset = 0; offset < row.bytes; offset += CHUNK_BYTES) {
            const count = Math.min(CHUNK_BYTES, row.bytes - offset);
            const rows = await query(device, `SELECT hex(substr(CAST(payload AS BLOB), ?, ?)) AS part FROM ${table} WHERE id = ?`, [offset + 1, count, row.id]);
            assert.equal(rows.length, 1);
            const hex = rows[0].part;
            assert(typeof hex === 'string' && /^[0-9A-F]+$/.test(hex) && hex.length === count * 2);
            chunks.push(Buffer.from(hex, 'hex'));
          }
          text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
        }
        assert(typeof text === 'string' && Buffer.byteLength(text) === row.bytes);
        const record = decode(JSON.parse(text));
        assert.equal(record.id, row.id);
        target.push(record);
        assert(target.length <= limit, 'Never accept a truncated library as complete');
        afterId = row.id;
      }
    }
  }
  // A monotonic aggregate revision changes atomically with every authored write.
  // Matching endpoints establish a quiescent complete comparison without taking
  // over the production connection's transaction or coordinator locks.
  assert.deepEqual(await query(device, 'SELECT revision FROM library_preservation'), before,
    'Library changed during comparison; retry after edits finish');
  decodeLibraryBackup(encodeLibraryBackup(snapshot, new Date()));
  return { revision, snapshot };
}

export async function writePreservationEvidence(device, outputArgument, expectedArgument) {
  const output = resolve(outputArgument);
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  if (output === root || output.startsWith(`${root}/`)) execFileSync('git', ['check-ignore', '--quiet', output]);
  const { revision, snapshot } = await preservedLibrarySnapshot(device);
  const canonical = canonicalSnapshot(snapshot);
  if (expectedArgument) {
    const expected = decodeLibraryBackup(await readFile(expectedArgument, 'utf8'));
    assert(canonical === canonicalSnapshot(expected), 'Complete recovered content differs from source');
  }
  const text = encodeLibraryBackup(snapshot, new Date());
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  await writeFile(`${output}.backup.json`, text, { mode: 0o600, flag: 'wx' });
  const evidence = { at: new Date().toISOString(), revision, climbs: snapshot.drafts.length,
    playlists: snapshot.playlists.length, references: snapshot.playlists.reduce((n, p) => n + p.entries.length, 0),
    bytes: Buffer.byteLength(text), sha256: sha256(text), canonicalSha256: sha256(canonical),
    comparedToExpected: Boolean(expectedArgument), boundedRead: true };
  await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  return evidence;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [serial, output, expected] = process.argv.slice(2);
  assert(/^emulator-\d+$/.test(serial ?? '') && output,
    'Usage: node --experimental-strip-types android-preservation-evidence.mjs emulator-N PRIVATE_OUTPUT [EXPECTED_BACKUP]');
  const device = catalogDevice(serial);
  try { await device.start(); console.log(JSON.stringify(await writePreservationEvidence(device, output, expected))); }
  finally { await device.detach(); }
}

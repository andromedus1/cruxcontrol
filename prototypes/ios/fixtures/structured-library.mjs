// Synthetic scale fixture for native capture/restore and gateway acceptance.
// Generate on demand: do not commit multi-megabyte library files or real records.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  decodeLibraryBackup, encodeLibraryBackup, LIBRARY_BACKUP_LIMITS,
} from '../../../web/src/library-backup/codec.ts';

export function createStructuredLibrary() {
  const base = JSON.parse(readFileSync(new URL('./synthetic-library.json', import.meta.url), 'utf8'));
  const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
  const drafts = Array.from({ length: LIBRARY_BACKUP_LIMITS.climbs }, (_, index) => {
    const draft = structuredClone(base.drafts[index % base.drafts.length]);
    draft.id = id(100000 + index);
    draft.name = `Synthetic maximum ${index} 🧗`;
    draft.metadata.grade = 'V4';
    draft.updatedOrder = [draft.updatedAt, draft.id];
    return draft;
  });
  const referencesPerPlaylist = LIBRARY_BACKUP_LIMITS.references / LIBRARY_BACKUP_LIMITS.playlists;
  const playlists = Array.from({ length: LIBRARY_BACKUP_LIMITS.playlists }, (_, index) => {
    const playlist = structuredClone(base.playlists[0]);
    playlist.id = id(200000 + index);
    playlist.name = `Synthetic order ${index}`;
    playlist.updatedOrder = [playlist.updatedAt, playlist.id];
    playlist.entries = Array.from({ length: referencesPerPlaylist }, (_, position) => ({
      kind: 'local', id: id(100000 + (index * 101 + position * 37) % drafts.length),
    }));
    return playlist;
  });
  const raw = { ...base, drafts, playlists };
  const padding = Math.floor((LIBRARY_BACKUP_LIMITS.bytes - Buffer.byteLength(JSON.stringify(raw)) - 16384) / drafts.length);
  if (padding < 0) throw new Error('Structured fixture exceeds the portable byte limit');
  for (const draft of drafts) draft.metadata.description += 'x'.repeat(padding);
  const decoded = decodeLibraryBackup(JSON.stringify(raw));
  return encodeLibraryBackup(decoded, new Date(base.exportedAt));
}

// Grow an already-preserved synthetic acceptance library to the maximum counts
// without clearing the emulator or overwriting any of its existing records.
// One generated playlist deliberately spans multiple native SQL byte chunks.
export function createStructuredContinuation(preservedText) {
  const preserved = JSON.parse(encodeLibraryBackup(decodeLibraryBackup(preservedText),
    new Date('2026-10-11T00:00:00.000Z')));
  assert(preserved.drafts.length < LIBRARY_BACKUP_LIMITS.climbs);
  assert(preserved.playlists.length < LIBRARY_BACKUP_LIMITS.playlists);
  const raw = JSON.parse(createStructuredLibrary());
  raw.drafts.splice(0, preserved.drafts.length, ...preserved.drafts);
  raw.playlists.splice(0, preserved.playlists.length, ...preserved.playlists);
  const preservedReferences = preserved.playlists.reduce((sum, list) => sum + list.entries.length, 0);
  const generated = raw.playlists.slice(preserved.playlists.length);
  const remaining = LIBRARY_BACKUP_LIMITS.references - preservedReferences;
  assert(remaining >= 2_000 && generated.length > 1,
    'Continuation fixture needs room for a large generated playlist');
  let assigned = 0;
  generated.forEach((playlist, index) => {
    const count = index === 0 ? 2_000 : Math.floor((remaining - assigned) / (generated.length - index));
    assert(count <= raw.drafts.length);
    playlist.entries = Array.from({ length: count }, (_, position) => ({
      kind: 'local', id: raw.drafts[(index * 101 + position) % raw.drafts.length].id,
    }));
    assigned += count;
  });
  assert.equal(assigned, remaining);
  const text = JSON.stringify(raw);
  const decoded = decodeLibraryBackup(text); // Includes duplicate-ID and exact size checks.
  assert.equal(decoded.drafts.length, LIBRARY_BACKUP_LIMITS.climbs);
  assert.equal(decoded.playlists.length, LIBRARY_BACKUP_LIMITS.playlists);
  assert(Buffer.byteLength(JSON.stringify(generated[0])) > 32_768);
  return encodeLibraryBackup(decoded, new Date(preserved.exportedAt));
}

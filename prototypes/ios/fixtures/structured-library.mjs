// Synthetic scale fixture for native capture/restore and gateway acceptance.
// Generate on demand: do not commit multi-megabyte library files or real records.
import { readFileSync } from 'node:fs';
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

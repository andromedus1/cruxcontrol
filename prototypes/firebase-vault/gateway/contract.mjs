import { createHash } from 'node:crypto';
import { decodeLibraryBackup, LIBRARY_BACKUP_LIMITS } from '../../../web/src/library-backup/codec.ts';

export const MAX_BYTES = LIBRARY_BACKUP_LIMITS.bytes;
export const SLOT_COUNT = 32;
export const APPLICATION_SLOT_COUNT = 512;
export const FORMAT = 'cruxcontrol-library-backup-v1';
const slot = (value, count, width) => typeof value === 'string' && new RegExp(`^\\d{${width}}$`).test(value)
  && Number(value) < count && String(Number(value)).padStart(width, '0') === value;
export const isSlot = value => slot(value, SLOT_COUNT, 2);
export const isApplicationSlot = value => slot(value, APPLICATION_SLOT_COUNT, 5);
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export const PROOF_POOL = Object.freeze({
  id: 'proof', route: '/snapshots', storagePath: null, slots: SLOT_COUNT, slotWidth: 2,
});
export const LIBRARY_POOL = Object.freeze({
  id: 'library-v1', route: '/library-v1/snapshots', storagePath: 'library-v1',
  slots: APPLICATION_SLOT_COUNT, slotWidth: 5,
});
export const ACCEPTANCE_POOLS = Object.freeze([1, 2, 3, 4].map(run => {
  const id = `acceptance-v1/r00${run}`;
  return Object.freeze({
    id, route: `/${id}/snapshots`, storagePath: id, slots: APPLICATION_SLOT_COUNT, slotWidth: 5,
  });
}));
export const APPLICATION_POOLS = Object.freeze([LIBRARY_POOL, ...ACCEPTANCE_POOLS]);
export const ALL_POOLS = Object.freeze([PROOF_POOL, ...APPLICATION_POOLS]);

export function routePool(path) {
  return ALL_POOLS.find(pool => path === pool.route || path.startsWith(`${pool.route}/`)) ?? null;
}

export function isPoolSlot(value, pool) {
  return slot(value, pool.slots, pool.slotWidth);
}

export function backupCounts(backup) {
  const trash = backup.drafts.filter(draft => draft.trashedAt !== undefined).length;
  const live = backup.drafts.filter(draft => draft.trashedAt === undefined);
  return Object.freeze({
    climbs: backup.drafts.length,
    finished: live.filter(draft => draft.status === 'finished').length,
    drafts: live.filter(draft => draft.status === 'draft').length,
    trash,
    playlists: backup.playlists.length,
  });
}

function validUtcTimestamp(value, canonicalMilliseconds = false) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/.exec(value);
  if (!match) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const inputMilliseconds = (match[2] ?? '').slice(0, 3).padEnd(3, '0');
  const normalized = `${match[1]}.${inputMilliseconds}Z`;
  return new Date(parsed).toISOString() === normalized
    && (!canonicalMilliseconds || value === new Date(parsed).toISOString());
}

export function validateBackup(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > MAX_BYTES) {
    throw new Error('Invalid backup size');
  }
  return decodeLibraryBackup(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

export function validateOwner(ownerUid) {
  if (typeof ownerUid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(ownerUid)) {
    throw new Error('Invalid configured owner');
  }
}

export function validateSnapshot(snapshot, pool = PROOF_POOL) {
  const appPool = pool !== PROOF_POOL;
  const snapshotKeys = appPool
    ? ['slot', 'bytes', 'sha256', 'generation', 'createdAt', 'exportedAt', 'counts']
    : ['slot', 'bytes', 'sha256', 'generation', 'createdAt'];
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)
    || Object.keys(snapshot).sort().join(',') !== [...snapshotKeys].sort().join(',')
    || !isPoolSlot(snapshot.slot, pool) || !Number.isSafeInteger(snapshot.bytes)
    || snapshot.bytes < 1 || snapshot.bytes > MAX_BYTES
    || typeof snapshot.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(snapshot.sha256)
    || typeof snapshot.generation !== 'string' || !/^[1-9][0-9]*$/.test(snapshot.generation)
    || !validUtcTimestamp(snapshot.createdAt)) {
    throw new Error('Invalid stored snapshot metadata');
  }
  if (appPool) {
    const counts = snapshot.counts;
    if (!validUtcTimestamp(snapshot.exportedAt, true)
      || !counts || Object.keys(counts).sort().join(',') !== 'climbs,drafts,finished,playlists,trash'
      || Object.values(counts).some(value => typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
      || counts.finished + counts.drafts + counts.trash !== counts.climbs
      || counts.climbs > LIBRARY_BACKUP_LIMITS.climbs
      || counts.playlists > LIBRARY_BACKUP_LIMITS.playlists) {
      throw new Error('Invalid stored application snapshot metadata');
    }
  }
  return snapshot;
}

export function validateStored(stored, expectedSlot, pool = PROOF_POOL, expectedBytes = null, decodedBackup = null) {
  validateSnapshot(stored.snapshot, pool);
  if (stored.snapshot.slot !== expectedSlot || stored.snapshot.bytes !== stored.bytes.length
    || stored.snapshot.sha256 !== digest(stored.bytes)
    || (expectedBytes !== null && !stored.bytes.equals(expectedBytes))) {
    throw new Error('Stored backup integrity failure');
  }
  const backup = decodedBackup ?? validateBackup(stored.bytes);
  if (pool !== PROOF_POOL) {
    // A write receipt can reuse the already-decoded request only after exact byte
    // equality has been established. GETs always decode the stored object anew.
    const counts = backupCounts(backup);
    if (stored.snapshot.slot !== expectedSlot || stored.snapshot.exportedAt !== backup.exportedAt
      || ['climbs', 'finished', 'drafts', 'trash', 'playlists']
        .some(key => stored.snapshot.counts[key] !== counts[key])) {
      throw new Error('Stored backup metadata mismatch');
    }
  }
  return stored;
}

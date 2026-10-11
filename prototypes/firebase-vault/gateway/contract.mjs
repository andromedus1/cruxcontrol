import { createHash } from 'node:crypto';
import { decodeLibraryBackup, LIBRARY_BACKUP_LIMITS } from '../../../web/src/library-backup/codec.ts';

export const MAX_BYTES = LIBRARY_BACKUP_LIMITS.bytes;
export const SLOT_COUNT = 32;
export const FORMAT = 'cruxcontrol-library-backup-v1';
export const isSlot = value => typeof value === 'string' && /^([0-2][0-9]|3[01])$/.test(value);
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export function validateBackup(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > MAX_BYTES) {
    throw new Error('Invalid backup size');
  }
  decodeLibraryBackup(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

export function validateOwner(ownerUid) {
  if (typeof ownerUid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(ownerUid)) {
    throw new Error('Invalid configured owner');
  }
}

export function validateSnapshot(snapshot) {
  if (!snapshot || !isSlot(snapshot.slot) || !Number.isSafeInteger(snapshot.bytes)
    || snapshot.bytes < 1 || snapshot.bytes > MAX_BYTES
    || !/^[0-9a-f]{64}$/.test(snapshot.sha256 ?? '')
    || typeof snapshot.generation !== 'string' || !/^[1-9][0-9]*$/.test(snapshot.generation)
    || typeof snapshot.createdAt !== 'string' || !Number.isFinite(Date.parse(snapshot.createdAt))) {
    throw new Error('Invalid stored snapshot metadata');
  }
  return snapshot;
}

export function validateStored(stored, slot) {
  validateSnapshot(stored.snapshot);
  validateBackup(stored.bytes);
  if (stored.snapshot.slot !== slot || stored.snapshot.bytes !== stored.bytes.length
    || stored.snapshot.sha256 !== digest(stored.bytes)) throw new Error('Stored backup integrity failure');
  return stored;
}

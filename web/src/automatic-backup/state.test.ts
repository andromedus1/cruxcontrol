import { describe, expect, it } from 'vitest';
import { decodeBackupControl, decodePreservationRecord } from './state.ts';
import type { BackupControl, PreservationRecord } from './types.ts';

const snapshot = Object.freeze({
  slot: '00001',
  bytes: 1,
  sha256: 'a'.repeat(64),
  generation: '1',
  createdAt: '2026-10-11T00:00:00Z',
  exportedAt: '2026-10-11T00:00:00.000Z',
  counts: { climbs: 0, finished: 0, drafts: 0, trash: 0, playlists: 0 },
});
const binding = Object.freeze({
  uid: 'account_1',
  installationId: '00000000-0000-4000-8000-000000000501',
  scope: 'library-v1' as const,
});
const validControl: BackupControl = Object.freeze({
  binding,
  admission: 'active',
  history: Object.freeze([snapshot]),
  pending: null,
  protected: Object.freeze({
    revision: 7,
    snapshot,
    verifiedAt: '2026-10-11T00:00:00.000Z',
  }),
});

describe('automatic-backup durable state', () => {
  it('accepts a bounded owner-bound control and preserves immutable receipts', () => {
    expect(decodeBackupControl(validControl)).toEqual(validControl);
  });

  it.each([
    ['history without a binding', { ...validControl, binding: null }],
    ['duplicate retained slots', { ...validControl, history: [snapshot, snapshot] }],
    ['protected receipt missing from history', { ...validControl, history: [] }],
    ['unknown persisted fields', { ...validControl, debug: true }],
  ])('rejects %s', (_label, control) => {
    expect(() => decodeBackupControl(control)).toThrow();
  });

  it('rejects a pending upload that collides with retained history', () => {
    const control = {
      ...validControl,
      pending: {
        id: '00000000-0000-4000-8000-000000000502',
        revision: 8,
        slot: snapshot.slot,
        staged: {
          id: '00000000-0000-4000-8000-000000000502',
          bytes: 1,
          sha256: 'b'.repeat(64),
        },
        capturedAt: '2026-10-11T00:00:00.000Z',
      },
    };
    expect(() => decodeBackupControl(control)).toThrow('already retained');
  });

  it('binds recovery verification and pending/protected revisions to the aggregate revision', () => {
    const record: PreservationRecord = {
      revision: 7,
      version: 4,
      control: validControl,
      recovery: { revision: 7, sha256: 'c'.repeat(64) },
    };
    expect(decodePreservationRecord(record).recovery).toEqual(record.recovery);
    expect(() => decodePreservationRecord({ ...record, recovery: { ...record.recovery!, revision: 6 } })).toThrow('does not match');
    expect(() => decodePreservationRecord({ ...record, revision: 6 })).toThrow('ahead of the library');
  });
});

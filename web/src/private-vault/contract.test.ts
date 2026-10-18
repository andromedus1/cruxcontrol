import { describe, expect, it } from 'vitest';
import { decodeVaultListing, decodeVaultReceipt, decodeVaultStatus, VaultError } from './contract.ts';

const snapshot = {
  slot: '00511', bytes: 17, sha256: 'a'.repeat(64), generation: '123',
  createdAt: '2026-10-11T00:00:00.000Z', exportedAt: '2026-10-10T00:00:00.000Z',
  counts: { climbs: 1, finished: 0, drafts: 0, trash: 1, playlists: 1 },
};

describe('private vault response contracts', () => {
  it('accepts bounded status, capacity and an independently verified immutable receipt', () => {
    expect(decodeVaultStatus({
      configured: true,
      installationId: '44444444-4444-4444-8444-444444444444',
      scope: 'library-v1',
      account: { uid: 'synthetic-owner', email: null },
    }).account?.uid).toBe('synthetic-owner');
    for (const scope of ['acceptance-v1/r001', 'acceptance-v1/r002', 'acceptance-v1/r003', 'acceptance-v1/r004']) {
      expect(decodeVaultStatus({
        configured: true,
        installationId: '44444444-4444-4444-8444-444444444444',
        scope,
        account: null,
      }).scope).toBe(scope);
    }
    expect(decodeVaultListing({
      snapshots: [snapshot], capacity: { slots: 512, bytesPerSlot: 25 * 1024 * 1024 },
    }).snapshots[0]?.slot).toBe('00511');
    expect(decodeVaultReceipt({ snapshot, verified: true }).snapshot.generation).toBe('123');
  });

  it.each([
    ['noncanonical slot', { ...snapshot, slot: '0001' }],
    ['out-of-range slot', { ...snapshot, slot: '00512' }],
    ['invalid generation', { ...snapshot, generation: '01' }],
    ['invalid digest', { ...snapshot, sha256: 'A'.repeat(64) }],
    ['loose date', { ...snapshot, createdAt: '1' }],
    ['rolled calendar date', { ...snapshot, exportedAt: '2026-02-31T00:00:00.000Z' }],
    ['non-numeric count', { ...snapshot, counts: { ...snapshot.counts, drafts: '' } }],
    ['boolean count', { ...snapshot, counts: { ...snapshot.counts, trash: true } }],
    ['oversized object', { ...snapshot, bytes: 25 * 1024 * 1024 + 1 }],
  ])('rejects %s metadata before it can be consumed', (_label, invalid) => {
    expect(() => decodeVaultListing({
      snapshots: [invalid], capacity: { slots: 512, bytesPerSlot: 25 * 1024 * 1024 },
    })).toThrowError(expect.objectContaining<Partial<VaultError>>({ code: 'invalid-response' }));
  });

  it('rejects duplicate slots, wrong capacity and a receipt without verification', () => {
    const listing = { snapshots: [snapshot, snapshot], capacity: { slots: 512, bytesPerSlot: 25 * 1024 * 1024 } };
    expect(() => decodeVaultListing(listing)).toThrowError(expect.objectContaining({ code: 'invalid-response' }));
    expect(() => decodeVaultListing({ ...listing, snapshots: [], capacity: { ...listing.capacity, slots: 32 } }))
      .toThrowError(expect.objectContaining({ code: 'invalid-response' }));
    expect(() => decodeVaultReceipt({ snapshot, verified: false }))
      .toThrowError(expect.objectContaining({ code: 'invalid-response' }));
    expect(() => decodeVaultStatus({
      configured: false, installationId: '44444444-4444-4444-8444-444444444444',
      scope: 'library-v1', account: { uid: 'synthetic-owner', email: null },
    })).toThrowError(expect.objectContaining({ code: 'invalid-response' }));
    for (const scope of ['acceptance-v1', 'acceptance-v1/r000', 'acceptance-v1/r005']) {
      expect(() => decodeVaultStatus({
        configured: true,
        installationId: '44444444-4444-4444-8444-444444444444',
        scope,
        account: null,
      })).toThrowError(expect.objectContaining({ code: 'invalid-response' }));
    }
  });
});
